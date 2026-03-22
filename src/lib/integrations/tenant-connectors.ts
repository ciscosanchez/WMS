/**
 * Multi-tenant connector resolution.
 *
 * Iterates all active tenants and reads integration credentials from
 * SalesChannel.config in each tenant's DB.  Falls back to global env
 * vars for backward compatibility (single-tenant deployments).
 *
 * Carrier credentials are read from Tenant.settings in the public DB,
 * falling back to env vars.
 */

import type { PrismaClient as PublicClient } from "../../../node_modules/.prisma/public-client";
import type { PrismaClient as TenantClient } from "../../../node_modules/.prisma/tenant-client";
import { decryptSecret } from "@/lib/crypto/secrets";

export interface TenantEntry {
  id: string;
  slug: string;
  dbSchema: string;
  settings: Record<string, unknown>;
}

export interface ShopifyConnector {
  tenant: TenantEntry;
  db: TenantClient;
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  locationId?: string;
  clientCode: string;
}

export interface AmazonConnector {
  tenant: TenantEntry;
  db: TenantClient;
  sellerId: string;
  marketplaceId: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  region: "us-east-1" | "eu-west-1" | "us-west-2";
  clientCode: string;
}

export interface CarrierCredentials {
  ups?: { accountNumber: string; clientId: string; clientSecret: string };
  fedex?: { clientId: string; clientSecret: string; accountNumber: string };
  usps?: { clientId: string; clientSecret: string };
}

/**
 * Get all active tenants from the public DB.
 */
export async function getActiveTenants(
  publicDb: PublicClient
): Promise<TenantEntry[]> {
  const tenants = await publicDb.tenant.findMany({
    where: { status: "active" },
    select: { id: true, slug: true, dbSchema: true, settings: true },
  });
  return tenants.map((t) => ({
    ...t,
    settings: (t.settings as Record<string, unknown>) ?? {},
  }));
}

/**
 * Find Shopify connectors across all tenants.
 * Checks SalesChannel.config for credentials, falls back to env vars
 * for the tenant matching ARMSTRONG_TENANT_SLUG.
 */
export async function getShopifyConnectors(
  publicDb: PublicClient,
  getTenantDb: (schema: string) => TenantClient
): Promise<ShopifyConnector[]> {
  const tenants = await getActiveTenants(publicDb);
  const connectors: ShopifyConnector[] = [];

  for (const tenant of tenants) {
    const db = getTenantDb(tenant.dbSchema);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = await (db as any).salesChannel.findFirst({
      where: { type: "shopify", isActive: true },
    });
    if (!channel) continue;

    const config = (channel.config ?? {}) as Record<string, string>;

    // Try credentials from SalesChannel.config first, then env vars for legacy
    const shopDomain =
      config.shopDomain ||
      (tenant.slug === process.env.ARMSTRONG_TENANT_SLUG
        ? process.env.SHOPIFY_SHOP_DOMAIN
        : undefined);
    const accessToken =
      config.accessToken ||
      (tenant.slug === process.env.ARMSTRONG_TENANT_SLUG
        ? process.env.SHOPIFY_ACCESS_TOKEN
        : undefined);

    if (!shopDomain || !accessToken) continue;

    connectors.push({
      tenant,
      db,
      shopDomain,
      accessToken,
      apiVersion: config.apiVersion || process.env.SHOPIFY_API_VERSION || "2026-01",
      locationId: config.locationId || process.env.SHOPIFY_LOCATION_ID,
      clientCode:
        config.clientCode ||
        (tenant.slug === process.env.ARMSTRONG_TENANT_SLUG
          ? process.env.SHOPIFY_WMS_CLIENT_CODE ?? "Armstrong"
          : ""),
    });
  }

  return connectors;
}

/**
 * Resolve which tenant a Shopify webhook belongs to by matching the shop domain.
 */
export async function resolveShopifyTenant(
  publicDb: PublicClient,
  getTenantDb: (schema: string) => TenantClient,
  shopDomain: string
): Promise<ShopifyConnector | null> {
  const connectors = await getShopifyConnectors(publicDb, getTenantDb);
  return connectors.find((c) => c.shopDomain === shopDomain) ?? null;
}

/**
 * Resolve which tenant an Amazon webhook belongs to by matching the seller ID.
 */
export async function resolveAmazonTenant(
  publicDb: PublicClient,
  getTenantDb: (schema: string) => TenantClient,
  sellerId: string
): Promise<AmazonConnector | null> {
  const tenants = await getActiveTenants(publicDb);

  for (const tenant of tenants) {
    const db = getTenantDb(tenant.dbSchema);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = await (db as any).salesChannel.findFirst({
      where: { type: "amazon", isActive: true },
    });
    if (!channel) continue;

    const config = (channel.config ?? {}) as Record<string, string>;
    const cfgSellerId =
      config.sellerId ||
      (tenant.slug === process.env.ARMSTRONG_TENANT_SLUG
        ? process.env.AMAZON_SELLER_ID
        : undefined);

    if (cfgSellerId !== sellerId) continue;

    // Build full connector
    // Unified env var names: AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, etc.
    // Also accepts legacy AMAZON_SP_* for backward compat.
    const clientId =
      config.clientId ||
      (tenant.slug === process.env.ARMSTRONG_TENANT_SLUG
        ? process.env.AMAZON_CLIENT_ID ?? process.env.AMAZON_SP_CLIENT_ID
        : undefined);
    const clientSecret =
      config.clientSecret ||
      (tenant.slug === process.env.ARMSTRONG_TENANT_SLUG
        ? process.env.AMAZON_CLIENT_SECRET ?? process.env.AMAZON_SP_CLIENT_SECRET
        : undefined);

    if (!clientId || !clientSecret || !cfgSellerId) continue;

    // Resolve remaining required credentials
    const refreshToken = config.refreshToken || process.env.AMAZON_REFRESH_TOKEN || process.env.AMAZON_SP_REFRESH_TOKEN || "";
    const awsAccessKeyId = config.awsAccessKeyId || process.env.AMAZON_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
    const awsSecretAccessKey = config.awsSecretAccessKey || process.env.AMAZON_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";

    // All five credentials are required for SP-API calls — skip if incomplete
    if (!refreshToken || !awsAccessKeyId || !awsSecretAccessKey) continue;

    return {
      tenant,
      db,
      sellerId: cfgSellerId,
      marketplaceId: config.marketplaceId || process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER",
      refreshToken,
      clientId,
      clientSecret,
      awsAccessKeyId,
      awsSecretAccessKey,
      region: (config.region || "us-east-1") as "us-east-1" | "eu-west-1" | "us-west-2",
      clientCode:
        config.clientCode ||
        (tenant.slug === process.env.ARMSTRONG_TENANT_SLUG
          ? process.env.AMAZON_WMS_CLIENT_CODE ?? process.env.SHOPIFY_WMS_CLIENT_CODE ?? "Armstrong"
          : ""),
    };
  }

  return null;
}

/**
 * Get carrier credentials for a tenant.
 * Reads from Tenant.settings, falls back to env vars.
 */
/** Decrypt a value if encrypted, otherwise return as-is. */
function dec(val: string | undefined): string {
  if (!val) return "";
  return decryptSecret(val);
}

export function getCarrierCredentials(tenant: TenantEntry): CarrierCredentials {
  const s = tenant.settings as Record<string, Record<string, string>>;
  const creds: CarrierCredentials = {};

  const upsClientId = s.ups?.clientId || process.env.UPS_CLIENT_ID;
  if (upsClientId) {
    creds.ups = {
      accountNumber: s.ups?.accountNumber || process.env.UPS_ACCOUNT_NUMBER || "",
      clientId: upsClientId,
      clientSecret: dec(s.ups?.clientSecret) || process.env.UPS_CLIENT_SECRET || "",
    };
  }

  const fedexClientId = s.fedex?.clientId || process.env.FEDEX_CLIENT_ID;
  if (fedexClientId) {
    creds.fedex = {
      clientId: fedexClientId,
      clientSecret: dec(s.fedex?.clientSecret) || process.env.FEDEX_CLIENT_SECRET || "",
      accountNumber: s.fedex?.accountNumber || process.env.FEDEX_ACCOUNT_NUMBER || "",
    };
  }

  const uspsClientId = s.usps?.clientId || process.env.USPS_CLIENT_ID;
  if (uspsClientId) {
    creds.usps = {
      clientId: uspsClientId,
      clientSecret: dec(s.usps?.clientSecret) || process.env.USPS_CLIENT_SECRET || "",
    };
  }

  return creds;
}
