/**
 * Migrate integration credentials from env vars into the database.
 *
 * Moves Armstrong's Shopify, Amazon, and carrier credentials from
 * global env vars into SalesChannel.config and Tenant.settings,
 * proving the multi-tenant credential path end-to-end.
 *
 * Usage: npx tsx scripts/migrate-credentials.ts
 *
 * Safe to run multiple times — uses upsert-style updates.
 * Does NOT delete env vars — they remain as fallback until removed.
 */

import { PrismaClient as PublicClient } from "../node_modules/.prisma/public-client";
import { PrismaClient as TenantClient } from "../node_modules/.prisma/tenant-client";

const publicDb = new PublicClient();

async function main() {
  const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!tenantSlug) {
    console.error("ARMSTRONG_TENANT_SLUG not set — nothing to migrate");
    process.exit(1);
  }

  const tenant = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant '${tenantSlug}' not found`);
    process.exit(1);
  }

  const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${tenant.dbSchema}`;
  const tenantDb = new TenantClient({ datasourceUrl: dbUrl });

  console.log(`Migrating credentials for tenant: ${tenant.name} (${tenant.slug})\n`);

  // ── 1. Shopify credentials → SalesChannel.config ─────────────────────────
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const shopToken = process.env.SHOPIFY_ACCESS_TOKEN;

  if (shopDomain && shopToken) {
    const channel = await tenantDb.salesChannel.findFirst({
      where: { type: "shopify", isActive: true },
    });

    if (channel) {
      const existingConfig = (channel.config as Record<string, unknown>) ?? {};
      await tenantDb.salesChannel.update({
        where: { id: channel.id },
        data: {
          config: {
            ...existingConfig,
            shopDomain,
            accessToken: shopToken,
            apiVersion: process.env.SHOPIFY_API_VERSION ?? "2026-01",
            locationId: process.env.SHOPIFY_LOCATION_ID ?? existingConfig.locationId,
            clientCode: process.env.SHOPIFY_WMS_CLIENT_CODE ?? "Armstrong",
          },
        },
      });
      console.log("  [Shopify] Credentials stored in SalesChannel.config");
    } else {
      await tenantDb.salesChannel.create({
        data: {
          name: "Shopify",
          type: "shopify",
          isActive: true,
          config: {
            shopDomain,
            accessToken: shopToken,
            apiVersion: process.env.SHOPIFY_API_VERSION ?? "2026-01",
            locationId: process.env.SHOPIFY_LOCATION_ID ?? null,
            clientCode: process.env.SHOPIFY_WMS_CLIENT_CODE ?? "Armstrong",
          },
        },
      });
      console.log("  [Shopify] Created SalesChannel with credentials");
    }
  } else {
    console.log("  [Shopify] Skipped — SHOPIFY_SHOP_DOMAIN or SHOPIFY_ACCESS_TOKEN not set");
  }

  // ── 2. Amazon credentials → SalesChannel.config ──────────────────────────
  const amazonSellerId = process.env.AMAZON_SELLER_ID;
  const amazonClientId = process.env.AMAZON_SP_CLIENT_ID;

  if (amazonSellerId && amazonClientId) {
    const channel = await tenantDb.salesChannel.findFirst({
      where: { type: "amazon", isActive: true },
    });

    const amazonConfig = {
      sellerId: amazonSellerId,
      marketplaceId: process.env.AMAZON_MARKETPLACE_ID ?? "ATVPDKIKX0DER",
      clientId: amazonClientId,
      clientSecret: process.env.AMAZON_SP_CLIENT_SECRET ?? "",
      refreshToken: process.env.AMAZON_SP_REFRESH_TOKEN ?? "",
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      region: "us-east-1",
      clientCode: process.env.SHOPIFY_WMS_CLIENT_CODE ?? "Armstrong",
    };

    if (channel) {
      await tenantDb.salesChannel.update({
        where: { id: channel.id },
        data: { config: { ...(channel.config as Record<string, unknown>), ...amazonConfig } },
      });
      console.log("  [Amazon] Credentials stored in SalesChannel.config");
    } else {
      await tenantDb.salesChannel.create({
        data: { name: "Amazon", type: "amazon", isActive: true, config: amazonConfig },
      });
      console.log("  [Amazon] Created SalesChannel with credentials");
    }
  } else {
    console.log("  [Amazon] Skipped — AMAZON_SELLER_ID or AMAZON_SP_CLIENT_ID not set");
  }

  // ── 3. Carrier credentials → Tenant.settings ─────────────────────────────
  const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};
  const carrierSettings: Record<string, unknown> = {};
  let carrierCount = 0;

  if (process.env.UPS_CLIENT_ID) {
    carrierSettings.ups = {
      accountNumber: process.env.UPS_ACCOUNT_NUMBER ?? "",
      clientId: process.env.UPS_CLIENT_ID,
      clientSecret: process.env.UPS_CLIENT_SECRET ?? "",
    };
    carrierCount++;
    console.log("  [UPS] Credentials stored in Tenant.settings");
  }

  if (process.env.FEDEX_CLIENT_ID) {
    carrierSettings.fedex = {
      clientId: process.env.FEDEX_CLIENT_ID,
      clientSecret: process.env.FEDEX_CLIENT_SECRET ?? "",
      accountNumber: process.env.FEDEX_ACCOUNT_NUMBER ?? "",
    };
    carrierCount++;
    console.log("  [FedEx] Credentials stored in Tenant.settings");
  }

  if (process.env.USPS_CLIENT_ID) {
    carrierSettings.usps = {
      clientId: process.env.USPS_CLIENT_ID,
      clientSecret: process.env.USPS_CLIENT_SECRET ?? "",
    };
    carrierCount++;
    console.log("  [USPS] Credentials stored in Tenant.settings");
  }

  if (carrierCount > 0) {
    await publicDb.tenant.update({
      where: { id: tenant.id },
      data: { settings: { ...currentSettings, ...carrierSettings } },
    });
  } else {
    console.log("  [Carriers] Skipped — no carrier env vars set");
  }

  // ── 4. NetSuite credentials → Tenant.settings ────────────────────────────
  if (process.env.NETSUITE_ACCOUNT_ID) {
    const nsSettings = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY ?? "",
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET ?? "",
      tokenId: process.env.NETSUITE_TOKEN_ID ?? "",
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET ?? "",
    };

    await publicDb.tenant.update({
      where: { id: tenant.id },
      data: {
        settings: { ...currentSettings, ...carrierSettings, netsuite: nsSettings },
      },
    });
    console.log("  [NetSuite] Credentials stored in Tenant.settings");
  } else {
    console.log("  [NetSuite] Skipped — NETSUITE_ACCOUNT_ID not set");
  }

  console.log("\nDone! Credentials migrated to database.");
  console.log("Env vars remain as fallback — remove them when ready to go fully DB-driven.");
  console.log("\nTo verify, check:");
  console.log("  - SalesChannel records in tenant DB (shopify, amazon configs)");
  console.log("  - Tenant.settings in public DB (carrier, netsuite configs)");

  await tenantDb.$disconnect();
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => publicDb.$disconnect());
