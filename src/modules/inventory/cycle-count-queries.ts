"use server";

import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";

/**
 * Fetch pending (draft) cycle count adjustments with their lines,
 * enriched with product SKU and bin barcode for the operator mobile UI.
 */
export async function getPendingCycleCountAdjustments() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("inventory:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const adjustments = await db.inventoryAdjustment.findMany({
    where: { type: "cycle_count", status: "draft" },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });

  // Enrich lines with product and bin info
  const enriched = await Promise.all(
    adjustments.map(async (adj: {
      id: string;
      adjustmentNumber: string;
      reason: string | null;
      status: string;
      lines: Array<{
        id: string;
        productId: string;
        binId: string;
        systemQty: number;
        countedQty: number;
        variance: number;
      }>;
    }) => {
      const productIds = [...new Set(adj.lines.map((l) => l.productId))];
      const binIds = [...new Set(adj.lines.map((l) => l.binId))];

      const [products, bins] = await Promise.all([
        db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, sku: true, name: true },
        }),
        db.bin.findMany({
          where: { id: { in: binIds } },
          select: { id: true, barcode: true },
        }),
      ]);

      const productMap = new Map(products.map((p: { id: string }) => [p.id, p]));
      const binMap = new Map(bins.map((b: { id: string }) => [b.id, b]));

      return {
        id: adj.id,
        adjustmentNumber: adj.adjustmentNumber,
        reason: adj.reason,
        status: adj.status,
        lines: adj.lines.map((line) => ({
          id: line.id,
          productId: line.productId,
          product: productMap.get(line.productId) ?? { sku: "-", name: "-" },
          binId: line.binId,
          bin: binMap.get(line.binId) ?? { barcode: "-" },
          systemQty: line.systemQty,
          countedQty: line.countedQty,
          variance: line.variance,
        })),
      };
    })
  );

  return enriched;
}
