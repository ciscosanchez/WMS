/**
 * Replenishment Cron Endpoint
 *
 * Called periodically (e.g. every 15 min) to auto-replenish pick-face bins
 * from bulk inventory when stock falls below the reorder point.
 * Protected by CRON_SECRET env var.
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

    const tenants = await getActiveTenants(publicDb);

    if (tenants.length === 0) {
      return NextResponse.json({ skipped: "No active tenants" });
    }

    const tenantResults: Array<{
      tenant: string;
      moves: number;
      errors: number;
    }> = [];

    for (const tenant of tenants) {
      const db = getTenantDb(tenant.dbSchema);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbAny = db as any;

      try {
        const rules = await dbAny.replenishmentRule.findMany({
          where: { isActive: true },
          include: {
            product: { select: { id: true, sku: true, name: true } },
            bin: { select: { id: true, barcode: true } },
          },
        });

        let moveCount = 0;
        let errorCount = 0;

        for (const rule of rules) {
          try {
            const pickInv = await dbAny.inventory.findFirst({
              where: { productId: rule.productId, binId: rule.binId },
              select: { available: true },
            });

            const currentQty = pickInv?.available ?? 0;
            if (currentQty > rule.reorderPoint) continue;

            const neededQty = rule.maxQty - currentQty;
            if (neededQty <= 0) continue;

            const bulkSource = await dbAny.inventory.findFirst({
              where: {
                productId: rule.productId,
                binId: { not: rule.binId },
                available: { gt: 0 },
                bin: { type: "bulk" },
              },
              orderBy: { available: "desc" },
            });

            if (!bulkSource) continue;

            const moveQty = Math.min(neededQty, bulkSource.available);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await dbAny.$transaction(async (prisma: any) => {
              const newSourceOnHand = bulkSource.onHand - moveQty;
              await prisma.inventory.update({
                where: { id: bulkSource.id },
                data: {
                  onHand: newSourceOnHand,
                  available: newSourceOnHand - bulkSource.allocated,
                },
              });

              const existing = await prisma.inventory.findFirst({
                where: { productId: rule.productId, binId: rule.binId },
              });

              if (existing) {
                const newOnHand = existing.onHand + moveQty;
                await prisma.inventory.update({
                  where: { id: existing.id },
                  data: { onHand: newOnHand, available: newOnHand - existing.allocated },
                });
              } else {
                await prisma.inventory.create({
                  data: {
                    productId: rule.productId,
                    binId: rule.binId,
                    onHand: moveQty,
                    allocated: 0,
                    available: moveQty,
                  },
                });
              }

              await prisma.inventoryTransaction.create({
                data: {
                  type: "move",
                  productId: rule.productId,
                  fromBinId: bulkSource.binId,
                  toBinId: rule.binId,
                  quantity: moveQty,
                  referenceType: "replenishment_rule",
                  referenceId: rule.id,
                  performedBy: "system-cron",
                },
              });
            });

            moveCount++;
          } catch (ruleErr) {
            errorCount++;
            console.error(
              `[Replenishment Cron] Rule ${rule.id} (${rule.product.sku}) failed:`,
              ruleErr
            );
          }
        }

        console.warn(
          `[Replenishment Cron] ${tenant.slug}: ${moveCount} moves, ${errorCount} errors`
        );
        tenantResults.push({ tenant: tenant.slug, moves: moveCount, errors: errorCount });
      } catch (tenantErr) {
        console.error(`[Replenishment Cron] Error processing tenant ${tenant.slug}:`, tenantErr);
        tenantResults.push({ tenant: tenant.slug, moves: 0, errors: -1 });
      }
    }

    return NextResponse.json({ tenants: tenantResults });
  } catch (err) {
    console.error("[Replenishment Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
