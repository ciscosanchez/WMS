"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { resolveTenant } from "@/lib/tenant/context";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import {
  inboundShipmentSchema,
  shipmentLineSchema,
  receiveLineSchema,
  discrepancySchema,
} from "./schemas";
import { mockShipments } from "@/lib/mock-data";

async function getContext() {
  const [user, tenant] = await Promise.all([requireAuth(), resolveTenant()]);
  if (!tenant) throw new Error("Tenant not found");
  return { user, tenant };
}

export async function getShipments(status?: string) {
  if (config.useMockData)
    return status ? mockShipments.filter((s) => s.status === status) : mockShipments;

  const { tenant } = await getContext();
  return tenant.db.inboundShipment.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      client: true,
      lines: { include: { product: true } },
      _count: { select: { lines: true, transactions: true, discrepancies: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getShipment(id: string) {
  if (config.useMockData) return mockShipments.find((s) => s.id === id) ?? null;

  const { tenant } = await getContext();
  return tenant.db.inboundShipment.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { include: { product: true, transactions: true } },
      transactions: { include: { bin: true, line: { include: { product: true } } } },
      discrepancies: true,
      documents: true,
    },
  });
}

export async function createShipment(data: unknown) {
  if (config.useMockData)
    return { id: "mock-new", shipmentNumber: "ASN-MOCK-0001", ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = inboundShipmentSchema.parse(data);

  const shipmentNumber = await nextSequence(tenant.db, "ASN");

  const shipment = await tenant.db.inboundShipment.create({
    data: {
      ...parsed,
      shipmentNumber,
      status: "draft",
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "inbound_shipment",
    entityId: shipment.id,
  });

  revalidatePath("/receiving");
  return shipment;
}

export async function addShipmentLine(shipmentId: string, data: unknown) {
  if (config.useMockData) return { id: "mock-new", shipmentId, ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = shipmentLineSchema.parse(data);

  const line = await tenant.db.inboundShipmentLine.create({
    data: { shipmentId, ...parsed },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "inbound_shipment_line",
    entityId: line.id,
  });

  revalidatePath("/receiving");
  return line;
}

export async function updateShipmentStatus(
  id: string,
  status: "expected" | "arrived" | "receiving" | "inspection" | "completed" | "cancelled"
) {
  if (config.useMockData) return { id, status };

  const { user, tenant } = await getContext();

  const updateData: Record<string, unknown> = { status };
  if (status === "arrived") updateData.arrivedDate = new Date();
  if (status === "completed") updateData.completedDate = new Date();

  const shipment = await tenant.db.inboundShipment.update({
    where: { id },
    data: updateData,
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "inbound_shipment",
    entityId: id,
    changes: { status: { old: null, new: status } },
  });

  // If completed, create inventory records
  if (status === "completed") {
    await finalizeReceiving(tenant, id, user.id);
  }

  revalidatePath("/receiving");
  return shipment;
}

export async function receiveLine(shipmentId: string, data: unknown) {
  if (config.useMockData) return { id: "mock-new", shipmentId, ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = receiveLineSchema.parse(data);

  const transaction = await tenant.db.receivingTransaction.create({
    data: {
      shipmentId,
      lineId: parsed.lineId,
      binId: parsed.binId || null,
      quantity: parsed.quantity,
      condition: parsed.condition,
      lotNumber: parsed.lotNumber || null,
      serialNumber: parsed.serialNumber || null,
      receivedBy: user.id,
      notes: parsed.notes || null,
    },
  });

  // Update received qty on line
  await tenant.db.inboundShipmentLine.update({
    where: { id: parsed.lineId },
    data: { receivedQty: { increment: parsed.quantity } },
  });

  // Update shipment status to receiving if still in arrived
  await tenant.db.inboundShipment.updateMany({
    where: { id: shipmentId, status: "arrived" },
    data: { status: "receiving" },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "receiving_transaction",
    entityId: transaction.id,
  });

  revalidatePath("/receiving");
  return transaction;
}

async function finalizeReceiving(
  tenant: Awaited<ReturnType<typeof resolveTenant>> & {},
  shipmentId: string,
  userId: string
) {
  const transactions = await tenant.db.receivingTransaction.findMany({
    where: { shipmentId },
    include: { line: true },
  });

  for (const tx of transactions) {
    if (!tx.binId) continue;

    // Upsert inventory record
    const existing = await tenant.db.inventory.findFirst({
      where: {
        productId: tx.line.productId,
        binId: tx.binId,
        lotNumber: tx.lotNumber,
        serialNumber: tx.serialNumber,
      },
    });

    if (existing) {
      const newOnHand = existing.onHand + tx.quantity;
      await tenant.db.inventory.update({
        where: { id: existing.id },
        data: {
          onHand: newOnHand,
          available: newOnHand - existing.allocated,
        },
      });
    } else {
      await tenant.db.inventory.create({
        data: {
          productId: tx.line.productId,
          binId: tx.binId,
          lotNumber: tx.lotNumber,
          serialNumber: tx.serialNumber,
          onHand: tx.quantity,
          allocated: 0,
          available: tx.quantity,
        },
      });
    }

    // Log inventory transaction
    await tenant.db.inventoryTransaction.create({
      data: {
        type: "receive",
        productId: tx.line.productId,
        toBinId: tx.binId,
        quantity: tx.quantity,
        lotNumber: tx.lotNumber,
        serialNumber: tx.serialNumber,
        referenceType: "shipment",
        referenceId: shipmentId,
        performedBy: userId,
      },
    });
  }
}

export async function createDiscrepancy(data: unknown) {
  if (config.useMockData) return { id: "mock-new", ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = discrepancySchema.parse(data);

  const disc = await tenant.db.receivingDiscrepancy.create({
    data: parsed,
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "receiving_discrepancy",
    entityId: disc.id,
  });

  revalidatePath("/receiving");
  return disc;
}

export async function resolveDiscrepancy(id: string, resolution: string) {
  if (config.useMockData) return { id, status: "resolved", resolution };

  const { user, tenant } = await getContext();

  const disc = await tenant.db.receivingDiscrepancy.update({
    where: { id },
    data: {
      status: "resolved",
      resolution,
      resolvedBy: user.id,
      resolvedAt: new Date(),
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "receiving_discrepancy",
    entityId: id,
    changes: { status: { old: "open", new: "resolved" } },
  });

  revalidatePath("/receiving");
  return disc;
}
