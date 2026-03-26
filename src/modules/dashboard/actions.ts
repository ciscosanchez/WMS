"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { format, subDays, startOfDay } from "date-fns";

export async function getDashboardChartData() {
  const { tenant } = await requireTenantContext("reports:read");
  const db = tenant.db;

  const now = new Date();

  const [receivingRows, orderStatusCounts, binsByZone, fulfillmentRows] = await Promise.all([
    // Receiving volume: items received per day for last 14 days
    db.receivingTransaction.findMany({
      where: { receivedAt: { gte: subDays(startOfDay(now), 13) } },
      select: { receivedAt: true, quantity: true },
    }),

    // Orders by current status
    db.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),

    // Zone utilization: inventory records with onHand > 0 → traverse to zone name
    db.inventory.findMany({
      where: { onHand: { gt: 0 } },
      select: {
        binId: true,
        bin: {
          select: {
            shelf: {
              select: {
                rack: {
                  select: {
                    aisle: {
                      select: {
                        zone: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),

    // Fulfillment throughput: shipments per day for last 7 days (by actual ship date)
    db.shipment.findMany({
      where: {
        shippedAt: { not: null, gte: subDays(startOfDay(now), 6) },
      },
      select: { shippedAt: true },
    }),
  ]);

  // ── Receiving volume by day ──────────────────────────────────────────────
  const receivingByDay: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const key = format(subDays(now, i), "MMM d");
    receivingByDay[key] = 0;
  }
  for (const tx of receivingRows) {
    const key = format(new Date(tx.receivedAt), "MMM d");
    if (key in receivingByDay) receivingByDay[key] += tx.quantity;
  }
  const receivingVolume = Object.entries(receivingByDay).map(([name, value]) => ({ name, value }));

  // ── Orders by status ────────────────────────────────────────────────────
  const STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    picking: "Picking",
    packed: "Packed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    on_hold: "On Hold",
  };
  const ordersByStatus = (orderStatusCounts as Array<{ status: string; _count: { _all: number } }>)
    .map((row) => ({
      name: STATUS_LABELS[row.status] ?? row.status,
      value: row._count._all,
    }))
    .filter((r) => r.value > 0);

  // ── Zone utilization (occupied bins per zone) ────────────────────────────
  const zoneOccupied: Record<string, Set<string>> = {};
  for (const inv of binsByZone) {
    const zoneName = inv.bin?.shelf?.rack?.aisle?.zone?.name ?? "Unzoned";
    if (!zoneOccupied[zoneName]) zoneOccupied[zoneName] = new Set();
    zoneOccupied[zoneName].add(inv.binId);
  }
  const zoneUtilization = Object.entries(zoneOccupied)
    .map(([name, bins]) => ({ name, value: bins.size }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── Fulfillment throughput by day ───────────────────────────────────────
  const throughputByDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const key = format(subDays(now, i), "EEE");
    throughputByDay[key] = 0;
  }
  for (const shipment of fulfillmentRows) {
    if (!shipment.shippedAt) continue;
    const key = format(new Date(shipment.shippedAt), "EEE");
    if (key in throughputByDay) throughputByDay[key]++;
  }
  const fulfillmentThroughput = Object.entries(throughputByDay).map(([name, value]) => ({
    name,
    value,
  }));

  return { receivingVolume, ordersByStatus, zoneUtilization, fulfillmentThroughput };
}
