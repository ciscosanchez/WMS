"use server";

import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { startOfDay } from "date-fns";

/**
 * Get all tasks for the current operator today — picking, receiving, and counts.
 * Used by the operator daily dashboard.
 */
export async function getMyTasksSummary() {
  if (config.useMockData) {
    return {
      pickTasks: [],
      receivingShipments: [],
      cycleCounts: [],
      stats: { active: 0, completedToday: 0 },
    };
  }

  const { user, tenant } = await requireTenantContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const today = startOfDay(new Date());

  const [pickTasks, receivingTxns, cycleCounts] = await Promise.all([
    // Pick tasks: assigned to me (active + completed today)
    db.pickTask.findMany({
      where: {
        OR: [
          { assignedTo: user.id, status: { in: ["assigned", "in_progress"] } },
          {
            assignedTo: user.id,
            status: { in: ["completed", "short_picked"] },
            completedAt: { gte: today },
          },
        ],
      },
      include: {
        order: { select: { orderNumber: true, priority: true, shipToName: true } },
        lines: { select: { id: true, quantity: true, pickedQty: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),

    // Receiving: shipments I worked on today
    db.receivingTransaction.findMany({
      where: { receivedBy: user.id, createdAt: { gte: today } },
      select: { shipmentId: true, quantity: true },
    }),

    // Cycle counts I created today
    db.inventoryAdjustment.findMany({
      where: { createdBy: user.id, type: "cycle_count", createdAt: { gte: today } },
      select: { id: true, status: true, reason: true, createdAt: true },
    }),
  ]);

  // Aggregate receiving by shipment
  const shipmentIds = [...new Set(receivingTxns.map((t: { shipmentId: string }) => t.shipmentId))];
  const receivingShipments =
    shipmentIds.length > 0
      ? await db.inboundShipment.findMany({
          where: { id: { in: shipmentIds } },
          select: {
            id: true,
            shipmentNumber: true,
            status: true,
            client: { select: { name: true } },
            lines: { select: { id: true, expectedQty: true, receivedQty: true } },
          },
        })
      : [];

  // Map pick tasks for the UI
  const mappedPicks = pickTasks.map(
    (t: {
      id: string;
      taskNumber: string;
      status: string;
      startedAt: Date | null;
      completedAt: Date | null;
      order: { orderNumber: string; priority: string; shipToName: string } | null;
      lines: Array<{ id: string; quantity: number; pickedQty: number }>;
    }) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      type: "pick" as const,
      status: t.status,
      orderNumber: t.order?.orderNumber ?? "",
      priority: t.order?.priority ?? "standard",
      shipTo: t.order?.shipToName ?? "",
      totalLines: t.lines.length,
      completedLines: t.lines.filter((l) => l.pickedQty >= l.quantity).length,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
    })
  );

  // Map receiving shipments
  const mappedReceiving = receivingShipments.map(
    (s: {
      id: string;
      shipmentNumber: string;
      status: string;
      client: { name: string } | null;
      lines: Array<{ id: string; expectedQty: number; receivedQty: number }>;
    }) => ({
      id: s.id,
      shipmentNumber: s.shipmentNumber,
      type: "receive" as const,
      status: s.status,
      clientName: s.client?.name ?? "",
      totalLines: s.lines.length,
      completedLines: s.lines.filter((l) => l.receivedQty >= l.expectedQty).length,
    })
  );

  // Stats
  const active = mappedPicks.filter(
    (t: { status: string }) => t.status === "assigned" || t.status === "in_progress"
  ).length;
  const completedToday =
    mappedPicks.filter(
      (t: { status: string }) => t.status === "completed" || t.status === "short_picked"
    ).length + cycleCounts.filter((c: { status: string }) => c.status === "completed").length;

  return {
    pickTasks: mappedPicks,
    receivingShipments: mappedReceiving,
    cycleCounts: cycleCounts.map(
      (c: { id: string; status: string; reason: string | null; createdAt: Date }) => ({
        id: c.id,
        type: "count" as const,
        status: c.status,
        reason: c.reason,
        createdAt: c.createdAt,
      })
    ),
    stats: { active, completedToday },
  };
}
