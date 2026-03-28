"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAccessibleWarehouseIds } from "@/lib/auth/rbac";
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
      releaseGate: { pending: [], releasedToday: [] },
      kpis: {
        completedToday: 0,
        avgMinutes: 0,
        pendingTasks: 0,
        activeReceiving: 0,
        pendingRelease: 0,
        releasedToday: 0,
      },
      availableOperators: [] as Array<{ userId: string; name: string }>,
    };
  }

  const { tenant, role, warehouseAccess } = await requireTenantContext("reports:read");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const today = startOfDay(new Date());

  // Resolve operator names from public DB — scoped to the manager's accessible warehouses
  const { publicDb } = await import("@/lib/db/public-client");
  const members = await publicDb.tenantUser.findMany({
    where: {
      tenantId: tenant.tenantId,
      role: { in: ["warehouse_worker", "manager", "admin"] },
      // Scoped managers only see members assigned to their warehouses.
      // Admins (accessibleIds === null) see everyone.
      ...(accessibleIds !== null
        ? {
            OR: [
              { role: "admin" },
              { warehouseAssignments: { some: { warehouseId: { in: accessibleIds } } } },
            ],
          }
        : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const userMap = new Map(members.map((m) => [m.userId, m.user.name]));

  const [
    allTasks,
    completedToday,
    receivingActive,
    activeShifts,
    receivingTxnsToday,
    pendingRelease,
    releasedToday,
    countsToday,
  ] = await Promise.all([
    // All pick tasks that are active or created today, scoped to accessible warehouses
    db.pickTask.findMany({
      where: {
        OR: [
          { status: { in: ["pending", "assigned", "in_progress"] } },
          { completedAt: { gte: today } },
        ],
        ...(accessibleIds !== null
          ? {
              lines: {
                some: {
                  bin: {
                    shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        order: { select: { orderNumber: true, priority: true, shipToName: true } },
        lines: { select: { id: true, quantity: true, pickedQty: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    // Count of completed tasks today — scoped to accessible warehouses
    db.pickTask.count({
      where: {
        status: "completed",
        completedAt: { gte: today },
        ...(accessibleIds !== null
          ? {
              lines: {
                some: {
                  bin: {
                    shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } },
                  },
                },
              },
            }
          : {}),
      },
    }),

    // Active inbound shipments — scoped to accessible warehouses
    db.inboundShipment.findMany({
      where: {
        status: { in: ["expected", "arrived", "receiving"] },
        ...(accessibleIds !== null ? { warehouseId: { in: accessibleIds } } : {}),
      },
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

    // Receiving transactions today — scoped to accessible warehouse bins
    db.receivingTransaction.groupBy({
      by: ["receivedBy"],
      where: {
        createdAt: { gte: today },
        ...(accessibleIds !== null
          ? {
              bin: {
                shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } },
              },
            }
          : {}),
      },
      _count: { id: true },
    }),

    // Outbound shipments awaiting dock release — scoped via pick task → bin → warehouse chain
    db.shipment.findMany({
      where: {
        status: "label_created",
        releasedAt: null,
        ...(accessibleIds !== null
          ? {
              order: {
                picks: {
                  some: {
                    lines: {
                      some: {
                        bin: {
                          shelf: {
                            rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            client: { select: { name: true } },
          },
        },
        items: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),

    // Shipments released at the dock today — scoped via pick task → bin → warehouse chain
    db.shipment.findMany({
      where: {
        releasedAt: { gte: today },
        ...(accessibleIds !== null
          ? {
              order: {
                picks: {
                  some: {
                    lines: {
                      some: {
                        bin: {
                          shelf: {
                            rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        shipmentNumber: true,
        releasedAt: true,
        carrier: true,
        order: { select: { orderNumber: true } },
      },
      orderBy: { releasedAt: "desc" },
      take: 20,
    }),

    // Cycle counts today — scoped to accessible warehouses via inventory record
    db.inventoryAdjustment.groupBy({
      by: ["createdBy"],
      where: {
        type: "cycle_count",
        createdAt: { gte: today },
        ...(accessibleIds !== null
          ? {
              inventory: {
                bin: {
                  shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } },
                },
              },
            }
          : {}),
      },
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
    releaseGate: {
      pending: pendingRelease as Array<{
        id: string;
        shipmentNumber: string;
        carrier: string | null;
        createdAt: Date;
        order: { orderNumber: string; client: { name: string } | null } | null;
        items: Array<{ id: string }>;
      }>,
      releasedToday: releasedToday as Array<{
        id: string;
        shipmentNumber: string;
        releasedAt: Date | null;
        carrier: string | null;
        order: { orderNumber: string } | null;
      }>,
    },
    kpis: {
      completedToday,
      avgMinutes,
      pendingTasks: unassignedTasks.length,
      activeReceiving: receivingActive.length,
      pendingRelease: pendingRelease.length,
      releasedToday: releasedToday.length,
    },
    // Pass operator list for assignment dropdown
    availableOperators: members
      .filter((m) => m.role === "warehouse_worker" || m.role === "manager")
      .map((m) => ({ userId: m.userId, name: m.user.name })),
  };
}

/**
 * Movement analytics report: picks completed today, grouped by zone.
 * Returns zone-level stats and top 10 bins by pick frequency.
 */
export async function getPickMovementReport() {
  if (config.useMockData) {
    return {
      zones: [] as Array<{
        zoneName: string;
        zoneCode: string;
        linesPickedToday: number;
        uniqueOperators: number;
        pctOfTotal: number;
      }>,
      topBins: [] as Array<{ binCode: string; binBarcode: string; pickCount: number }>,
      totalLinesPickedToday: 0,
    };
  }

  const { tenant, role, warehouseAccess } = await requireTenantContext("reports:read");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const today = startOfDay(new Date());

  // Fetch all completed pick task lines today, traversing the bin→shelf→rack→aisle→zone chain
  const lines = await db.pickTaskLine.findMany({
    where: {
      pickedQty: { gt: 0 },
      task: {
        status: { in: ["completed", "short_picked"] },
        completedAt: { gte: today },
        ...(accessibleIds !== null
          ? {
              lines: {
                some: {
                  bin: {
                    shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } },
                  },
                },
              },
            }
          : {}),
      },
    },
    select: {
      id: true,
      task: { select: { assignedTo: true } },
      bin: {
        select: {
          code: true,
          barcode: true,
          shelf: {
            select: {
              rack: {
                select: {
                  aisle: {
                    select: {
                      zone: { select: { name: true, code: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Aggregate by zone
  const zoneMap = new Map<
    string,
    { zoneName: string; zoneCode: string; lineCount: number; operators: Set<string> }
  >();

  // Aggregate by bin
  const binCountMap = new Map<string, { binCode: string; binBarcode: string; count: number }>();

  for (const line of lines as Array<{
    id: string;
    task: { assignedTo: string | null };
    bin: {
      code: string;
      barcode: string;
      shelf: { rack: { aisle: { zone: { name: string; code: string } } } };
    };
  }>) {
    const zone = line.bin.shelf.rack.aisle.zone;
    const zoneKey = zone.code;

    if (!zoneMap.has(zoneKey)) {
      zoneMap.set(zoneKey, {
        zoneName: zone.name,
        zoneCode: zone.code,
        lineCount: 0,
        operators: new Set(),
      });
    }
    const entry = zoneMap.get(zoneKey)!;
    entry.lineCount++;
    if (line.task.assignedTo) entry.operators.add(line.task.assignedTo);

    const binKey = line.bin.barcode;
    if (!binCountMap.has(binKey)) {
      binCountMap.set(binKey, { binCode: line.bin.code, binBarcode: line.bin.barcode, count: 0 });
    }
    binCountMap.get(binKey)!.count++;
  }

  const totalLines = lines.length;

  const zones = [...zoneMap.values()]
    .map((z) => ({
      zoneName: z.zoneName,
      zoneCode: z.zoneCode,
      linesPickedToday: z.lineCount,
      uniqueOperators: z.operators.size,
      pctOfTotal: totalLines > 0 ? Math.round((z.lineCount / totalLines) * 100) : 0,
    }))
    .sort((a, b) => b.linesPickedToday - a.linesPickedToday);

  const topBins = [...binCountMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((b) => ({ binCode: b.binCode, binBarcode: b.binBarcode, pickCount: b.count }));

  return { zones, topBins, totalLinesPickedToday: totalLines };
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
