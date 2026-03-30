/**
 * Low Stock Alerts Cron Endpoint
 *
 * Called daily by the cron scheduler.
 * Protected by CRON_SECRET (HMAC or legacy).
 *
 * For each active tenant, finds products where available < minStock
 * (and minStock is set), groups them by client, and queues one
 * low_stock_alert email per client.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/security/cron-auth";

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { getActiveTenants } = await import("@/lib/integrations/tenant-connectors");
    const { emailQueue } = await import("@/lib/jobs/queue");

    const tenants = await getActiveTenants(publicDb);

    if (tenants.length === 0) {
      return NextResponse.json({ skipped: "No active tenants" });
    }

    const summary: Array<{ tenant: string; alertsSent: number }> = [];

    for (const tenant of tenants) {
      const db = getTenantDb(tenant.dbSchema);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbAny = db as any;

      try {
        // Find products where available < minStock and minStock is set
        const lowStockProducts = await dbAny.product.findMany({
          where: {
            isActive: true,
            minStock: { not: null, gt: 0 },
          },
          select: {
            id: true,
            sku: true,
            name: true,
            minStock: true,
            clientId: true,
            client: { select: { id: true, name: true, email: true } },
          },
        });

        // For each product, check aggregated available inventory
        const lowStockByClient = new Map<
          string,
          {
            clientId: string;
            clientName: string;
            clientEmail: string | null;
            products: Array<{ sku: string; name: string; available: number; minStock: number }>;
          }
        >();

        for (const product of lowStockProducts) {
          const inventoryAgg = await dbAny.inventory.aggregate({
            where: { productId: product.id },
            _sum: { available: true },
          });

          const totalAvailable = inventoryAgg._sum.available ?? 0;

          if (totalAvailable < product.minStock) {
            const clientId = product.clientId ?? "unassigned";
            if (!lowStockByClient.has(clientId)) {
              lowStockByClient.set(clientId, {
                clientId,
                clientName: product.client?.name ?? "Unassigned",
                clientEmail: product.client?.email ?? null,
                products: [],
              });
            }
            lowStockByClient.get(clientId)!.products.push({
              sku: product.sku,
              name: product.name,
              available: totalAvailable,
              minStock: product.minStock,
            });
          }
        }

        let alertsSent = 0;

        for (const [, group] of lowStockByClient) {
          if (!group.clientEmail || group.products.length === 0) continue;

          await emailQueue.add("low_stock_alert", {
            template: "low_stock_alert",
            to: group.clientEmail,
            products: group.products,
          });
          alertsSent++;
        }

        console.warn(
          `[Low Stock Alerts] ${tenant.slug}: ${lowStockByClient.size} clients, ${alertsSent} emails queued`
        );
        summary.push({ tenant: tenant.slug, alertsSent });
      } catch (tenantErr) {
        console.error(`[Low Stock Alerts] Error processing tenant ${tenant.slug}:`, tenantErr);
        summary.push({ tenant: tenant.slug, alertsSent: 0 });
      }
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[Low Stock Alerts] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
