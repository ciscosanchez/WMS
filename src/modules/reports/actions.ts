"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { startOfMonth, subDays, format } from "date-fns";

async function getContext() {
  return requireTenantContext("reports:read");
}

export async function getReceivingStats() {
  const { tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const monthStart = startOfMonth(new Date());

  const [completedCount, receivedAgg, discrepancyCount, clientVolume] = await Promise.all([
    db.inboundShipment.count({
      where: { status: "completed", completedDate: { gte: monthStart } },
    }),
    db.receivingTransaction.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { qty: true },
      _count: { id: true },
    }),
    db.receivingDiscrepancy.count({
      where: { createdAt: { gte: monthStart } },
    }),
    db.inboundShipment.groupBy({
      by: ["clientId"],
      where: { status: "completed", completedDate: { gte: monthStart } },
      _count: { id: true },
    }),
  ]);

  // Resolve client names
  const clientIds = clientVolume.map((v: { clientId: string }) => v.clientId);
  const clients =
    clientIds.length > 0
      ? await db.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, code: true },
        })
      : [];
  const clientMap = Object.fromEntries(
    clients.map((c: { id: string; code: string }) => [c.id, c.code])
  );

  const totalReceived = receivedAgg._sum.qty ?? 0;
  const totalTransactions = receivedAgg._count.id ?? 0;
  const discrepancyRate =
    totalTransactions > 0
      ? `${((discrepancyCount / totalTransactions) * 100).toFixed(1)}%`
      : "0.0%";

  return {
    totalShipmentsMTD: completedCount,
    totalItemsReceived: Number(totalReceived),
    discrepancyRate,
    clientVolume: clientVolume.map((v: { clientId: string; _count: { id: number } }) => ({
      name: clientMap[v.clientId] ?? "Unknown",
      value: v._count.id,
    })) as { name: string; value: number }[],
  };
}

export async function getInventoryStats() {
  const { tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const [totalsAgg, uniqueSkus, topProducts] = await Promise.all([
    db.inventory.aggregate({
      _sum: { onHand: true, allocated: true, available: true },
    }),
    db.inventory.groupBy({
      by: ["productId"],
      where: { onHand: { gt: 0 } },
    }),
    db.inventory.groupBy({
      by: ["productId"],
      _sum: { onHand: true },
      orderBy: { _sum: { onHand: "desc" } },
      take: 5,
    }),
  ]);

  // Low-stock: products where inventory.available < product.minStock
  const productsWithMin = await db.product.findMany({
    where: { minStock: { gt: 0 }, isActive: true },
    select: { id: true, minStock: true },
  });

  let lowStockCount = 0;
  if (productsWithMin.length > 0) {
    const productIds = productsWithMin.map((p: { id: string }) => p.id);
    const inventoryByProduct = await db.inventory.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _sum: { available: true },
    });
    const invMap = Object.fromEntries(
      inventoryByProduct.map((inv: { productId: string; _sum: { available: number | null } }) => [
        inv.productId,
        inv._sum.available ?? 0,
      ])
    );
    lowStockCount = productsWithMin.filter(
      (p: { id: string; minStock: number }) => (invMap[p.id] ?? 0) < p.minStock
    ).length;
  }

  // Resolve top product SKUs
  const topProductIds = topProducts.map((p: { productId: string }) => p.productId);
  const topProductDetails =
    topProductIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, sku: true, baseUom: true },
        })
      : [];
  const skuMap = Object.fromEntries(
    topProductDetails.map((p: { id: string; sku: string; baseUom: string }) => [
      p.id,
      { sku: p.sku, uom: p.baseUom },
    ])
  );

  return {
    totalSkus: uniqueSkus.length,
    totalOnHand: Number(totalsAgg._sum.onHand ?? 0),
    totalAllocated: Number(totalsAgg._sum.allocated ?? 0),
    lowStockCount,
    topProducts: topProducts.map(
      (p: { productId: string; _sum: { onHand: number | null } }) => ({
        sku: skuMap[p.productId]?.sku ?? "Unknown",
        uom: skuMap[p.productId]?.uom ?? "EA",
        onHand: Number(p._sum.onHand ?? 0),
      })
    ) as { sku: string; uom: string; onHand: number }[],
  };
}

export async function getFulfillmentStats() {
  const { tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const monthStart = startOfMonth(new Date());
  const sevenDaysAgo = subDays(new Date(), 6);

  const [shippedOrders, recentOrders, shortPicks, costAgg] = await Promise.all([
    db.order.findMany({
      where: { status: "shipped", shippedDate: { gte: monthStart } },
      select: { totalItems: true },
    }),
    db.order.findMany({
      where: { orderDate: { gte: sevenDaysAgo } },
      select: { orderDate: true },
    }),
    db.pickTask.count({
      where: { status: "short_picked", createdAt: { gte: monthStart } },
    }),
    db.shipment.aggregate({
      where: { shippedAt: { gte: monthStart } },
      _avg: { shippingCost: true },
      _count: { id: true },
    }),
  ]);

  // Orders per day for the last 7 days
  const dayLabels = Array.from({ length: 7 }, (_, i) =>
    format(subDays(new Date(), 6 - i), "EEE")
  );
  const dayMap: Record<string, number> = Object.fromEntries(dayLabels.map((d) => [d, 0]));

  for (const o of recentOrders) {
    const label = format(new Date(o.orderDate), "EEE");
    if (label in dayMap) dayMap[label] = (dayMap[label] ?? 0) + 1;
  }

  const ordersPerDay = dayLabels.map((d) => ({ name: d, value: dayMap[d] ?? 0 }));

  const totalShippedMTD = shippedOrders.length;
  const totalUnitsMTD = shippedOrders.reduce(
    (sum: number, o: { totalItems: number }) => sum + (o.totalItems ?? 0),
    0
  );
  const avgShippingCost = costAgg._avg.shippingCost
    ? `$${parseFloat(costAgg._avg.shippingCost).toFixed(2)}`
    : "—";

  return {
    ordersMTD: totalShippedMTD,
    unitsMTD: totalUnitsMTD,
    shortPicksMTD: shortPicks,
    avgShippingCost,
    ordersPerDay,
  };
}

/**
 * Movement analytics — shows operator travel patterns to identify inefficiency.
 * Returns top bin-to-bin paths, movement counts per operator, and repeat trips.
 */
export async function getMovementAnalytics() {
  const { tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const monthStart = startOfMonth(new Date());
  const sevenDaysAgo = subDays(new Date(), 6);

  // All move transactions in the last 7 days (with bin barcodes for path analysis)
  const moves = await db.inventoryTransaction.findMany({
    where: {
      type: "move",
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      performedBy: true,
      fromBin: { select: { barcode: true } },
      toBin: { select: { barcode: true } },
      quantity: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Resolve operator names
  const { publicDb } = await import("@/lib/db/public-client");
  const operatorIds = [...new Set(moves.map((m: { performedBy: string }) => m.performedBy))] as string[];
  const users = operatorIds.length > 0
    ? await publicDb.user.findMany({
        where: { id: { in: operatorIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  // Count movements per operator
  const operatorCounts = new Map<string, number>();
  for (const m of moves) {
    const name = nameMap.get((m as { performedBy: string }).performedBy) ?? "Unknown";
    operatorCounts.set(name, (operatorCounts.get(name) ?? 0) + 1);
  }
  const movesPerOperator = [...operatorCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Top bin-to-bin paths (identify repeat trips)
  const pathCounts = new Map<string, number>();
  for (const m of moves) {
    const from = (m as { fromBin: { barcode: string } | null }).fromBin?.barcode ?? "?";
    const to = (m as { toBin: { barcode: string } | null }).toBin?.barcode ?? "?";
    const key = `${from} → ${to}`;
    pathCounts.set(key, (pathCounts.get(key) ?? 0) + 1);
  }
  const topPaths = [...pathCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Repeat trips: same from→to path used more than once (inefficiency indicator)
  const repeatTrips = topPaths.filter((p) => p.count > 1);

  // Movement counts by day for the last 7 days
  const dayLabels = Array.from({ length: 7 }, (_, i) =>
    format(subDays(new Date(), 6 - i), "EEE")
  );
  const dayMap: Record<string, number> = Object.fromEntries(dayLabels.map((d) => [d, 0]));
  for (const m of moves) {
    const label = format(new Date((m as { createdAt: Date }).createdAt), "EEE");
    if (label in dayMap) dayMap[label] = (dayMap[label] ?? 0) + 1;
  }
  const movesPerDay = dayLabels.map((d) => ({ name: d, value: dayMap[d] ?? 0 }));

  // MTD totals
  const mtdMoves = await db.inventoryTransaction.count({
    where: { type: "move", createdAt: { gte: monthStart } },
  });

  return {
    totalMovesMTD: mtdMoves,
    totalMovesWeek: moves.length,
    repeatTrips: repeatTrips.length,
    movesPerOperator,
    topPaths,
    movesPerDay,
  };
}
