"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { startOfDay } from "date-fns";

/**
 * Get the operations board data for managers.
 * Shows operator workloads, unassigned tasks, receiving progress, and KPIs.
 */
export async function getOperationsBoard() {
  if (config.useMockData) {
    return {
      operators: [] as Array<{
        userId: string;
        name: string;
        active: number;
        completed: number;
        shortPicked: number;
        total: number;
        clockedIn: boolean;
        clockInTime: Date | null;
        hoursOnShift: number;
        receivingCount: number;
        countTasks: number;
      }>,
      notOnFloor: [] as Array<{ userId: string; name: string }>,
      unassignedTasks: [],
      receivingActive: [],
      kpis: { completedToday: 0, avgMinutes: 0, pendingTasks: 0, activeReceiving: 0 },
      availableOperators: [] as Array<{ userId: string; name: string }>,
    };
  }

  const { tenant } = await requireTenantContext("reports:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const today = startOfDay(new Date());

  // Resolve operator names from public DB
  const { publicDb } = await import("@/lib/db/public-client");
  const members = await publicDb.tenantUser.findMany({
    where: { tenantId: tenant.tenantId, role: { in: ["warehouse_worker", "manager", "admin"] } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const userMap = new Map(members.map((m) => [m.userId, m.user.name]));

  const [allTasks, completedToday, receivingActive, activeShifts, receivingTxnsToday, countsToday] =
    await Promise.all([
      // All pick tasks that are active or created today
      db.pickTask.findMany({
        where: {
          OR: [
            { status: { in: ["pending", "assigned", "in_progress"] } },
            { completedAt: { gte: today } },
          ],
        },
        include: {
          order: { select: { orderNumber: true, priority: true, shipToName: true } },
          lines: { select: { id: true, quantity: true, pickedQty: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Count of completed tasks today
      db.pickTask.count({
        where: { status: "completed", completedAt: { gte: today } },
      }),

      // Active inbound shipments
      db.inboundShipment.findMany({
        where: { status: { in: ["expected", "arrived", "receiving"] } },
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          expectedDate: true,
          client: { select: { name: true } },
          lines: { select: { expectedQty: true, receivedQty: true } },
        },
        orderBy: { expectedDate: "asc" },
        take: 20,
      }),

      // Currently clocked-in shifts
      db.operatorShift.findMany({
        where: { status: "clocked_in" },
        select: { operatorId: true, clockIn: true },
      }),

      // Receiving transactions today — to see who's working on receiving
      db.receivingTransaction.groupBy({
        by: ["receivedBy"],
        where: { createdAt: { gte: today } },
        _count: { id: true },
      }),

      // Cycle counts today — to see who's doing counts
      db.inventoryAdjustment.groupBy({
        by: ["createdBy"],
        where: { type: "cycle_count", createdAt: { gte: today } },
        _count: { id: true },
      }),
    ]);

  // Split tasks
  const unassignedTasks = allTasks
    .filter((t: { status: string }) => t.status === "pending")
    .map(
      (t: {
        id: string;
        taskNumber: string;
        status: string;
        createdAt: Date;
        order: { orderNumber: string; priority: string; shipToName: string } | null;
        lines: Array<{ id: string; quantity: number; pickedQty: number }>;
      }) => ({
        id: t.id,
        taskNumber: t.taskNumber,
        orderNumber: t.order?.orderNumber ?? "",
        priority: t.order?.priority ?? "standard",
        shipTo: t.order?.shipToName ?? "",
        lineCount: t.lines.length,
        createdAt: t.createdAt,
      })
    );

  // Index shift data by operatorId
  const shiftMap = new Map(
    activeShifts.map((s: { operatorId: string; clockIn: Date }) => [s.operatorId, s.clockIn])
  );

  // Index receiving counts by operator
  const receivingMap = new Map(
    receivingTxnsToday.map((r: { receivedBy: string; _count: { id: number } }) => [
      r.receivedBy,
      r._count.id,
    ])
  );

  // Index cycle count tasks by operator
  const countMap = new Map(
    countsToday.map((c: { createdBy: string; _count: { id: number } }) => [
      c.createdBy,
      c._count.id,
    ])
  );

  // Build operator workload map
  const operatorTasks = new Map<
    string,
    { active: number; completed: number; shortPicked: number }
  >();
  for (const task of allTasks) {
    const op = (task as { assignedTo: string | null }).assignedTo;
    if (!op) continue;
    if (!operatorTasks.has(op)) operatorTasks.set(op, { active: 0, completed: 0, shortPicked: 0 });
    const entry = operatorTasks.get(op)!;
    const status = (task as { status: string }).status;
    if (status === "assigned" || status === "in_progress") entry.active++;
    else if (status === "completed") entry.completed++;
    else if (status === "short_picked") entry.shortPicked++;
  }

  // Include all operators who have any activity today (picks, receiving, counts, or clocked in)
  const activeUserIds = new Set([
    ...operatorTasks.keys(),
    ...shiftMap.keys(),
    ...receivingMap.keys(),
    ...countMap.keys(),
  ]);

  const operators = [...userMap.entries()]
    .filter(([userId]) => activeUserIds.has(userId))
    .map(([userId, name]) => {
      const tasks = operatorTasks.get(userId) ?? { active: 0, completed: 0, shortPicked: 0 };
      const clockInTime = shiftMap.get(userId) ?? null;
      const hoursOnShift = clockInTime
        ? Math.round(
            ((Date.now() - new Date(clockInTime as string | number | Date).getTime()) / 3600000) *
              10
          ) / 10
        : 0;
      return {
        userId,
        name,
        ...tasks,
        total: tasks.active + tasks.completed + tasks.shortPicked,
        clockedIn: shiftMap.has(userId),
        clockInTime,
        hoursOnShift,
        receivingCount: (receivingMap.get(userId) as number | undefined) ?? 0,
        countTasks: (countMap.get(userId) as number | undefined) ?? 0,
      };
    })
    .sort((a, b) => Number(b.clockedIn) - Number(a.clockedIn) || b.active - a.active);

  // Operators with warehouse_worker role who have no activity today (not on floor)
  const notOnFloor = members
    .filter((m) => m.role === "warehouse_worker" && !activeUserIds.has(m.userId))
    .map((m) => ({ userId: m.userId, name: m.user.name }));

  // Avg completion time (minutes) for tasks completed today
  const completedTasks = allTasks.filter(
    (t: { status: string; startedAt: Date | null; completedAt: Date | null }) =>
      t.status === "completed" && t.startedAt && t.completedAt
  );
  const avgMinutes =
    completedTasks.length > 0
      ? Math.round(
          completedTasks.reduce((sum: number, t: { startedAt: Date; completedAt: Date }) => {
            return (
              sum + (new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime()) / 60000
            );
          }, 0) / completedTasks.length
        )
      : 0;

  // Map receiving
  const mappedReceiving = receivingActive.map(
    (s: {
      id: string;
      shipmentNumber: string;
      status: string;
      expectedDate: Date | null;
      client: { name: string } | null;
      lines: Array<{ expectedQty: number; receivedQty: number }>;
    }) => ({
      id: s.id,
      shipmentNumber: s.shipmentNumber,
      status: s.status,
      expectedDate: s.expectedDate,
      clientName: s.client?.name ?? "",
      totalExpected: s.lines.reduce((sum, l) => sum + l.expectedQty, 0),
      totalReceived: s.lines.reduce((sum, l) => sum + l.receivedQty, 0),
    })
  );

  return {
    operators,
    notOnFloor,
    unassignedTasks,
    receivingActive: mappedReceiving,
    kpis: {
      completedToday,
      avgMinutes,
      pendingTasks: unassignedTasks.length,
      activeReceiving: receivingActive.length,
    },
    // Pass operator list for assignment dropdown
    availableOperators: members
      .filter((m) => m.role === "warehouse_worker" || m.role === "manager")
      .map((m) => ({ userId: m.userId, name: m.user.name })),
  };
}

/**
 * Assign a pending pick task to an operator.
 */
export async function assignTaskToOperator(taskId: string, operatorUserId: string) {
  if (config.useMockData) return;

  const { user, tenant } = await requireTenantContext("orders:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const task = await db.pickTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (task.status !== "pending") throw new Error("Task is not pending");

  await db.pickTask.update({
    where: { id: taskId },
    data: { assignedTo: operatorUserId, status: "assigned" },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "pickTask",
    entityId: taskId,
    changes: {
      assignedTo: { old: null, new: operatorUserId },
      status: { old: "pending", new: "assigned" },
    },
  });

  revalidatePath("/operations");
}
