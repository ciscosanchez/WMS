"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { format, subDays, startOfDay, differenceInHours } from "date-fns";

async function getReadContext() {
  return requireTenantContext("reports:read");
}

// ─── Throughput Trend ─────────────────────────────────────────────────────────
// Daily units received and shipped over the last N days.
// Returns data shaped for a dual-line chart.

export async function getThroughputTrend(days: number = 30) {
  const { tenant } = await getReadContext();
  const db = tenant.db;
  const now = new Date();
  const since = subDays(startOfDay(now), days - 1);

  const [receivingRows, shipmentRows] = await Promise.all([
    db.receivingTransaction.findMany({
      where: { receivedAt: { gte: since } },
      select: { receivedAt: true, quantity: true },
    }),
    db.shipment.findMany({
      where: { shippedAt: { not: null, gte: since } },
      select: { shippedAt: true, order: { select: { lines: { select: { quantity: true } } } } },
    }),
  ]);

  // Build day buckets
  const buckets: Record<string, { received: number; shipped: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const key = format(subDays(now, i), "MMM d");
    buckets[key] = { received: 0, shipped: 0 };
  }

  for (const tx of receivingRows) {
    const key = format(new Date(tx.receivedAt), "MMM d");
    if (key in buckets) buckets[key].received += tx.quantity;
  }

  for (const s of shipmentRows) {
    if (!s.shippedAt) continue;
    const key = format(new Date(s.shippedAt), "MMM d");
    if (key in buckets) {
      const totalUnits = s.order.lines.reduce(
        (sum: number, l: { quantity: number }) => sum + l.quantity,
        0
      );
      buckets[key].shipped += totalUnits;
    }
  }

  return Object.entries(buckets).map(([date, vals]) => ({
    date,
    received: vals.received,
    shipped: vals.shipped,
  }));
}

// ─── SLA Compliance ───────────────────────────────────────────────────────────
// Percentage of orders shipped on time (shippedDate <= shipByDate).

export async function getSlaCompliance() {
  const { tenant } = await getReadContext();
  const db = tenant.db;

  const orders = await db.order.findMany({
    where: { status: { in: ["shipped", "delivered"] } },
    select: { shipByDate: true, shippedDate: true },
  });

  let onTime = 0;
  let late = 0;
  let noSla = 0;

  for (const o of orders) {
    if (!o.shipByDate) {
      noSla++;
    } else if (o.shippedDate && new Date(o.shippedDate) <= new Date(o.shipByDate)) {
      onTime++;
    } else {
      late++;
    }
  }

  return { onTime, late, noSla };
}

// ─── Exception Heatmap ────────────────────────────────────────────────────────
// Count of discrepancies, short picks, and adjustments grouped by day of week.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getExceptionHeatmap() {
  const { tenant } = await getReadContext();
  const db = tenant.db;

  const [discrepancies, adjustments, shortPicks] = await Promise.all([
    db.receivingDiscrepancy.findMany({
      select: { createdAt: true },
    }),
    db.inventoryAdjustment.findMany({
      select: { createdAt: true },
    }),
    db.pickTask.findMany({
      where: { status: "short_picked" },
      select: { completedAt: true },
    }),
  ]);

  // Initialize grid: rows = exception type, columns = day of week
  const grid: Record<string, number[]> = {
    discrepancies: [0, 0, 0, 0, 0, 0, 0],
    adjustments: [0, 0, 0, 0, 0, 0, 0],
    shortPicks: [0, 0, 0, 0, 0, 0, 0],
  };

  for (const d of discrepancies) {
    const dow = new Date(d.createdAt).getDay();
    grid.discrepancies[dow]++;
  }

  for (const a of adjustments) {
    const dow = new Date(a.createdAt).getDay();
    grid.adjustments[dow]++;
  }

  for (const sp of shortPicks) {
    if (sp.completedAt) {
      const dow = new Date(sp.completedAt).getDay();
      grid.shortPicks[dow]++;
    }
  }

  return {
    days: DAY_NAMES,
    rows: [
      { label: "Discrepancies", values: grid.discrepancies },
      { label: "Adjustments", values: grid.adjustments },
      { label: "Short Picks", values: grid.shortPicks },
    ],
  };
}

// ─── Top Products ─────────────────────────────────────────────────────────────
// Most frequently picked products.

export async function getTopProducts(limit: number = 10) {
  const { tenant } = await getReadContext();
  const db = tenant.db;

  const pickLines = await db.pickTaskLine.findMany({
    where: { task: { status: "completed" } },
    select: {
      productId: true,
      pickedQty: true,
      product: { select: { sku: true, name: true } },
    },
  });

  const productMap: Record<string, { sku: string; name: string; picks: number }> = {};
  for (const line of pickLines) {
    if (!productMap[line.productId]) {
      productMap[line.productId] = {
        sku: line.product.sku,
        name: line.product.name,
        picks: 0,
      };
    }
    productMap[line.productId].picks += line.pickedQty;
  }

  return Object.values(productMap)
    .sort((a, b) => b.picks - a.picks)
    .slice(0, limit);
}

// ─── Warehouse Utilization ────────────────────────────────────────────────────
// Bins occupied vs total, grouped by zone type.

export async function getWarehouseUtilization() {
  const { tenant } = await getReadContext();
  const db = tenant.db;

  const [allBins, occupiedInventory] = await Promise.all([
    db.bin.findMany({
      select: {
        id: true,
        shelf: {
          select: {
            rack: {
              select: {
                aisle: {
                  select: {
                    zone: { select: { type: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.inventory.findMany({
      where: { onHand: { gt: 0 } },
      select: { binId: true },
    }),
  ]);

  const occupiedBinIds = new Set(occupiedInventory.map((i) => i.binId));

  // Group by zone type
  const byType: Record<string, { total: number; occupied: number }> = {};

  for (const bin of allBins) {
    const zoneType = bin.shelf?.rack?.aisle?.zone?.type ?? "unknown";
    if (!byType[zoneType]) byType[zoneType] = { total: 0, occupied: 0 };
    byType[zoneType].total++;
    if (occupiedBinIds.has(bin.id)) byType[zoneType].occupied++;
  }

  return Object.entries(byType).map(([zoneType, data]) => ({
    zoneType,
    total: data.total,
    occupied: data.occupied,
    available: data.total - data.occupied,
    utilizationPct: data.total > 0 ? Math.round((data.occupied / data.total) * 100) : 0,
  }));
}

// ─── Order Velocity ───────────────────────────────────────────────────────────
// Average time from order creation to shipment, grouped by week.

export async function getOrderVelocity() {
  const { tenant } = await getReadContext();
  const db = tenant.db;

  const orders = await db.order.findMany({
    where: {
      status: { in: ["shipped", "delivered"] },
      shippedDate: { not: null },
    },
    select: { createdAt: true, shippedDate: true },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) return [];

  // Group by ISO week
  const weekMap: Record<string, { totalHours: number; count: number }> = {};

  for (const o of orders) {
    if (!o.shippedDate) continue;
    const weekLabel = format(new Date(o.createdAt), "'W'ww yyyy");
    const hours = differenceInHours(new Date(o.shippedDate), new Date(o.createdAt));
    if (!weekMap[weekLabel]) weekMap[weekLabel] = { totalHours: 0, count: 0 };
    weekMap[weekLabel].totalHours += Math.max(hours, 0);
    weekMap[weekLabel].count++;
  }

  return Object.entries(weekMap)
    .map(([week, data]) => ({
      week,
      avgHours: Math.round(data.totalHours / data.count),
      orders: data.count,
    }))
    .slice(-12); // last 12 weeks
}
