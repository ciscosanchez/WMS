"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { asTenantDb } from "@/lib/tenant/db-types";

type EligibleOrder = {
  id: string;
  orderNumber: string;
  status: string;
  lines: Array<{ id: string; productId: string; quantity: number }>;
};

type BatchLine = {
  productId: string;
  binId: string;
  quantity: number;
  pickedQty: number;
  orderId: string;
};

/**
 * Returns orders eligible for wave/batch picking:
 * - Status is pending or awaiting_fulfillment
 * - No existing pick tasks
 * - Has at least one order line
 */
export async function getWaveEligibleOrders(): Promise<EligibleOrder[]> {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("orders:read");
  const db = asTenantDb(tenant.db);

  const orders = (await db.order.findMany({
    where: {
      status: { in: ["pending", "confirmed", "allocated"] },
      picks: { none: {} },
    },
    include: {
      lines: {
        select: { id: true, productId: true, quantity: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })) as EligibleOrder[];

  return orders.filter((o) => o.lines.length > 0);
}

/**
 * Create a single batch pick task from multiple order IDs.
 * Lines from all orders are merged and sorted by bin location for optimal path.
 */
export async function createBatchPickTask(orderIds: string[]) {
  if (config.useMockData) return { taskId: "mock-batch", allocated: 0, skipped: 0 };
  if (orderIds.length === 0) throw new Error("No order IDs provided");

  const { user, tenant } = await requireTenantContext("orders:write");
  const db = asTenantDb(tenant.db);

  const orders = (await db.order.findMany({
    where: { id: { in: orderIds } },
    include: {
      lines: { select: { id: true, productId: true, quantity: true } },
    },
  })) as EligibleOrder[];

  if (orders.length === 0) throw new Error("No orders found for the given IDs");

  const taskNumber = await nextSequence(tenant.db, "PICK");

  const result = (await db.$transaction(
    async (
      prisma: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    ) => {
      const lineData: BatchLine[] = [];
      let allocated = 0;
      let skipped = 0;

      for (const order of orders) {
        for (const line of order.lines) {
          const inv = await prisma.inventory.findFirst({
            where: { productId: line.productId, available: { gte: line.quantity } },
            orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { available: "desc" }],
          });

          if (!inv) {
            skipped += 1;
            continue;
          }

          const updated = await prisma.inventory.updateMany({
            where: { id: inv.id, available: { gte: line.quantity } },
            data: {
              allocated: { increment: line.quantity },
              available: { decrement: line.quantity },
            },
          });

          if (updated.count === 0) {
            skipped += 1;
            continue;
          }

          await prisma.inventoryTransaction.create({
            data: {
              type: "allocate",
              productId: line.productId,
              fromBinId: inv.binId,
              quantity: line.quantity,
              referenceType: "order",
              referenceId: order.id,
              performedBy: user.id,
            },
          });

          lineData.push({
            productId: line.productId,
            binId: inv.binId,
            quantity: line.quantity,
            pickedQty: 0,
            orderId: order.id,
          });
          allocated += 1;
        }
      }

      if (lineData.length === 0) {
        return { task: null, allocated, skipped };
      }

      // Sort lines by bin barcode for optimal pick path
      const binIds = [...new Set(lineData.map((l) => l.binId))];
      const bins =
        binIds.length > 0
          ? await prisma.bin.findMany({
              where: { id: { in: binIds } },
              select: { id: true, barcode: true },
            })
          : [];
      const binBarcodeMap = new Map(
        bins.map((b: { id: string; barcode: string }) => [b.id, b.barcode])
      );

      const sortedLines = [...lineData].sort((a, b) => {
        const aKey = String(binBarcodeMap.get(a.binId) ?? "zzz");
        const bKey = String(binBarcodeMap.get(b.binId) ?? "zzz");
        return aKey.localeCompare(bKey);
      });

      // Create batch pick task — use first order as the primary orderId
      const task = await prisma.pickTask.create({
        data: {
          taskNumber,
          orderId: orders[0].id,
          method: "batch",
          status: "pending",
          lines: {
            create: sortedLines.map(({ orderId: _orderId, ...rest }) => rest),
          },
        },
      });

      // Update all order statuses to "picking"
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { status: "picking" as any },
      });

      return { task, allocated, skipped };
    }
  )) as { task: { id: string } | null; allocated: number; skipped: number };

  if (result.task) {
    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "pick_task",
      entityId: result.task.id,
      changes: {
        source: { old: null, new: "batch_pick" },
        orderCount: { old: null, new: orders.length },
        linesAllocated: { old: null, new: result.allocated },
      },
    });
  }

  revalidatePath("/picking");
  revalidatePath("/orders");

  return {
    taskId: result.task?.id ?? null,
    allocated: result.allocated,
    skipped: result.skipped,
  };
}

/**
 * Auto-select up to N eligible orders and create batch pick tasks.
 * Returns summary of created tasks.
 */
export async function generateWave(maxOrders = 20) {
  if (config.useMockData) return { created: 0, orderCount: 0, skipped: 0 };

  const eligible = await getWaveEligibleOrders();
  if (eligible.length === 0) return { created: 0, orderCount: 0, skipped: 0 };

  const selected = eligible.slice(0, maxOrders);
  const orderIds = selected.map((o) => o.id);

  const result = await createBatchPickTask(orderIds);

  return {
    created: result.taskId ? 1 : 0,
    orderCount: selected.length,
    skipped: result.skipped,
    taskId: result.taskId,
  };
}
