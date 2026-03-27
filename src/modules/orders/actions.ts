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
import { createDispatchOrder } from "@/lib/integrations/dispatchpro/client";
import { assertTransition, ORDER_TRANSITIONS } from "@/lib/workflow/transitions";
import { asTenantDb } from "@/lib/tenant/db-types";
import { saveOperationalAttributeValuesForEntity } from "@/modules/attributes/value-service";
import { convertQuantityToBaseUom } from "@/modules/products/uom";

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

  // When transitioning to "picking", generate pick tasks BEFORE updating status.
  // If pick task generation fails, the order stays in its current state.
  if (status === "picking") {
    await generatePickTasksForOrder(tenant.db, existing, user.id);
  }

  const order = await tenant.db.order.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: status as any },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "order",
    entityId: id,
    changes: { status: { old: existing.status, new: status } },
  });

  // When order is packed, send to DispatchPro for dispatch
  if (status === "packed") {
    const dispatchResult = await createDispatchOrder({
      tenantSlug: tenant.slug,
      wmsOrderId: existing.id,
      wmsOrderNumber: existing.orderNumber,
      customer: existing.shipToName,
      address: existing.shipToAddress1,
      city: existing.shipToCity,
      state: existing.shipToState ?? "",
      zip: existing.shipToZip,
      items: existing.lines.map(
        (line: { product: { sku: string; name: string; weight: unknown }; quantity: number }) => ({
          sku: line.product.sku,
          description: line.product.name,
          quantity: line.quantity,
          weight: line.product.weight ? Number(line.product.weight) : undefined,
        })
      ),
    });

    if ("error" in dispatchResult) {
      // Log but don't block — order status is already updated
      console.error("[DispatchPro] Failed to create dispatch order:", dispatchResult.error);
    }
  }

  revalidatePath("/orders");
  return order;
}

/** Internal helper — creates a PickTask + PickTaskLines for an order and allocates inventory. */
async function generatePickTasksForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  order: { id: string; lines: Array<{ productId: string; quantity: number; id: string }> },
  userId: string
) {
  const taskNumber = await nextSequence(db, "PICK");

  // Atomic: find bins, allocate inventory, create pick task in one transaction
  const task = await db.$transaction(
    async (
      prisma: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    ) => {
      const lineData = [];

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
        }

        lineData.push({
          productId: line.productId,
          binId: inv?.binId ?? null,
          quantity: line.quantity,
          pickedQty: 0,
        });
      }

      // Sort lines by bin barcode for optimal pick path (zone → aisle → rack → shelf → bin)
      // Resolve barcodes for sorting — bin IDs are cuid strings, barcodes encode location
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
        const aKey = (a.binId && binBarcodeMap.get(a.binId)) ?? "zzz";
        const bKey = (b.binId && binBarcodeMap.get(b.binId)) ?? "zzz";
        return aKey.localeCompare(bKey);
      });

      return prisma.pickTask.create({
        data: {
          taskNumber,
          orderId: order.id,
          method: "single_order",
          status: "pending",
          lines: { create: sortedLines },
        },
      });
    }
  );

  await logAudit(db, {
    userId,
    action: "create",
    entityType: "pick_task",
    entityId: task.id,
    changes: { source: { old: null, new: "auto_generated" } },
  });
}

type RawOperationalAttributeValue = {
  definition: { key: string };
  textValue?: string | null;
  numberValue?: number | null;
  booleanValue?: boolean | null;
  dateValue?: Date | null;
  jsonValue?: unknown;
};

type RawOperationalAttributeValueWithEntityId = RawOperationalAttributeValue & {
  entityId: string;
  definition: { key: string; label: string };
};

function attributeValueToDisplay(value: RawOperationalAttributeValue) {
  if (value.numberValue !== null && value.numberValue !== undefined)
    return String(value.numberValue);
  if (value.booleanValue !== null && value.booleanValue !== undefined)
    return value.booleanValue ? "Yes" : "No";
  if (value.dateValue) return value.dateValue.toISOString().slice(0, 10);
  if (value.jsonValue !== null && value.jsonValue !== undefined) {
    if (Array.isArray(value.jsonValue)) return value.jsonValue.map(String).join(", ");
    return JSON.stringify(value.jsonValue);
  }
  return value.textValue ?? "";
}

function attributeValueToComparable(value: RawOperationalAttributeValue) {
  if (value.booleanValue !== null && value.booleanValue !== undefined)
    return value.booleanValue ? "true" : "false";
  if (value.dateValue) return value.dateValue.toISOString();
  if (value.jsonValue !== null && value.jsonValue !== undefined) {
    if (Array.isArray(value.jsonValue)) {
      return JSON.stringify([...value.jsonValue].map(String).sort());
    }
    return JSON.stringify(value.jsonValue);
  }
  return attributeValueToDisplay(value);
}

async function findInventoryForOrderLine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  line: { id: string; productId: string; quantity: number }
) {
  const criteria = ((await prisma.operationalAttributeValue.findMany({
    where: {
      entityScope: "order_line",
      entityId: line.id,
    },
    include: {
      definition: { select: { key: true } },
    },
  })) ?? []) as RawOperationalAttributeValue[];

  if (criteria.length === 0) {
    return prisma.inventory.findFirst({
      where: { productId: line.productId, available: { gte: line.quantity } },
      orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { available: "desc" }],
    });
  }

  const targetDefinitions = ((await prisma.operationalAttributeDefinition.findMany({
    where: {
      entityScope: "inventory_record",
      isActive: true,
      key: { in: criteria.map((item) => item.definition.key) },
    },
    select: { id: true, key: true },
  })) ?? []) as Array<{ id: string; key: string }>;

  if (targetDefinitions.length === 0) return null;

  const targetByKey = new Map(
    targetDefinitions.map((definition) => [definition.key, definition.id])
  );
  const candidateInventory = ((await prisma.inventory.findMany({
    where: { productId: line.productId, available: { gte: line.quantity } },
    orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { available: "desc" }],
  })) ?? []) as Array<{ id: string }>;

  for (const inventoryRecord of candidateInventory) {
    const inventoryValues = ((await prisma.operationalAttributeValue.findMany({
      where: {
        entityScope: "inventory_record",
        entityId: inventoryRecord.id,
        definitionId: { in: targetDefinitions.map((definition) => definition.id) },
      },
      include: {
        definition: { select: { key: true } },
      },
    })) ?? []) as RawOperationalAttributeValue[];

    const inventoryByKey = new Map(
      inventoryValues.map((value) => [value.definition.key, attributeValueToComparable(value)])
    );

    const matchesAllCriteria = criteria.every((criterion) => {
      const targetDefinitionId = targetByKey.get(criterion.definition.key);
      if (!targetDefinitionId) return false;
      return inventoryByKey.get(criterion.definition.key) === attributeValueToComparable(criterion);
    });

    if (matchesAllCriteria) {
      return inventoryRecord;
    }
  }

  return null;
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
