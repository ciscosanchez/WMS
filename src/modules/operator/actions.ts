"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences/index";
import { captureEvent } from "@/modules/billing/capture";

async function getContext() {
  return requireTenantContext("operator:write");
}

const binInclude = {
  shelf: {
    include: {
      rack: {
        include: {
          aisle: {
            include: { zone: { include: { warehouse: true } } },
          },
        },
      },
    },
  },
  inventory: { include: { product: true } },
} as const;

// ─── Lookups ────────────────────────────────────────────

export async function getBinByBarcode(barcode: string) {
  if (config.useMockData) return null;

  const { tenant } = await getContext();
  return tenant.db.bin.findUnique({
    where: { barcode },
    include: binInclude,
  });
}

export async function getShipmentByBarcode(barcode: string) {
  if (config.useMockData) return null;

  const { tenant } = await getContext();
  return tenant.db.inboundShipment.findFirst({
    where: {
      OR: [
        { shipmentNumber: barcode },
        { bolNumber: barcode },
        { trackingNumber: barcode },
        { poNumber: barcode },
      ],
    },
    include: {
      client: true,
      lines: { include: { product: true } },
    },
  });
}

// ─── Putaway Suggestion ─────────────────────────────────

/**
 * Suggest the best putaway bin for a product being received.
 * Strategy: prefer a bin that already holds the same product (consolidation),
 * then fall back to the nearest empty bin in the same zone.
 */
export async function suggestPutawayBin(productId: string) {
  if (config.useMockData) return null;

  const { tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  // 1. Check putaway rules first
  const rule = await db.putawayRule.findFirst({
    where: { productId, isActive: true },
    include: { bin: true },
    orderBy: { priority: "desc" },
  });
  if (rule?.bin) {
    return { binId: rule.bin.id, barcode: rule.bin.barcode, reason: "putaway_rule" as const };
  }

  // 2. Find a bin that already has this product (consolidation)
  const existingInv = await db.inventory.findFirst({
    where: { productId, onHand: { gt: 0 }, bin: { status: "available" } },
    include: { bin: true },
    orderBy: { bin: { barcode: "asc" } },
  });
  if (existingInv?.bin) {
    return {
      binId: existingInv.bin.id,
      barcode: existingInv.bin.barcode,
      reason: "consolidation" as const,
    };
  }

  // 3. Find nearest empty available bin in storage zones
  const emptyBin = await db.bin.findFirst({
    where: {
      status: "available",
      inventory: { none: {} },
      shelf: { rack: { aisle: { zone: { type: "storage" } } } },
    },
    orderBy: { barcode: "asc" },
  });
  if (emptyBin) {
    return { binId: emptyBin.id, barcode: emptyBin.barcode, reason: "nearest_empty" as const };
  }

  return null;
}

// ─── Pick Actions ────────────────────────────────────────

export async function getMyPickTasks() {
  if (config.useMockData) return [];

  const { user, tenant } = await requireTenantContext("operator:write");
  return tenant.db.pickTask.findMany({
    where: {
      assignedTo: user.id,
      status: { in: ["assigned", "in_progress"] },
    },
    include: {
      order: true,
      lines: {
        include: { product: true, bin: true },
        orderBy: { bin: { barcode: "asc" } }, // Pick path order: zone → aisle → rack → shelf
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAvailablePickTasks() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("operator:write");
  return tenant.db.pickTask.findMany({
    where: { status: "pending" },
    include: {
      order: true,
      lines: { include: { product: true, bin: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function claimPickTask(taskId: string) {
  if (config.useMockData) return { id: taskId, status: "in_progress" };

  const { user, tenant } = await requireTenantContext("operator:write");

  // Conditional update: only claim if status is still pending or assigned.
  // Prevents race condition where two operators claim the same task.
  const result = await tenant.db.pickTask.updateMany({
    where: { id: taskId, status: { in: ["pending", "assigned"] } },
    data: { status: "in_progress", assignedTo: user.id, startedAt: new Date() },
  });

  if (result.count === 0) {
    throw new Error("Task already claimed by another operator");
  }

  const task = await tenant.db.pickTask.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      order: true,
      lines: { include: { product: true, bin: true } },
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "pick_task",
    entityId: taskId,
    changes: { status: { old: "pending", new: "in_progress" } },
  });

  // Start task time tracking (non-blocking)
  const { startTaskTimeLog } = await import("@/modules/labor/actions");
  startTaskTimeLog(tenant.db, user.id, "pick", taskId, task.order?.clientId).catch(() => {});

  revalidatePath("/pick");
  return task;
}

export async function confirmPickLine(lineId: string, qty: number) {
  if (config.useMockData) return { id: lineId };

  const { user, tenant } = await requireTenantContext("operator:write");

  const line = await tenant.db.pickTaskLine.update({
    where: { id: lineId },
    data: { pickedQty: { increment: qty } },
    include: {
      task: { include: { lines: true } },
    },
  });

  // Check if all lines fully picked
  const allDone = line.task.lines.every(
    (l: { pickedQty: number; quantity: number }) => l.pickedQty >= l.quantity
  );
  if (allDone) {
    await tenant.db.pickTask.update({
      where: { id: line.taskId },
      data: { status: "completed", completedAt: new Date() },
    });

    // Complete task time tracking (non-blocking)
    const totalUnits = line.task.lines.reduce(
      (s: number, l: { pickedQty: number }) => s + l.pickedQty,
      0
    );
    const { completeTaskTimeLog } = await import("@/modules/labor/actions");
    completeTaskTimeLog(tenant.db, line.taskId, totalUnits, line.task.lines.length).catch(() => {});
  }

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "pick_task_line",
    entityId: lineId,
  });

  revalidatePath("/pick");
  return line;
}

export async function markPickLineShort(lineId: string, actualQty: number) {
  if (config.useMockData) return { id: lineId };

  const { user, tenant } = await requireTenantContext("operator:write");

  const line = await tenant.db.pickTaskLine.update({
    where: { id: lineId },
    data: { pickedQty: actualQty },
  });

  await tenant.db.pickTask.update({
    where: { id: line.taskId },
    data: { status: "short_picked" },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "pick_task_line",
    entityId: lineId,
    changes: { status: { old: "in_progress", new: "short_picked" } },
  });

  revalidatePath("/pick");
  return line;
}

// ─── Pack Actions ────────────────────────────────────────

export async function getTasksReadyToPack() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("operator:write");
  return tenant.db.pickTask.findMany({
    where: { status: "completed" },
    include: {
      order: true,
      lines: { include: { product: true } },
    },
    orderBy: { completedAt: "asc" },
  });
}

export async function confirmPack(taskId: string, boxCount: number) {
  if (config.useMockData) return { id: "mock-new" };

  const { user, tenant } = await requireTenantContext("operator:write");

  const task = await tenant.db.pickTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { lines: true, order: { include: { client: true } } },
  });

  if (!task.orderId) throw new Error("Pick task has no linked order");

  // Pre-flight status guard
  if (task.status !== "completed") {
    // If a shipment already exists for this order, return it (idempotent)
    const existingShipment = await tenant.db.shipment.findFirst({
      where: { orderId: task.orderId },
    });
    if (existingShipment) return existingShipment;
    throw new Error(`Cannot pack task in status "${task.status}" — must be "completed"`);
  }

  // Atomic: duplicate check + shipment creation + order status + billing
  // The duplicate check MUST be inside the transaction to prevent races.
  const shipment = await tenant.db.$transaction(
    async (
      prisma: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    ) => {
      // Duplicate check INSIDE transaction — prevents concurrent pack requests
      const existing = await prisma.shipment.findFirst({
        where: { orderId: task.orderId },
      });
      if (existing) return existing;

      const shipmentNumber = await nextSequence(tenant.db, "SHP");

      const newShipment = await prisma.shipment.create({
        data: {
          shipmentNumber,
          orderId: task.orderId!,
          status: "pending",
          items: {
            create: task.lines.map(
              (line: {
                productId: string;
                pickedQty: number;
                lotNumber: string | null;
                serialNumber: string | null;
              }) => ({
                productId: line.productId,
                quantity: line.pickedQty,
                lotNumber: line.lotNumber,
                serialNumber: line.serialNumber,
              })
            ),
          },
        },
      });

      await prisma.order.update({
        where: { id: task.orderId! },
        data: { status: "packed" },
      });

      // Capture billing events INSIDE the transaction — no orphaned shipments without billing
      if (task.order?.clientId) {
        const totalUnits = task.lines.reduce(
          (sum: number, l: { pickedQty: number }) => sum + l.pickedQty,
          0
        );

        // Use prisma (tx client) for billing captures so they're atomic
        const billingData = [
          { serviceType: "handling_order", qty: 1 },
          { serviceType: "handling_line", qty: task.lines.length },
          { serviceType: "handling_unit", qty: totalUnits },
        ];

        for (const event of billingData) {
          await captureEvent(prisma, {
            clientId: task.order.clientId,
            serviceType: event.serviceType,
            qty: event.qty,
            referenceType: "order",
            referenceId: task.orderId!,
          });
        }
      }

      return newShipment;
    }
  );

  // Post-commit: audit + cache invalidation (non-throwing)
  try {
    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "shipment",
      entityId: shipment.id,
      changes: { boxCount: { old: 0, new: boxCount } },
    });
  } catch (err) {
    console.error("[confirmPack] post-commit audit failed:", err);
  }

  revalidatePath("/pack");
  return shipment;
}

// ─── Cycle Count Actions ─────────────────────────────────

export async function getCycleCountBins() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.bin.findMany({
    where: { inventory: { some: {} } },
    include: binInclude,
    orderBy: { barcode: "asc" },
    take: 50,
  });
}

export async function submitCount(
  binId: string,
  lines: Array<{
    productId: string;
    systemQty: number;
    countedQty: number;
    lotNumber?: string | null;
  }>
) {
  if (config.useMockData) return { id: "mock-new" };

  const { user, tenant } = await requireTenantContext("operator:write");

  const adjustmentNumber = await nextSequence(tenant.db, "ADJ");

  const adjustment = await tenant.db.inventoryAdjustment.create({
    data: {
      adjustmentNumber,
      type: "cycle_count",
      status: "draft",
      reason: "Cycle count",
      createdBy: user.id,
      lines: {
        create: lines.map((line) => ({
          productId: line.productId,
          binId,
          lotNumber: line.lotNumber ?? null,
          systemQty: line.systemQty,
          countedQty: line.countedQty,
          variance: line.countedQty - line.systemQty,
        })),
      },
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "inventory_adjustment",
    entityId: adjustment.id,
  });

  revalidatePath("/count");
  return adjustment;
}
