"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { getShopifyAdapterForTenant } from "@/lib/integrations/marketplaces/shopify";
import type { ShopifyAdapter } from "@/lib/integrations/marketplaces/shopify";
import type { MarketplaceOrder } from "@/lib/integrations/marketplaces/types";
import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";

/**
 * Resolve Shopify credentials for the current tenant.
 * Reads from SalesChannel.config first, falls back to env vars.
 */

async function resolveShopifyAdapter(
  db: any
): Promise<{ adapter: ShopifyAdapter; channel: any } | null> {
  let channel = await db.salesChannel.findFirst({
    where: { type: "shopify", isActive: true },
  });

  // Read credentials from channel config, fall back to env vars
  const cfg = (channel?.config ?? {}) as Record<string, string>;
  const shopDomain = cfg.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = cfg.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = cfg.apiVersion || process.env.SHOPIFY_API_VERSION || "2026-01";
  const locationId = cfg.locationId || process.env.SHOPIFY_LOCATION_ID || undefined;

  if (!shopDomain || !accessToken) return null;

  // Auto-create channel record if it doesn't exist
  if (!channel) {
    channel = await db.salesChannel.create({
      data: {
        name: "Shopify",
        type: "shopify",
        isActive: true,
        config: { shopDomain },
      },
    });
  }

  const adapter = getShopifyAdapterForTenant({ shopDomain, accessToken, apiVersion, locationId });
  return { adapter, channel };
}

/**
 * Sync unfulfilled Shopify orders into WMS.
 * - Finds or creates the Shopify SalesChannel record
 * - Fetches orders updated in the last 7 days (or since last sync)
 * - Skips orders that already exist (matched by externalId)
 * - Resolves SKUs → productIds for the configured client
 * - Returns { imported, skipped } counts
 */
export async function syncShopifyOrders(
  clientId: string
): Promise<{ imported: number; skipped: number; error?: string }> {
  if (config.useMockData) return { imported: 0, skipped: 0 };

  try {
    const { user, tenant } = await requireTenantContext();

    // Resolve Shopify credentials (DB first, env var fallback)
    const resolved = await resolveShopifyAdapter(tenant.db);
    if (!resolved)
      return { imported: 0, skipped: 0, error: "Shopify not configured for this tenant" };
    const { adapter, channel } = resolved;

    // Fetch orders updated in the last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const shopifyOrders = await adapter.fetchOrders(since);

    if (shopifyOrders.length === 0) return { imported: 0, skipped: 0 };

    // Load existing externalIds so we can skip duplicates
    const externalIds = shopifyOrders.map((o) => o.externalId);
    const existing = await tenant.db.order.findMany({
      where: { externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const existingIds = new Set(existing.map((o: { externalId: string | null }) => o.externalId));

    // Build a SKU → product map for this client
    const skus = [
      ...new Set(shopifyOrders.flatMap((o) => o.lineItems.map((li) => li.sku).filter(Boolean))),
    ] as string[];
    type ProductLookup = { id: string; sku: string; imageUrl: string | null; weight: unknown };
    const products: ProductLookup[] =
      skus.length > 0
        ? await tenant.db.product.findMany({
            where: { clientId, sku: { in: skus } },
            select: { id: true, sku: true, imageUrl: true, weight: true },
          })
        : [];
    const productBySku = new Map<string, ProductLookup>(products.map((p) => [p.sku, p]));

    // Enrich WMS product records with Shopify data (image, weight, vendor) if blank
    await enrichProductsFromShopify(tenant.db, clientId, shopifyOrders, productBySku);

    let imported = 0;
    let skipped = 0;

    for (const so of shopifyOrders) {
      if (existingIds.has(so.externalId)) {
        skipped++;
        continue;
      }

      const resolvedLines = so.lineItems
        .map((li) => ({
          sku: li.sku,
          productId: productBySku.get(li.sku)?.id,
          quantity: li.quantity,
          uom: "EA" as const,
          unitPrice: li.unitPrice,
        }))
        .filter((li) => li.productId != null);

      if (resolvedLines.length === 0) {
        // No known SKUs — skip but count it
        skipped++;
        continue;
      }

      const orderNumber = await nextSequence(tenant.db, "ORD");

      const order = await tenant.db.order.create({
        data: {
          orderNumber,
          externalId: so.externalId,
          channelId: channel.id,
          clientId,
          status: "pending",
          priority: so.priority as "standard" | "expedited" | "rush" | "same_day",
          shipToName: so.shipTo.name,
          shipToAddress1: so.shipTo.address1,
          shipToAddress2: so.shipTo.address2 ?? null,
          shipToCity: so.shipTo.city,
          shipToState: so.shipTo.state ?? null,
          shipToZip: so.shipTo.zip,
          shipToCountry: so.shipTo.country ?? "US",
          shipToPhone: so.shipTo.phone ?? null,
          shipToEmail: so.shipTo.email ?? null,
          shippingMethod: so.shippingMethod ?? null,
          orderDate: so.orderDate,
          shipByDate: so.shipByDate ?? null,
          notes: so.notes ?? null,
          totalItems: resolvedLines.reduce((s, li) => s + li.quantity, 0),
          lines: {
            create: resolvedLines.map((li) => ({
              productId: li.productId!,
              quantity: li.quantity,
              uom: li.uom,
              unitPrice: li.unitPrice ?? null,
            })),
          },
        },
      });

      await logAudit(tenant.db, {
        userId: user.id,
        action: "create",
        entityType: "order",
        entityId: order.id,
        changes: { source: { old: null, new: "shopify_sync" } },
      });

      imported++;
    }

    revalidatePath("/orders");
    return { imported, skipped };
  } catch (err) {
    return {
      imported: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : "Shopify sync failed",
    };
  }
}

/**
 * Push tracking/fulfillment info back to Shopify when an order ships.
 * Called from shipping actions after a label is created and confirmed.
 *
 * When called from a background worker, pass `tenantDb` explicitly so we
 * don't depend on request-scoped tenant context.
 */
export async function pushShopifyFulfillment(
  orderId: string,
  trackingNumber: string,
  carrier: string,
  tenantDb?: PrismaClient
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const db = tenantDb ?? (await requireTenantContext()).tenant.db;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { lines: { include: { product: true } } },
    });

    if (!order?.externalId) return {}; // Not a Shopify order

    // Resolve Shopify credentials for this tenant
    const resolved = await resolveShopifyAdapter(db);
    if (!resolved) return {}; // Shopify not configured — nothing to push

    // Verify the order's channel is actually Shopify
    if (order.channelId && order.channelId !== resolved.channel.id) return {};

    await resolved.adapter.pushFulfillment({
      externalOrderId: order.externalId,
      trackingNumber,
      carrier,
      shippedAt: new Date(),
      lineItems: [],
    });

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to push fulfillment" };
  }
}

/**
 * Sync WMS inventory levels back to Shopify for a given client.
 *
 * When called from a cron/worker context, pass `tenantDb` explicitly so we
 * don't depend on request-scoped tenant context.
 */
export async function syncInventoryToShopify(
  clientId: string,
  tenantDb?: PrismaClient
): Promise<{ synced: number; error?: string }> {
  if (config.useMockData) return { synced: 0 };

  try {
    const db = tenantDb ?? (await requireTenantContext()).tenant.db;

    // Load all active products for this client so zero-stock SKUs are pushed as 0
    const products = await db.product.findMany({
      where: { clientId, isActive: true },
      select: { id: true, sku: true },
    });
    if (products.length === 0) return { synced: 0 };

    // Sum available inventory per product (all rows, including zero)
    const inventoryRows = await db.inventory.groupBy({
      by: ["productId"],
      where: { product: { clientId } },
      _sum: { available: true },
    });
    const availableById = new Map(
      inventoryRows.map((r: { productId: string; _sum: { available: number | null } | null }) => [
        r.productId,
        Math.max(0, Number(r._sum?.available ?? 0)),
      ])
    );

    const updates = products
      .filter((p: { id: string; sku: string }) => p.sku)
      .map((p: { id: string; sku: string }) => ({
        sku: p.sku,
        availableQuantity: availableById.get(p.id) ?? 0,
      }));

    const resolved = await resolveShopifyAdapter(db);
    if (!resolved) return { synced: 0, error: "Shopify not configured for this tenant" };
    await resolved.adapter.syncInventory(updates);

    return { synced: updates.length };
  } catch (err) {
    return {
      synced: 0,
      error: err instanceof Error ? err.message : "Inventory sync failed",
    };
  }
}

/**
 * Sync WMS inventory levels back to Amazon for a given client.
 * Uses the SP-API Feeds API to submit a JSON_LISTINGS_FEED with quantity updates.
 *
 * When called from a cron/worker context, pass `tenantDb` explicitly so we
 * don't depend on request-scoped tenant context.
 */
export async function syncInventoryToAmazon(
  clientId: string,
  tenantDb?: PrismaClient
): Promise<{ synced: number; error?: string }> {
  if (config.useMockData) return { synced: 0 };

  try {
    const db = tenantDb ?? (await requireTenantContext()).tenant.db;

    // Resolve Amazon adapter: tenant-scoped credentials first, global env fallback
    const { getAmazonAdapter, getAmazonAdapterForTenant } =
      await import("@/lib/integrations/marketplaces/amazon");
    let adapter: ReturnType<typeof getAmazonAdapter> = null;

    // Try tenant-scoped SalesChannel config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const amazonChannel = await (db as any).salesChannel.findFirst({
      where: { type: "amazon", isActive: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = (amazonChannel?.config ?? {}) as any;
    if (cfg.clientId && cfg.clientSecret && cfg.refreshToken && cfg.sellerId) {
      adapter = getAmazonAdapterForTenant({
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        refreshToken: cfg.refreshToken,
        sellerId: cfg.sellerId,
        marketplaceId: cfg.marketplaceId,
        awsAccessKeyId: cfg.awsAccessKeyId || process.env.AMAZON_AWS_ACCESS_KEY_ID || "",
        awsSecretAccessKey:
          cfg.awsSecretAccessKey || process.env.AMAZON_AWS_SECRET_ACCESS_KEY || "",
        region: cfg.region,
      });
    } else {
      adapter = getAmazonAdapter(); // Legacy global env fallback
    }

    if (!adapter) return { synced: 0, error: "Amazon not configured" };

    // Load all active products so zero-stock SKUs are pushed as 0
    const products = await db.product.findMany({
      where: { clientId, isActive: true },
      select: { id: true, sku: true },
    });
    if (products.length === 0) return { synced: 0 };

    const inventoryRows = await db.inventory.groupBy({
      by: ["productId"],
      where: { product: { clientId } },
      _sum: { available: true },
    });
    const availableById = new Map(
      inventoryRows.map((r: { productId: string; _sum: { available: number | null } | null }) => [
        r.productId,
        Math.max(0, Number(r._sum?.available ?? 0)),
      ])
    );

    const updates = products
      .filter((p: { id: string; sku: string }) => p.sku)
      .map((p: { id: string; sku: string }) => ({
        sku: p.sku,
        availableQuantity: availableById.get(p.id) ?? 0,
      }));

    await adapter.syncInventory(updates);
    return { synced: updates.length };
  } catch (err) {
    return {
      synced: 0,
      error: err instanceof Error ? err.message : "Amazon inventory sync failed",
    };
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Enrich WMS product records with data from Shopify line items.
 * Only updates fields that are currently blank — never overwrites existing data.
 * Updates: imageUrl, weight (converted from grams), vendor (stored in description prefix)
 */
async function enrichProductsFromShopify(
  db: PrismaClient,
  clientId: string,
  orders: MarketplaceOrder[],
  productBySku: Map<string, { id: string; sku: string; imageUrl: string | null; weight: unknown }>
): Promise<void> {
  // Build SKU → enrichment data map from all line items
  const enrichment = new Map<
    string,
    {
      imageUrl?: string;
      weightGrams?: number;
      vendor?: string;
    }
  >();

  for (const order of orders) {
    for (const li of order.lineItems) {
      if (!li.sku) continue;
      if (!enrichment.has(li.sku)) {
        enrichment.set(li.sku, {
          imageUrl: li.imageUrl,
          weightGrams: li.weightGrams,
          vendor: li.vendor,
        });
      }
    }
  }

  for (const [sku, data] of enrichment) {
    const product = productBySku.get(sku);
    if (!product) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};

    if (data.imageUrl && !product.imageUrl) {
      updates.imageUrl = data.imageUrl;
    }
    if (data.weightGrams && data.weightGrams > 0 && !product.weight) {
      // Convert grams → pounds (WMS uses lb by default)
      updates.weight = parseFloat((data.weightGrams / 453.592).toFixed(4));
      updates.weightUnit = "lb";
    }

    if (Object.keys(updates).length > 0) {
      await db.product.update({
        where: { id: product.id },
        data: updates,
      });
    }
  }
}
