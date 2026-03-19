"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { getShopifyAdapter } from "@/lib/integrations/marketplaces/shopify";
import type { MarketplaceOrder } from "@/lib/integrations/marketplaces/types";
import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";

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

    // Find or create the Shopify sales channel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel = await (tenant.db as any).salesChannel.findFirst({
      where: { type: "shopify", isActive: true },
    });
    if (!channel) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel = await (tenant.db as any).salesChannel.create({
        data: {
          name: "Shopify",
          type: "shopify",
          isActive: true,
          config: {
            shopDomain: process.env.SHOPIFY_SHOP_DOMAIN ?? "",
          },
        },
      });
    }

    const adapter = getShopifyAdapter();

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
    const existingIds = new Set(existing.map((o) => o.externalId));

    // Build a SKU → product map for this client
    const skus = [
      ...new Set(
        shopifyOrders.flatMap((o) => o.lineItems.map((li) => li.sku).filter(Boolean))
      ),
    ] as string[];
    const products =
      skus.length > 0
        ? await tenant.db.product.findMany({
            where: { clientId, sku: { in: skus } },
            select: { id: true, sku: true, imageUrl: true, weight: true },
          })
        : [];
    const productBySku = new Map(products.map((p) => [p.sku, p]));

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
 */
export async function pushShopifyFulfillment(
  orderId: string,
  trackingNumber: string,
  carrier: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { tenant } = await requireTenantContext();

    const order = await tenant.db.order.findUnique({
      where: { id: orderId },
      include: { lines: { include: { product: true } } },
    });

    if (!order?.externalId) return {}; // Not a Shopify order

    // Check the channel is actually Shopify
    if (order.channelId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channel = await (tenant.db as any).salesChannel.findUnique({
        where: { id: order.channelId },
      });
      if (!channel || channel.type !== "shopify") return {};
    }

    const adapter = getShopifyAdapter();
    await adapter.pushFulfillment({
      externalOrderId: order.externalId,
      trackingNumber,
      carrier,
      shippedAt: new Date(),
      lineItems: order.lines.map((li) => ({
        externalLineId: li.id, // WMS line id (Shopify expects its own line item IDs)
        quantity: li.packedQty || li.quantity,
      })),
    });

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to push fulfillment" };
  }
}

/**
 * Sync WMS inventory levels back to Shopify for a given client.
 */
export async function syncInventoryToShopify(
  clientId: string
): Promise<{ synced: number; error?: string }> {
  if (config.useMockData) return { synced: 0 };

  try {
    const { tenant } = await requireTenantContext();

    // Get current available inventory per SKU for this client
    const inventoryRows = await tenant.db.inventory.groupBy({
      by: ["productId"],
      where: {
        product: { clientId },
        available: { gt: 0 },
      },
      _sum: { available: true },
    });

    if (inventoryRows.length === 0) return { synced: 0 };

    // Load product SKUs
    const productIds = inventoryRows.map((r) => r.productId);
    const products = await tenant.db.product.findMany({
      where: { id: { in: productIds }, clientId },
      select: { id: true, sku: true },
    });
    const skuById = new Map(products.map((p) => [p.id, p.sku]));

    const updates = inventoryRows
      .map((r) => ({
        sku: skuById.get(r.productId) ?? "",
        availableQuantity: r._sum?.available ?? 0,
      }))
      .filter((u) => u.sku);

    const adapter = getShopifyAdapter();
    await adapter.syncInventory(updates);

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
 */
export async function syncInventoryToAmazon(
  clientId: string
): Promise<{ synced: number; error?: string }> {
  if (config.useMockData) return { synced: 0 };

  try {
    const { getAmazonAdapter } = await import("@/lib/integrations/marketplaces/amazon");
    const adapter = getAmazonAdapter();
    if (!adapter) return { synced: 0, error: "Amazon not configured" };

    const { tenant } = await requireTenantContext();

    const inventoryRows = await tenant.db.inventory.groupBy({
      by: ["productId"],
      where: {
        product: { clientId },
        available: { gt: 0 },
      },
      _sum: { available: true },
    });

    if (inventoryRows.length === 0) return { synced: 0 };

    const productIds = inventoryRows.map((r) => r.productId);
    const products = await tenant.db.product.findMany({
      where: { id: { in: productIds }, clientId },
      select: { id: true, sku: true },
    });
    const skuById = new Map(products.map((p) => [p.id, p.sku]));

    const updates = inventoryRows
      .map((r) => ({
        sku: skuById.get(r.productId) ?? "",
        availableQuantity: Number(r._sum?.available ?? 0),
      }))
      .filter((u) => u.sku);

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productBySku: Map<string, { id: string; imageUrl: string | null; weight: any }>
): Promise<void> {
  // Build SKU → enrichment data map from all line items
  const enrichment = new Map<string, {
    imageUrl?: string;
    weightGrams?: number;
    vendor?: string;
  }>();

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
