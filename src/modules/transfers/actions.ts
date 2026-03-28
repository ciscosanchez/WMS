"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAccessibleWarehouseIds } from "@/lib/auth/rbac";
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

  const { tenant, role, warehouseAccess } = await getContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  return tenant.db.transferOrder.findMany({
    where: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(status ? { status: status as any } : {}),
      // Restrict to transfers involving at least one accessible warehouse
      ...(accessibleIds !== null
        ? {
            OR: [
              { fromWarehouseId: { in: accessibleIds } },
              { toWarehouseId: { in: accessibleIds } },
            ],
          }
        : {}),
    },
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

  const { tenant, role, warehouseAccess } = await getContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  const transfer = await tenant.db.transferOrder.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      lines: { include: { product: true } },
    },
  });

  if (
    transfer &&
    accessibleIds !== null &&
    !accessibleIds.includes(transfer.fromWarehouseId) &&
    !accessibleIds.includes(transfer.toWarehouseId)
  ) {
    return null;
  }

  return transfer;
}

export async function createTransferOrder(data: unknown, lines: unknown[]) {
  if (config.useMockData)
    return { id: "mock-new", transferNumber: "TRF-MOCK-0001", status: "draft" };

  const { user, tenant, role, warehouseAccess } = await requireTenantContext("inventory:write");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  const parsed = transferOrderSchema.parse(data);
  const parsedLines = lines.map((l) => transferOrderLineSchema.parse(l));

  if (
    accessibleIds !== null &&
    (!accessibleIds.includes(parsed.fromWarehouseId) ||
      !accessibleIds.includes(parsed.toWarehouseId))
  ) {
    throw new Error("Forbidden: cannot create a transfer for warehouses outside your access");
  }

  if (parsed.fromWarehouseId === parsed.toWarehouseId) {
    throw new Error("Source and destination warehouses must be different");
  }
  if (parsedLines.length === 0) {
    throw new Error("At least one transfer line is required");
  }

  const warehouseIds = [parsed.fromWarehouseId, parsed.toWarehouseId];
  const warehouses = await tenant.db.warehouse.findMany({
    where: { id: { in: warehouseIds } },
    select: { id: true },
  });
  if (warehouses.length !== 2) {
    throw new Error("Both source and destination warehouses must exist");
  }

  const productIds = [...new Set(parsedLines.map((line) => line.productId))];
  const products = await tenant.db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  if (products.length !== productIds.length) {
    throw new Error("One or more transfer products could not be found");
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

  const { user, tenant, role, warehouseAccess } = await requireTenantContext("inventory:write");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  const existing = await tenant.db.transferOrder.findUniqueOrThrow({
    where: { id },
  });

  if (
    accessibleIds !== null &&
    !accessibleIds.includes(existing.fromWarehouseId) &&
    !accessibleIds.includes(existing.toWarehouseId)
  ) {
    throw new Error("Forbidden: transfer is outside your warehouse access");
  }

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

  const { user, tenant, role, warehouseAccess } = await requireTenantContext("inventory:write");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  const existing = await tenant.db.transferOrder.findUniqueOrThrow({ where: { id } });

  if (
    accessibleIds !== null &&
    !accessibleIds.includes(existing.fromWarehouseId) &&
    !accessibleIds.includes(existing.toWarehouseId)
  ) {
    throw new Error("Forbidden: transfer is outside your warehouse access");
  }

  if (existing.status !== "draft") {
    throw new Error("Only draft transfer orders can be deleted");
  }

  await tenant.db.$transaction([
    tenant.db.transferOrderLine.deleteMany({ where: { transferOrderId: id } }),
    tenant.db.transferOrder.delete({ where: { id } }),
  ]);

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "transfer_order",
    entityId: id,
  });

  revalidatePath(REVALIDATE);
  return { id, deleted: true };
}
