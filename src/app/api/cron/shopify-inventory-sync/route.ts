/**
 * Shopify Inventory Sync Cron Endpoint
 *
 * Pushes current WMS inventory levels to Shopify for all active tenants
 * that have a Shopify sales channel configured.
 *
 * Called by the Docker cron container (e.g. every 30 minutes).
 * Protected by CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/security/cron-auth";

type TenantResult = {
  tenant: string;
  synced: number;
  error?: string;
};

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { getShopifyConnectors } = await import("@/lib/integrations/tenant-connectors");
    const { ShopifyAdapter } = await import("@/lib/integrations/marketplaces/shopify");

    const connectors = await getShopifyConnectors(publicDb, getTenantDb);

    if (connectors.length === 0) {
      return NextResponse.json({
        skipped: "No tenants with Shopify configured",
      });
    }

    const results: TenantResult[] = [];

    for (const connector of connectors) {
      const { tenant, db } = connector;

      try {
        // Find the client for this connector
        const client = await db.client.findFirst({
          where: { code: connector.clientCode, isActive: true },
        });
        if (!client) {
          results.push({
            tenant: tenant.slug,
            synced: 0,
            error: `Client '${connector.clientCode}' not found`,
          });
          continue;
        }

        // Load all active products for this client
        const products = await db.product.findMany({
          where: { clientId: client.id, isActive: true },
          select: { id: true, sku: true },
        });

        if (products.length === 0) {
          results.push({ tenant: tenant.slug, synced: 0 });
          continue;
        }

        // Aggregate current WMS inventory levels by product
        const inventoryRows = await db.inventory.groupBy({
          by: ["productId"],
          where: { product: { clientId: client.id } },
          _sum: { available: true },
        });
        const availableById = new Map(
          inventoryRows.map(
            (r: { productId: string; _sum: { available: number | null } | null }) => [
              r.productId,
              Math.max(0, Number(r._sum?.available ?? 0)),
            ]
          )
        );

        // Build SKU → quantity updates (include zero-stock products)
        const updates = products
          .filter((p: { id: string; sku: string }) => p.sku)
          .map((p: { id: string; sku: string }) => ({
            sku: p.sku,
            availableQuantity: availableById.get(p.id) ?? 0,
          }));

        // Push to Shopify
        const adapter = new ShopifyAdapter({
          shopDomain: connector.shopDomain,
          accessToken: connector.accessToken,
          apiVersion: connector.apiVersion,
          locationId: connector.locationId,
        });

        await adapter.syncInventory(updates);

        console.warn(`[Shopify Inventory Sync] ${tenant.slug}: synced=${updates.length}`);
        results.push({ tenant: tenant.slug, synced: updates.length });
      } catch (tenantErr) {
        const msg = tenantErr instanceof Error ? tenantErr.message : "Sync failed";
        console.error(`[Shopify Inventory Sync] Error for ${tenant.slug}:`, tenantErr);
        results.push({ tenant: tenant.slug, synced: 0, error: msg });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);

    return NextResponse.json({
      totalSynced,
      tenants: results,
    });
  } catch (err) {
    console.error("[Shopify Inventory Sync] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
