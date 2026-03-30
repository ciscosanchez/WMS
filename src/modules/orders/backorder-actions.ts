"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { assertTransition, ORDER_TRANSITIONS } from "@/lib/workflow/transitions";
import { asTenantDb } from "@/lib/tenant/db-types";
import { paginateQuery, buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";

async function getReadContext() {
  return requireTenantContext("orders:read");
}

async function getWriteContext() {
  return requireTenantContext("orders:write");
}

type BackorderedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  shipToName: string;
  createdAt: Date;
  lines: Array<{
    id: string;
    productId: string;
    quantity: number;
    product: { sku: string; name: string };
  }>;
  picks: Array<{
    id: string;
    lines: Array<{ productId: string; quantity: number }>;
  }>;
};

/**
 * Returns paginated orders currently in `backordered` status, including their
 * lines and any existing pick tasks (to identify which lines are already allocated).
 * Portal users only see backorders for their bound client.
 */
export async function getBackorders(opts?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<BackorderedOrder>> {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 25;

  if (config.useMockData) {
    return buildPaginatedResult<BackorderedOrder>([], 0, page, pageSize);
  }

  const { tenant, portalClientId } = await getReadContext();
  const db = asTenantDb(tenant.db);

  // Portal users may only see backorders for their bound client
  const whereClause: Record<string, unknown> = { status: "backordered" };
  if (portalClientId) {
    whereClause.clientId = portalClientId;
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where: whereClause,
      include: {
        lines: {
          include: { product: { select: { sku: true, name: true } } },
        },
        picks: {
          include: {
            lines: { select: { productId: true, quantity: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      ...paginateQuery(page, pageSize),
    }),
    db.order.count({ where: whereClause }),
  ]);

  return buildPaginatedResult(orders as unknown as BackorderedOrder[], total, page, pageSize);
}

type FulfillmentCheckLine = {
  productId: string;
  quantity: number;
  hasInventory: boolean;
  availableQty: number;
};

type FulfillmentCheckResult = {
  orderId: string;
  orderNumber: string;
  canFulfillAll: boolean;
  canFulfillSome: boolean;
  lines: FulfillmentCheckLine[];
};

/**
 * Checks whether backordered lines on the given order now have sufficient
 * inventory. Returns a per-line breakdown showing availability.
 */
export async function checkBackorderFulfillment(orderId: string): Promise<FulfillmentCheckResult> {
  if (config.useMockData) {
    return {
      orderId,
      orderNumber: "ORD-MOCK",
      canFulfillAll: false,
      canFulfillSome: false,
      lines: [],
    };
  }

  const { tenant } = await getReadContext();
  const db = asTenantDb(tenant.db);

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      lines: true,
      picks: {
        include: {
          lines: { select: { productId: true, quantity: true } },
        },
      },
    },
  });

  // Determine which product+quantity combos are already in a pick task
  const alreadyAllocated = new Map<string, number>();
  for (const pick of order.picks) {
    for (const pl of pick.lines) {
      const prev = alreadyAllocated.get(pl.productId) ?? 0;
      alreadyAllocated.set(pl.productId, prev + pl.quantity);
    }
  }

  // For each order line, check if it still needs allocation and if inventory exists
  const lineChecks: FulfillmentCheckLine[] = [];

  for (const line of order.lines) {
    const allocatedQty = alreadyAllocated.get(line.productId) ?? 0;
    const neededQty = line.quantity - allocatedQty;

    if (neededQty <= 0) {
      // This line is already fully allocated
      lineChecks.push({
        productId: line.productId,
        quantity: line.quantity,
        hasInventory: true,
        availableQty: line.quantity,
      });
      continue;
    }

    // Check current available inventory for this product
    const inventoryRecords = await db.inventory.findMany({
      where: { productId: line.productId },
      select: { available: true },
    });

    const totalAvailable = inventoryRecords.reduce(
      (sum: number, inv: { available: number }) => sum + inv.available,
      0
    );

    lineChecks.push({
      productId: line.productId,
      quantity: line.quantity,
      hasInventory: totalAvailable >= neededQty,
      availableQty: totalAvailable,
    });
  }

  const unallocatedLines = lineChecks.filter(
    (l) => (alreadyAllocated.get(l.productId) ?? 0) < l.quantity
  );
  const canFulfillAll = unallocatedLines.every((l) => l.hasInventory);
  const canFulfillSome = unallocatedLines.some((l) => l.hasInventory);

  return {
    orderId,
    orderNumber: order.orderNumber,
    canFulfillAll,
    canFulfillSome,
    lines: lineChecks,
  };
}

/**
 * Attempts to allocate inventory for previously backordered lines on a given
 * order. If all remaining lines can be allocated, the order transitions to
 * `picking`. If only some can be allocated, it stays `backordered` with an
 * additional pick task for the newly-allocable lines. If none can be
 * allocated, throws an error.
 */
export async function retryBackorderAllocation(orderId: string) {
  if (config.useMockData) return { orderId, status: "picking" };

  const { user, tenant } = await getWriteContext();
  const db = asTenantDb(tenant.db);

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      lines: { include: { product: true } },
      picks: {
        include: {
          lines: { select: { productId: true, quantity: true } },
        },
      },
    },
  });

  if (order.status !== "backordered") {
    throw new Error(
      `Order ${order.orderNumber} is not backordered (current status: ${order.status})`
    );
  }

  // Determine which lines still need allocation
  const alreadyAllocated = new Map<string, number>();
  for (const pick of order.picks) {
    for (const pl of pick.lines) {
      const prev = alreadyAllocated.get(pl.productId) ?? 0;
      alreadyAllocated.set(pl.productId, prev + pl.quantity);
    }
  }

  const unallocatedLines = order.lines.filter((line: { productId: string; quantity: number }) => {
    const allocatedQty = alreadyAllocated.get(line.productId) ?? 0;
    return line.quantity - allocatedQty > 0;
  });

  if (unallocatedLines.length === 0) {
    // Everything is already allocated — just move to picking
    assertTransition("order", order.status, "picking", ORDER_TRANSITIONS);
    await db.order.update({
      where: { id: orderId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: "picking" as any },
    });
    revalidatePath("/orders");
    return { orderId, status: "picking", newlyAllocated: 0, stillBackordered: 0 };
  }

  // Try to allocate each unallocated line
  const taskNumber = await nextSequence(tenant.db, "PICK");
  const result = await db.$transaction(
    async (
      prisma: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    ) => {
      const lineData: Array<{
        productId: string;
        binId: string;
        quantity: number;
        pickedQty: number;
      }> = [];
      const allocated: string[] = [];
      const stillBackordered: string[] = [];

      for (const line of unallocatedLines) {
        const allocatedQty = alreadyAllocated.get(line.productId) ?? 0;
        const neededQty = line.quantity - allocatedQty;

        const inv = await prisma.inventory.findFirst({
          where: { productId: line.productId, available: { gte: neededQty } },
          orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { available: "desc" }],
        });

        if (inv) {
          await prisma.inventory.update({
            where: { id: inv.id },
            data: {
              allocated: { increment: neededQty },
              available: { decrement: neededQty },
            },
          });

          await prisma.inventoryTransaction.create({
            data: {
              type: "allocate",
              productId: line.productId,
              fromBinId: inv.binId,
              quantity: neededQty,
              referenceType: "order",
              referenceId: orderId,
              performedBy: user.id,
            },
          });

          lineData.push({
            productId: line.productId,
            binId: inv.binId,
            quantity: neededQty,
            pickedQty: 0,
          });
          allocated.push(line.productId);
        } else {
          stillBackordered.push(line.productId);
        }
      }

      let task = null;
      if (lineData.length > 0) {
        task = await prisma.pickTask.create({
          data: {
            taskNumber,
            orderId,
            method: "single_order",
            status: "pending",
            lines: { create: lineData },
          },
        });
      }

      return { task, allocated, stillBackordered };
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typed = result as any;
  if (typed.allocated.length === 0) {
    throw new Error(
      `No inventory available for any backordered lines on order ${order.orderNumber}`
    );
  }

  // Determine final order status
  const newStatus = typed.stillBackordered.length === 0 ? "picking" : "backordered";

  if (newStatus === "picking") {
    assertTransition("order", order.status, "picking", ORDER_TRANSITIONS);
  }
  // If still backordered, status stays the same — no transition needed

  await db.order.update({
    where: { id: orderId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: newStatus as any },
  });

  if (typed.task) {
    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "pick_task",
      entityId: typed.task.id,
      changes: {
        source: { old: null, new: "backorder_retry" },
      },
    });
  }

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "order",
    entityId: orderId,
    changes: {
      status: { old: "backordered", new: newStatus },
    },
  });

  revalidatePath("/orders");
  revalidatePath("/picking");

  return {
    orderId,
    status: newStatus,
    newlyAllocated: typed.allocated.length,
    stillBackordered: typed.stillBackordered.length,
  };
}
