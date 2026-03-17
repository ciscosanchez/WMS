"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { resolveTenant } from "@/lib/tenant/context";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences/index";

async function getContext() {
  const [user, tenant] = await Promise.all([requireAuth(), resolveTenant()]);
  if (!tenant) throw new Error("Tenant not found");
  return { user, tenant };
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

// ─── Pick Actions ────────────────────────────────────────

export async function getMyPickTasks() {
  if (config.useMockData) return [];

  const { user, tenant } = await getContext();
  return tenant.db.pickTask.findMany({
    where: {
      assignedTo: user.id,
      status: { in: ["assigned", "in_progress"] },
    },
    include: {
      order: true,
      lines: { include: { product: true, bin: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAvailablePickTasks() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
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

  const { user, tenant } = await getContext();

  const task = await tenant.db.pickTask.update({
    where: { id: taskId },
    data: { status: "in_progress", assignedTo: user.id, startedAt: new Date() },
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

  revalidatePath("/pick");
  return task;
}

export async function confirmPickLine(lineId: string, qty: number) {
  if (config.useMockData) return { id: lineId };

  const { user, tenant } = await getContext();

  const line = await tenant.db.pickTaskLine.update({
    where: { id: lineId },
    data: { pickedQty: { increment: qty } },
    include: {
      task: { include: { lines: true } },
    },
  });

  // Check if all lines fully picked
  const allDone = line.task.lines.every((l) => l.pickedQty >= l.quantity);
  if (allDone) {
    await tenant.db.pickTask.update({
      where: { id: line.taskId },
      data: { status: "completed", completedAt: new Date() },
    });
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

  const { user, tenant } = await getContext();

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

  const { tenant } = await getContext();
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

  const { user, tenant } = await getContext();

  const task = await tenant.db.pickTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { lines: true },
  });

  if (!task.orderId) throw new Error("Pick task has no linked order");

  const shipmentNumber = await nextSequence(tenant.db, "SHP");

  const shipment = await tenant.db.shipment.create({
    data: {
      shipmentNumber,
      orderId: task.orderId,
      status: "pending",
      items: {
        create: task.lines.map((line) => ({
          productId: line.productId,
          quantity: line.pickedQty,
          lotNumber: line.lotNumber,
          serialNumber: line.serialNumber,
        })),
      },
    },
  });

  await tenant.db.order.update({
    where: { id: task.orderId },
    data: { status: "packed" },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "shipment",
    entityId: shipment.id,
    changes: { boxCount: { old: 0, new: boxCount } },
  });

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

  const { user, tenant } = await getContext();

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
