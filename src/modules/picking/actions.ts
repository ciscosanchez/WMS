"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { asTenantDb } from "@/lib/tenant/db-types";

async function getContext() {
  return requireTenantContext("orders:read");
}

async function getWriteContext() {
  return requireTenantContext("orders:write");
}

export async function getPickTasks() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();

  const tasks = await tenant.db.pickTask.findMany({
    include: {
      order: { select: { orderNumber: true } },
      lines: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map(
    (t: {
      id: string;
      taskNumber: string;
      method: string;
      status: string;
      assignedTo: string | null;
      orderId: string | null;
      order: { orderNumber: string } | null;
      lines: Array<unknown>;
      startedAt: Date | null;
      completedAt: Date | null;
    }) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      method: t.method,
      status: t.status,
      assignedTo: t.assignedTo,
      orderId: t.orderId,
      orderNumber: t.order?.orderNumber ?? "-",
      items: t.lines.length,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
    })
  );
}

export async function getPickingKpis() {
  if (config.useMockData) return { pending: 0, inProgress: 0, completedToday: 0, shortPicked: 0 };

  const { tenant } = await getContext();
  const db = tenant.db;
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [pending, inProgress, completedToday, shortPicked] = await Promise.all([
    db.pickTask.count({ where: { status: "pending" } }),
    db.pickTask.count({ where: { status: "in_progress" } }),
    db.pickTask.count({ where: { status: "completed", completedAt: { gte: todayStart } } }),
    db.pickTask.count({ where: { status: "short_picked" } }),
  ]);

  return { pending, inProgress, completedToday, shortPicked };
}

type PickTaskMethod = "single_order" | "batch" | "wave" | "zone";

type EligibleOrder = {
  id: string;
  status: string;
  lines: Array<{ id: string; productId: string; quantity: number }>;
};

async function findInventoryForOrderLine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  line: { productId: string; quantity: number }
) {
  return prisma.inventory.findFirst({
    where: { productId: line.productId, available: { gte: line.quantity } },
    orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { available: "desc" }],
  });
}

async function createPickTaskForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  order: EligibleOrder,
  userId: string,
  method: PickTaskMethod
) {
  const taskNumber = await nextSequence(db, "PICK");

  const task = await db.$transaction(
    async (
      prisma: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    ) => {
      const lineData = [];

      for (const line of order.lines) {
        const inventory = await findInventoryForOrderLine(prisma, line);
        let claimedInventory = inventory;

        if (inventory) {
          const updated = await prisma.inventory.updateMany({
            where: {
              id: inventory.id,
              available: { gte: line.quantity },
            },
            data: {
              allocated: { increment: line.quantity },
              available: { decrement: line.quantity },
            },
          });

          if (updated.count === 0) {
            claimedInventory = null;
          }
        }

        if (claimedInventory) {
          await prisma.inventoryTransaction.create({
            data: {
              type: "allocate",
              productId: line.productId,
              fromBinId: claimedInventory.binId,
              quantity: line.quantity,
              referenceType: "order",
              referenceId: order.id,
              performedBy: userId,
            },
          });
        } else {
          throw new Error(`Insufficient available inventory for product ${line.productId}`);
        }

        lineData.push({
          productId: line.productId,
          binId: claimedInventory.binId,
          quantity: line.quantity,
          pickedQty: 0,
        });
      }

      return prisma.pickTask.create({
        data: {
          taskNumber,
          orderId: order.id,
          method,
          status: "pending",
          lines: { create: lineData },
        },
      });
    }
  );

  await logAudit(db, {
    userId,
    action: "create",
    entityType: "pick_task",
    entityId: task.id,
    changes: {
      source: { old: null, new: method === "wave" ? "wave_generation" : "manual_generation" },
    },
  });

  return task;
}

async function generatePickTasksForEligibleOrders(method: PickTaskMethod) {
  if (config.useMockData) return { created: 0, skipped: 0 };

  const { user, tenant } = await getWriteContext();
  const db = asTenantDb(tenant.db);

  const eligibleOrders = (await db.order.findMany({
    where: {
      status: { in: ["pending", "confirmed", "allocated"] },
      picks: { none: {} },
    },
    include: {
      lines: {
        select: {
          id: true,
          productId: true,
          quantity: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })) as EligibleOrder[];

  if (eligibleOrders.length === 0) {
    return { created: 0, skipped: 0 };
  }

  let created = 0;
  let skipped = 0;

  for (const order of eligibleOrders) {
    if (!order.lines.length) {
      skipped += 1;
      continue;
    }

    try {
      await createPickTaskForOrder(db, order, user.id, method);
      await db.order.update({
        where: { id: order.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { status: "picking" as any },
      });
      created += 1;
    } catch {
      skipped += 1;
    }
  }

  revalidatePath("/picking");
  revalidatePath("/orders");

  return { created, skipped };
}

export async function generatePickTasks() {
  return generatePickTasksForEligibleOrders("single_order");
}

export async function createWave() {
  return generatePickTasksForEligibleOrders("wave");
}
