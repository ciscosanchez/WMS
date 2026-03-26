"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { transferOrderSchema, transferOrderLineSchema } from "./schemas";
import { assertTransition, TRANSFER_ORDER_TRANSITIONS } from "@/lib/workflow/transitions";

const REVALIDATE = "/inventory/transfers";

async function getContext() {
  return requireTenantContext("inventory:read");
}

export async function getTransferOrders(status?: string) {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.transferOrder.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: status ? { status: status as any } : undefined,
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTransferOrder(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await getContext();
  return tenant.db.transferOrder.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      lines: { include: { product: true } },
    },
  });
}

export async function createTransferOrder(data: unknown, lines: unknown[]) {
  if (config.useMockData)
    return { id: "mock-new", transferNumber: "TRF-MOCK-0001", status: "draft" };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const parsed = transferOrderSchema.parse(data);
  const parsedLines = lines.map((l) => transferOrderLineSchema.parse(l));

  if (parsed.fromWarehouseId === parsed.toWarehouseId) {
    throw new Error("Source and destination warehouses must be different");
  }

  const transferNumber = await nextSequence(tenant.db, "TRF");

  const transfer = await tenant.db.transferOrder.create({
    data: {
      transferNumber,
      fromWarehouseId: parsed.fromWarehouseId,
      toWarehouseId: parsed.toWarehouseId,
      status: "draft",
      requestedBy: user.id,
      notes: parsed.notes ?? null,
      lines: {
        create: parsedLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          lotNumber: l.lotNumber ?? null,
          notes: l.notes ?? null,
        })),
      },
    },
    include: { lines: true },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "transfer_order",
    entityId: transfer.id,
  });

  revalidatePath(REVALIDATE);
  return transfer;
}

export async function updateTransferStatus(id: string, status: string) {
  if (config.useMockData) return { id, status };

  const { user, tenant } = await requireTenantContext("inventory:write");

  const existing = await tenant.db.transferOrder.findUniqueOrThrow({
    where: { id },
  });

  assertTransition("transfer_order", existing.status, status, TRANSFER_ORDER_TRANSITIONS);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { status };

  if (status === "approved") {
    updateData.approvedBy = user.id;
    updateData.approvedAt = new Date();
  } else if (status === "in_transit") {
    updateData.shippedAt = new Date();
  } else if (status === "received") {
    updateData.receivedAt = new Date();
  }

  const updated = await tenant.db.transferOrder.update({
    where: { id },
    data: updateData,
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "transfer_order",
    entityId: id,
    changes: { status: { old: existing.status, new: status } },
  });

  revalidatePath(REVALIDATE);
  return updated;
}

export async function deleteTransferOrder(id: string) {
  if (config.useMockData) return { id, deleted: true };

  const { user, tenant } = await requireTenantContext("inventory:write");

  const existing = await tenant.db.transferOrder.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "draft") {
    throw new Error("Only draft transfer orders can be deleted");
  }

  await tenant.db.transferOrderLine.deleteMany({ where: { transferOrderId: id } });
  await tenant.db.transferOrder.delete({ where: { id } });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "transfer_order",
    entityId: id,
  });

  revalidatePath(REVALIDATE);
  return { id, deleted: true };
}
