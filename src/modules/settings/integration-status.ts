"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { publicDb } from "@/lib/db/public-client";
import { decryptSecret } from "@/lib/crypto/secrets";

export interface IntegrationStatus {
  connected: boolean;
  detail: string;
}

/** Safe connectivity check with timeout. */
async function probe(url: string, headers?: Record<string, string>): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "HEAD",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok || res.status === 401 || res.status === 403; // 401/403 = reachable
  } catch {
    return false;
  }
}

function dec(val: string | undefined): string {
  if (!val) return "";
  return decryptSecret(val);
}

/**
 * Single source of truth for all integration connection statuses.
 * Checks per-tenant config (SalesChannel, Tenant.settings) first, then env vars.
 * When credentials are present, performs a lightweight connectivity probe.
 */
export async function getIntegrationStatuses(): Promise<Record<string, IntegrationStatus>> {
  const { tenant } = await requireTenantContext();

  // Load tenant settings from public DB
  const tenantRow = await publicDb.tenant.findUnique({
    where: { id: tenant.tenantId },
    select: { settings: true },
  });
  const settings = (tenantRow?.settings ?? {}) as Record<string, Record<string, string>>;

  // Check Shopify: SalesChannel.config first, then env vars
  const shopifyChannel = await tenant.db.salesChannel.findFirst({
    where: { type: "shopify", isActive: true },
  });
  const shopifyCfg = (shopifyChannel?.config ?? {}) as Record<string, string>;
  const shopifyDomain = shopifyCfg.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN;
  const shopifyToken = dec(shopifyCfg.accessToken) || process.env.SHOPIFY_ACCESS_TOKEN;
  const hasShopifyCreds = !!(shopifyDomain && shopifyToken);

  // Check Amazon: SalesChannel.config first, then env vars
  const amazonChannel = await tenant.db.salesChannel.findFirst({
    where: { type: "amazon", isActive: true },
  });
  const amazonCfg = (amazonChannel?.config ?? {}) as Record<string, string>;
  const amazonSellerId = amazonCfg.sellerId || process.env.AMAZON_SELLER_ID;
  const amazonClientId = amazonCfg.clientId || process.env.AMAZON_CLIENT_ID;
  const hasAmazonCreds = !!(amazonSellerId && amazonClientId);

  // Check NetSuite: Tenant.settings.netsuite first, then env vars
  const netsuiteAccountId = settings.netsuite?.accountId || process.env.NETSUITE_ACCOUNT_ID;
  const hasNetsuiteCreds = !!netsuiteAccountId;

  // Check DispatchPro: Tenant.settings.dispatchpro first, then env vars
  const dispatchUrl =
    settings.dispatchpro?.url || process.env.DISPATCHPRO_URL || process.env.DISPATCHPRO_API_URL;
  const hasDispatchCreds = !!dispatchUrl;

  // Check carriers from Tenant.settings
  const hasUpsCreds = !!(settings.ups?.clientId || process.env.UPS_CLIENT_ID);
  const hasFedexCreds = !!(settings.fedex?.clientId || process.env.FEDEX_CLIENT_ID);
  const hasUspsCreds = !!(settings.usps?.clientId || process.env.USPS_CLIENT_ID);

  // Run connectivity probes in parallel for configured integrations
  const [shopifyReachable, dispatchReachable] = await Promise.all([
    hasShopifyCreds
      ? probe(`https://${shopifyDomain}/admin/api/2024-01/shop.json`, {
          "X-Shopify-Access-Token": shopifyToken!,
        })
      : Promise.resolve(false),
    hasDispatchCreds && dispatchUrl ? probe(`${dispatchUrl}/health`) : Promise.resolve(false),
  ]);

  return {
    shopify: {
      connected: hasShopifyCreds && shopifyReachable,
      detail: !hasShopifyCreds
        ? "Not configured"
        : shopifyReachable
          ? (shopifyDomain ?? "Connected")
          : "Configured (unreachable)",
    },
    amazon: {
      connected: hasAmazonCreds,
      detail: hasAmazonCreds ? `Seller ${amazonSellerId?.slice(0, 4)}…` : "Not configured",
    },
    netsuite: {
      connected: hasNetsuiteCreds,
      detail: hasNetsuiteCreds ? `Account ${netsuiteAccountId}` : "Not configured",
    },
    dispatchpro: {
      connected: hasDispatchCreds && dispatchReachable,
      detail: !hasDispatchCreds
        ? "Not configured"
        : dispatchReachable
          ? "Connected"
          : "Configured (unreachable)",
    },
    ups: { connected: hasUpsCreds, detail: hasUpsCreds ? "Connected" : "Not configured" },
    fedex: { connected: hasFedexCreds, detail: hasFedexCreds ? "Connected" : "Not configured" },
    usps: { connected: hasUspsCreds, detail: hasUspsCreds ? "Connected" : "Not configured" },
  };
}
