"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { publicDb } from "@/lib/db/public-client";

export interface IntegrationStatus {
  connected: boolean;
  detail: string;
}

/**
 * Single source of truth for all integration connection statuses.
 * Checks per-tenant config (SalesChannel, Tenant.settings) first, then env vars.
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
  const shopifyToken = shopifyCfg.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
  const shopifyConnected = !!(shopifyDomain && shopifyToken);

  // Check Amazon: SalesChannel.config first, then env vars
  const amazonChannel = await tenant.db.salesChannel.findFirst({
    where: { type: "amazon", isActive: true },
  });
  const amazonCfg = (amazonChannel?.config ?? {}) as Record<string, string>;
  const amazonSellerId = amazonCfg.sellerId || process.env.AMAZON_SELLER_ID;
  const amazonClientId = amazonCfg.clientId || process.env.AMAZON_CLIENT_ID;
  const amazonConnected = !!(amazonSellerId && amazonClientId);

  // Check NetSuite: Tenant.settings.netsuite first, then env vars
  const netsuiteAccountId = settings.netsuite?.accountId || process.env.NETSUITE_ACCOUNT_ID;
  const netsuiteConnected = !!netsuiteAccountId;

  // Check DispatchPro: Tenant.settings.dispatchpro first, then env vars
  const dispatchUrl = settings.dispatchpro?.url || process.env.DISPATCHPRO_URL || process.env.DISPATCHPRO_API_URL;
  const dispatchConnected = !!dispatchUrl;

  // Check carriers from Tenant.settings
  const upsConnected = !!(settings.ups?.clientId || process.env.UPS_CLIENT_ID);
  const fedexConnected = !!(settings.fedex?.clientId || process.env.FEDEX_CLIENT_ID);
  const uspsConnected = !!(settings.usps?.clientId || process.env.USPS_CLIENT_ID);

  return {
    shopify: {
      connected: shopifyConnected,
      detail: shopifyConnected ? (shopifyDomain ?? "Connected") : "Not configured",
    },
    amazon: {
      connected: amazonConnected,
      detail: amazonConnected ? `Seller ${amazonSellerId?.slice(0, 4)}…` : "Not configured",
    },
    netsuite: {
      connected: netsuiteConnected,
      detail: netsuiteConnected ? `Account ${netsuiteAccountId}` : "Not configured",
    },
    dispatchpro: {
      connected: dispatchConnected,
      detail: dispatchConnected ? "Connected" : "Not configured",
    },
    ups: { connected: upsConnected, detail: upsConnected ? "Connected" : "Not configured" },
    fedex: { connected: fedexConnected, detail: fedexConnected ? "Connected" : "Not configured" },
    usps: { connected: uspsConnected, detail: uspsConnected ? "Connected" : "Not configured" },
  };
}
