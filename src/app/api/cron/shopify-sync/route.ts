/**
 * Shopify Auto-Sync Cron Endpoint
 *
 * Called by the Docker cron container every 15 minutes.
 * Protected by CRON_SECRET env var.
 *
 * Iterates ALL active tenants that have a Shopify sales channel with
 * credentials configured, and syncs unfulfilled orders into each tenant's WMS.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Verify the cron secret
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { getShopifyConnectors } = await import("@/lib/integrations/tenant-connectors");
    const { ShopifyAdapter } = await import("@/lib/integrations/marketplaces/shopify");
    const { nextSequence } = await import("@/lib/sequences");
    const { logAudit } = await import("@/lib/audit");

    const connectors = await getShopifyConnectors(publicDb, getTenantDb);

    if (connectors.length === 0) {
      return NextResponse.json({ skipped: "No tenants with Shopify configured" });
    }

    const tenantResults: Array<{
      tenant: string;
      imported: number;
      skipped: number;
      inventorySynced: number;
    }> = [];

    for (const connector of connectors) {
      const { tenant, db, clientCode } = connector;

      try {
        // Find the client for this connector
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = await (db as any).client.findFirst({
          where: { code: clientCode, isActive: true },
        });
        if (!client) {
          console.warn(`[Shopify Cron] Client '${clientCode}' not found for tenant ${tenant.slug}`);
          continue;
        }

        // Find or create Shopify sales channel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let channel = await (db as any).salesChannel.findFirst({
          where: { type: "shopify", isActive: true },
        });
        if (!channel) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          channel = await (db as any).salesChannel.create({
            data: {
              name: "Shopify",
              type: "shopify",
              isActive: true,
              config: { shopDomain: connector.shopDomain },
            },
          });
        }

        // Construct adapter with per-tenant credentials
        const adapter = new ShopifyAdapter({
          shopDomain: connector.shopDomain,
          accessToken: connector.accessToken,
          apiVersion: connector.apiVersion,
          locationId: connector.locationId,
        });

        const since = new Date();
        since.setDate(since.getDate() - 1);
        const shopifyOrders = await adapter.fetchOrders(since);

        if (shopifyOrders.length === 0) {
          tenantResults.push({ tenant: tenant.slug, imported: 0, skipped: 0, inventorySynced: 0 });
          continue;
        }

        // Deduplicate
        const externalIds = shopifyOrders.map((o) => o.externalId);
        const existing = await db.order.findMany({
          where: { externalId: { in: externalIds } },
          select: { externalId: true },
        });
        const existingIds = new Set(
          existing.map((o: { externalId: string | null }) => o.externalId)
        );

        // Resolve SKUs
        const skus = [
          ...new Set(shopifyOrders.flatMap((o) => o.lineItems.map((li) => li.sku).filter(Boolean))),
        ] as string[];
        const products =
          skus.length > 0
            ? await db.product.findMany({
                where: { clientId: client.id, sku: { in: skus } },
                select: { id: true, sku: true, imageUrl: true, weight: true },
              })
            : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productBySku = new Map(products.map((p: any) => [p.sku, p]));

        let imported = 0;
        let skipped = 0;

        for (const so of shopifyOrders) {
          if (existingIds.has(so.externalId)) {
            skipped++;
            continue;
          }

          const resolvedLines = so.lineItems
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((li) => ({
              productId: (productBySku.get(li.sku) as any)?.id,
              quantity: li.quantity,
              uom: "EA",
              unitPrice: li.unitPrice,
            }))
            .filter((li) => li.productId != null);

          if (resolvedLines.length === 0) {
            skipped++;
            continue;
          }

          // Enrich products
          for (const li of so.lineItems) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const product = productBySku.get(li.sku) as any;
            if (!product) continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updates: Record<string, any> = {};
            if (li.imageUrl && !product.imageUrl) updates.imageUrl = li.imageUrl;
            if (li.weightGrams && li.weightGrams > 0 && !product.weight) {
              updates.weight = parseFloat((li.weightGrams / 453.592).toFixed(4));
              updates.weightUnit = "lb";
            }
            if (Object.keys(updates).length > 0) {
              await db.product.update({ where: { id: product.id }, data: updates });
            }
          }

          const orderNumber = await nextSequence(db, "ORD");
          const addr = so.shipTo;
          const created = await db.order.create({
            data: {
              orderNumber,
              externalId: so.externalId,
              channelId: channel.id,
              clientId: client.id,
              status: "pending",
              priority: so.priority as "standard" | "expedited" | "rush" | "same_day",
              shipToName: addr.name,
              shipToAddress1: addr.address1,
              shipToAddress2: addr.address2 ?? null,
              shipToCity: addr.city,
              shipToState: addr.state ?? null,
              shipToZip: addr.zip,
              shipToCountry: addr.country ?? "US",
              shipToPhone: addr.phone ?? null,
              shipToEmail: addr.email ?? null,
              shippingMethod: so.shippingMethod ?? null,
              orderDate: so.orderDate,
              notes: so.notes ?? null,
              totalItems: resolvedLines.reduce((s, li) => s + li.quantity, 0),
              lines: { create: resolvedLines },
            },
          });

          await logAudit(db, {
            userId: "cron",
            action: "create",
            entityType: "order",
            entityId: created.id,
            changes: { source: { old: null, new: "shopify_cron" } },
          });

          imported++;
        }

        // Push inventory back to Shopify
        let inventorySynced = 0;
        try {
          const { syncInventoryToShopify } = await import("@/modules/orders/shopify-sync");
          const invResult = await syncInventoryToShopify(client.id);
          inventorySynced = invResult.synced;
        } catch (invErr) {
          console.error(`[Shopify Cron] ${tenant.slug} inventory sync error:`, invErr);
        }

        console.log(
          `[Shopify Cron] ${tenant.slug}: imported=${imported} skipped=${skipped} inventorySynced=${inventorySynced}`
        );
        tenantResults.push({ tenant: tenant.slug, imported, skipped, inventorySynced });
      } catch (tenantErr) {
        console.error(`[Shopify Cron] Error processing tenant ${tenant.slug}:`, tenantErr);
      }
    }

    return NextResponse.json({ tenants: tenantResults });
  } catch (err) {
    console.error("[Shopify Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
