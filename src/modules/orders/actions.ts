"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { orderSchema, orderLineSchema } from "./schemas";
import { mockOrders } from "@/lib/mock-data";
import { createDispatchOrder } from "@/lib/integrations/dispatchpro/client";

async function getContext() {
  return requireTenantContext();
}

export async function getOrders(status?: string) {
  if (config.useMockData)
    return status ? mockOrders.filter((o) => o.status === status) : mockOrders;

  const { tenant } = await getContext();
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

  const { tenant } = await getContext();
  return tenant.db.order.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { include: { product: true } },
      shipments: true,
      picks: true,
    },
  });
}

export async function createOrder(data: unknown, lines: unknown[]) {
  if (config.useMockData)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { id: "mock-new", orderNumber: "ORD-MOCK-0001", ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = orderSchema.parse(data);
  const parsedLines = lines.map((l) => orderLineSchema.parse(l));

  const orderNumber = await nextSequence(tenant.db, "ORD");

  const order = await tenant.db.order.create({
    data: {
      ...parsed,
      orderNumber,
      status: "pending",
      lines: {
        create: parsedLines,
      },
    },
    include: {
      lines: true,
    },
  });

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

  const { user, tenant } = await getContext();

  // Fetch order before update so we have full data for dispatch
  const existing = await tenant.db.order.findUnique({
    where: { id },
    include: { lines: { include: { product: true } } },
  });

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
    changes: { status: { old: existing?.status ?? null, new: status } },
  });

  // When order is packed, send to DispatchPro for dispatch
  if (status === "packed" && existing) {
    const dispatchResult = await createDispatchOrder({
      tenantSlug: tenant.slug,
      wmsOrderId: existing.id,
      wmsOrderNumber: existing.orderNumber,
      customer: existing.shipToName,
      address: existing.shipToAddress1,
      city: existing.shipToCity,
      state: existing.shipToState ?? "",
      zip: existing.shipToZip,
      items: existing.lines.map((line) => ({
        sku: line.product.sku,
        description: line.product.name,
        quantity: line.quantity,
        weight: line.product.weight ? Number(line.product.weight) : undefined,
      })),
    });

    if ("error" in dispatchResult) {
      // Log but don't block — order status is already updated
      console.error("[DispatchPro] Failed to create dispatch order:", dispatchResult.error);
    }
  }

  revalidatePath("/orders");
  return order;
}

export async function deleteOrder(id: string) {
  if (config.useMockData) return { id, deleted: true };

  const { user, tenant } = await getContext();

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
