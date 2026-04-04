"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import {
  orderSchemaStatic as orderSchema,
  orderLineSchemaStatic as orderLineSchema,
} from "./schemas";
import { mockOrders } from "@/lib/mock-data";
import { assertTransition, ORDER_TRANSITIONS } from "@/lib/workflow/transitions";
import { asTenantDb } from "@/lib/tenant/db-types";
import { saveOperationalAttributeValuesForEntity } from "@/modules/attributes/value-service";
import { convertQuantityToBaseUom } from "@/modules/products/uom";
import {
  findInventoryForOrderLine,
  attributeValueToDisplay,
  type RawOperationalAttributeValueWithEntityId,
} from "./inventory-matching";

async function getReadContext() {
  return requireTenantContext("orders:read");
}

export async function getOrders(status?: string) {
  if (config.useMockData)
    return status ? mockOrders.filter((o) => o.status === status) : mockOrders;

  const { tenant } = await getReadContext();
  return tenant.db.order.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: status ? { status: status as any } : undefined,
    include: {
      client: true,
      lines: { include: { product: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrder(id: string) {
  if (config.useMockData) return mockOrders.find((o) => o.id === id) ?? null;

  const { tenant } = await getReadContext();
  const db = asTenantDb(tenant.db);
  const order = await db.order.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { include: { product: true } },
      shipments: true,
      picks: true,
    },
  });

  if (!order || !order.lines?.length) return order;

  const lineIds = order.lines.map((line: { id: string }) => line.id);
  const attributeValues = (await db.operationalAttributeValue.findMany({
    where: {
      entityScope: "order_line",
      entityId: { in: lineIds },
    },
    include: {
      definition: { select: { key: true, label: true } },
    },
    orderBy: [{ definition: { sortOrder: "asc" } }, { createdAt: "asc" }],
  })) as RawOperationalAttributeValueWithEntityId[];

  const attributesByLineId = attributeValues.reduce<
    Record<string, Array<{ key: string; label: string; value: string }>>
  >((acc, value) => {
    if (!acc[value.entityId]) acc[value.entityId] = [];
    acc[value.entityId].push({
      key: value.definition.key,
      label: value.definition.label,
      value: attributeValueToDisplay(value),
    });
    return acc;
  }, {});

  return {
    ...order,
    lines: order.lines.map((line: { id: string }) => ({
      ...line,
      operationalAttributes: attributesByLineId[line.id] ?? [],
    })),
  };
}

export async function createOrder(data: unknown, lines: unknown[]) {
  if (config.useMockData)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { id: "mock-new", orderNumber: "ORD-MOCK-0001", ...(data as any) };

  const { user, tenant } = await requireTenantContext("orders:write");
  const db = asTenantDb(tenant.db);
  const parsed = orderSchema.parse(data);
  const parsedLines = lines.map((l) => orderLineSchema.parse(l));

  const orderNumber = await nextSequence(tenant.db, "ORD");

  const order = (await db.$transaction(async (tx) => {
    const prisma = asTenantDb(tx);
    const createdOrder = await prisma.order.create({
      data: {
        ...parsed,
        orderNumber,
        status: "pending",
      },
    });

    const createdLines = [];
    for (const parsedLine of parsedLines) {
      const { operationalAttributes = [], ...lineData } = parsedLine;
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: parsedLine.productId },
        select: {
          id: true,
          baseUom: true,
          unitsPerCase: true,
          uomConversions: {
            select: {
              fromUom: true,
              toUom: true,
              factor: true,
            },
          },
        },
      });
      const resolvedQuantity = convertQuantityToBaseUom(
        product,
        parsedLine.quantity,
        parsedLine.uom
      );
      const createdLine = await prisma.orderLine.create({
        data: {
          orderId: createdOrder.id,
          ...lineData,
          quantity: resolvedQuantity.baseQuantity,
          uom: resolvedQuantity.baseUom,
        },
      });

      await saveOperationalAttributeValuesForEntity({
        db: prisma,
        userId: user.id,
        entityScope: "order_line",
        entityId: createdLine.id,
        values: operationalAttributes,
      });

      createdLines.push(createdLine);
    }

    return {
      ...createdOrder,
      lines: createdLines,
    };
  })) as {
    id: string;
    orderNumber: string;
    lines: Array<{ id: string; productId: string; quantity: number }>;
  };

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "order",
    entityId: order.id,
  });

  revalidatePath("/orders");
  return order;
}

export async function updateOrderStatus(id: string, status: string) {
  if (config.useMockData) return { id, status };

  const { user, tenant } = await requireTenantContext("orders:write");

  // Fetch order before update so we have full data for dispatch + pick tasks
  const existing = await tenant.db.order.findUniqueOrThrow({
    where: { id },
    include: { lines: { include: { product: true } } },
  });

  // Validate transition before any mutations
  assertTransition("order", existing.status, status, ORDER_TRANSITIONS);

  // When cancelling an order with existing pick tasks, deallocate inventory first
  if (status === "cancelled") {
    await deallocateOrder(tenant.db, id, user.id);
  }

  // When transitioning to "picking", generate pick tasks BEFORE updating status.
  // Supports partial allocation: if some lines lack inventory, order goes to "backordered".
  let resolvedStatus = status;
  if (status === "picking") {
    const result = await generatePickTasksForOrder(tenant.db, existing, user.id, true);

    if (!result.task) {
      // No lines could be allocated at all
      throw new Error("No inventory available for any order lines");
    }

    if (result.backorderedLines.length > 0) {
      // Partial allocation — some lines are backordered
      resolvedStatus = "backordered";
      // Validate the backordered transition is allowed from current state
      assertTransition("order", existing.status, resolvedStatus, ORDER_TRANSITIONS);
    }
  }

  const order = await tenant.db.order.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: resolvedStatus as any },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "order",
    entityId: id,
    changes: { status: { old: existing.status, new: resolvedStatus } },
  });

  // When order is packed, queue DispatchPro dispatch (retryable via integrations queue)
  if (status === "packed") {
    try {
      const { integrationQueue } = await import("@/lib/jobs/queue");
      await integrationQueue.add("dispatchpro_create", {
        type: "dispatchpro_create",
        tenantSlug: tenant.slug,
        tenantId: tenant.tenantId,
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        customer: existing.shipToName,
        address: existing.shipToAddress1,
        city: existing.shipToCity,
        state: existing.shipToState ?? "",
        zip: existing.shipToZip,
        items: existing.lines.map(
          (line: {
            product: { sku: string; name: string; weight: unknown };
            quantity: number;
          }) => ({
            sku: line.product.sku,
            description: line.product.name,
            quantity: line.quantity,
            weight: line.product.weight ? Number(line.product.weight) : undefined,
          })
        ),
      });
    } catch (queueErr) {
      console.error("[DispatchPro] Failed to enqueue dispatch job:", queueErr);
    }
  }

  revalidatePath("/orders");
  return order;
}

export type SplitAllocationResult = {
  task: { id: string } | null;
  allocatedLines: Array<{ productId: string; quantity: number }>;
  backorderedLines: Array<{ productId: string; quantity: number }>;
};

/** Internal helper — creates a PickTask + PickTaskLines for an order and allocates inventory.
 *  Supports partial allocation: lines with inventory are picked, others are backordered. */
async function generatePickTasksForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  order: { id: string; lines: Array<{ productId: string; quantity: number; id: string }> },
  userId: string,
  allowPartial = false
): Promise<SplitAllocationResult> {
  const taskNumber = await nextSequence(db, "PICK");

  // Atomic: find bins, allocate inventory, create pick task in one transaction
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
      const allocatedLines: SplitAllocationResult["allocatedLines"] = [];
      const backorderedLines: SplitAllocationResult["backorderedLines"] = [];

      for (const line of order.lines) {
        const inv = await findInventoryForOrderLine(prisma, line);

        if (inv) {
          // Allocate: increment allocated, decrement available
          await prisma.inventory.update({
            where: { id: inv.id },
            data: {
              allocated: { increment: line.quantity },
              available: { decrement: line.quantity },
            },
          });

          // Write allocation ledger entry
          await prisma.inventoryTransaction.create({
            data: {
              type: "allocate",
              productId: line.productId,
              fromBinId: inv.binId,
              quantity: line.quantity,
              referenceType: "order",
              referenceId: order.id,
              performedBy: userId,
            },
          });

          lineData.push({
            productId: line.productId,
            binId: inv.binId,
            quantity: line.quantity,
            pickedQty: 0,
          });
          allocatedLines.push({ productId: line.productId, quantity: line.quantity });
        } else if (allowPartial) {
          backorderedLines.push({ productId: line.productId, quantity: line.quantity });
        } else {
          throw new Error(`Insufficient available inventory for product ${line.productId}`);
        }
      }

      if (lineData.length === 0) {
        return { task: null, allocatedLines, backorderedLines };
      }

      // Sort lines by bin barcode for optimal pick path (zone -> aisle -> rack -> shelf -> bin)
      const binIds = lineData
        .map((l: { binId: string | null }) => l.binId)
        .filter(Boolean) as string[];
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
        const aKey = String((a.binId && binBarcodeMap.get(a.binId)) ?? "zzz");
        const bKey = String((b.binId && binBarcodeMap.get(b.binId)) ?? "zzz");
        return aKey.localeCompare(bKey);
      });

      const task = await prisma.pickTask.create({
        data: {
          taskNumber,
          orderId: order.id,
          method: "single_order",
          status: "pending",
          lines: { create: sortedLines },
        },
      });

      return { task, allocatedLines, backorderedLines };
    }
  );

  if (result.task) {
    await logAudit(db, {
      userId,
      action: "create",
      entityType: "pick_task",
      entityId: result.task.id,
      changes: {
        source: { old: null, new: "auto_generated" },
        ...(result.backorderedLines.length > 0
          ? { partialAllocation: { old: null, new: result.backorderedLines.length } }
          : {}),
      },
    });
  }

  return result;
}

/**
 * Deallocate inventory for an order by reversing all pick task allocations.
 * For each pick task line: decrement allocated, increment available, write
 * a "deallocate" inventory transaction, then delete the pick tasks.
 */
async function deallocateOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  orderId: string,
  userId: string
): Promise<void> {
  const pickTasks = await db.pickTask.findMany({
    where: { orderId },
    include: { lines: true },
  });

  if (pickTasks.length === 0) return;

  await db.$transaction(
    async (
      prisma: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    ) => {
      for (const task of pickTasks) {
        for (const line of task.lines) {
          // Only deallocate lines that were allocated (have a binId)
          if (!line.binId) continue;

          // Reverse allocation: decrement allocated, increment available
          await prisma.inventory.updateMany({
            where: {
              productId: line.productId,
              binId: line.binId,
            },
            data: {
              allocated: { decrement: line.quantity },
              available: { increment: line.quantity },
            },
          });

          // Write deallocate ledger entry
          await prisma.inventoryTransaction.create({
            data: {
              type: "deallocate",
              productId: line.productId,
              fromBinId: line.binId,
              quantity: line.quantity,
              referenceType: "order",
              referenceId: orderId,
              performedBy: userId,
            },
          });
        }

        // Delete the pick task lines, then the pick task
        await prisma.pickTaskLine.deleteMany({
          where: { pickTaskId: task.id },
        });
        await prisma.pickTask.delete({ where: { id: task.id } });
      }
    }
  );

  await logAudit(db, {
    userId,
    action: "delete",
    entityType: "pick_task",
    entityId: orderId,
    changes: {
      reason: { old: null, new: "order_cancellation" },
      tasksRemoved: { old: null, new: pickTasks.length },
    },
  });
}

export async function deleteOrder(id: string) {
  if (config.useMockData) return { id, deleted: true };

  const { user, tenant } = await requireTenantContext("orders:write");

  // Delete lines first, then order
  await tenant.db.orderLine.deleteMany({ where: { orderId: id } });
  await tenant.db.order.delete({ where: { id } });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "order",
    entityId: id,
  });

  revalidatePath("/orders");
  return { id, deleted: true };
}
