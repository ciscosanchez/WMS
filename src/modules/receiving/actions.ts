"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext, type TenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import {
  inboundShipmentSchemaStatic as inboundShipmentSchema,
  shipmentLineSchemaStatic as shipmentLineSchema,
  receiveLineSchema,
  discrepancySchemaStatic as discrepancySchema,
} from "./schemas";
import { mockShipments } from "@/lib/mock-data";
import { captureEvent } from "@/modules/billing/capture";
import { assertTransition, SHIPMENT_TRANSITIONS } from "@/lib/workflow/transitions";
import { notificationQueue } from "@/lib/jobs/queue";
import { saveOperationalAttributeValuesForEntity } from "@/modules/attributes/value-service";

async function getReadContext() {
  return requireTenantContext("receiving:read");
}

export async function getShipments(status?: string) {
  if (config.useMockData)
    return status ? mockShipments.filter((s) => s.status === status) : mockShipments;

  const { tenant } = await getReadContext();
  return tenant.db.inboundShipment.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const { tenant } = await getReadContext();
  return tenant.db.inboundShipment.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { include: { product: true, transactions: true } },
      transactions: { include: { bin: true, line: { include: { product: true } } } },
      discrepancies: true,
      documents: { include: { processingJobs: true } },
    },
  });
}

export async function createShipment(data: unknown) {
  if (config.useMockData)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { id: "mock-new", shipmentNumber: "ASN-MOCK-0001", ...(data as any) };

  const { user, tenant } = await requireTenantContext("receiving:write");
  const parsed = inboundShipmentSchema.parse(data);

  const shipmentNumber = await nextSequence(tenant.db, "ASN");

  const shipment = await tenant.db.inboundShipment.create({
    data: {
      clientId: parsed.clientId,
      carrier: parsed.carrier,
      trackingNumber: parsed.trackingNumber,
      bolNumber: parsed.bolNumber,
      poNumber: parsed.poNumber,
      expectedDate: parsed.expectedDate,
      notes: parsed.notes,
      shipmentNumber,
      status: "draft",
    },
  });

  await saveOperationalAttributeValuesForEntity({
    db: tenant.db,
    userId: user.id,
    entityScope: "inbound_shipment",
    entityId: shipment.id,
    values: parsed.operationalAttributes ?? [],
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id: "mock-new", shipmentId, ...(data as any) };

  const { user, tenant } = await requireTenantContext("receiving:write");
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

  const { user, tenant } = await requireTenantContext("receiving:write");

  const current = await tenant.db.inboundShipment.findUniqueOrThrow({
    where: { id },
    select: { status: true, shipmentNumber: true },
  });

  // Validate transition before any mutations
  assertTransition("shipment", current.status, status, SHIPMENT_TRANSITIONS);

  const updateData: Record<string, unknown> = { status };
  if (status === "arrived") updateData.arrivedDate = new Date();
  if (status === "completed") updateData.completedDate = new Date();

  // Conditional update: only transition if status hasn't changed since we read it.
  // This prevents concurrent requests from both succeeding.
  const result = await tenant.db.inboundShipment.updateMany({
    where: { id, status: current.status },
    data: updateData,
  });

  if (result.count === 0) {
    throw new Error(`Shipment ${id} status was modified concurrently — please retry`);
  }

  const shipment = await tenant.db.inboundShipment.findUniqueOrThrow({
    where: { id },
    select: { id: true, shipmentNumber: true, status: true, clientId: true },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "inbound_shipment",
    entityId: id,
    changes: { status: { old: current.status, new: status } },
  });

  // If completing for the first time, create inventory records and capture billing events.
  // The conditional update above guarantees only one request reaches this point.
  if (status === "completed") {
    await finalizeReceiving(tenant, id, user.id);
    await captureBillingOnReceive(tenant, id);
  }

  // Enqueue durable notifications (retried on failure)
  if (status === "arrived") {
    const detail = await tenant.db.inboundShipment.findUnique({
      where: { id },
      include: { client: { select: { name: true } }, lines: true },
    });
    const expectedUnits =
      detail?.lines.reduce((s: number, l: { expectedQty: number }) => s + l.expectedQty, 0) ?? 0;
    await notificationQueue.add("shipment_arrived", {
      type: "warehouse_team",
      tenantId: tenant.tenantId,
      title: "Shipment Arrived",
      message: `${detail?.shipmentNumber ?? id} from ${detail?.client?.name ?? "Unknown"} — ${expectedUnits} units expected`,
      link: `/receiving/${id}`,
    });
  }

  if (status === "completed") {
    const txns = await tenant.db.receivingTransaction.findMany({ where: { shipmentId: id } });
    const totalUnits = txns.reduce((s: number, t: { quantity: number }) => s + t.quantity, 0);
    await notificationQueue.add("receiving_completed", {
      type: "warehouse_team",
      tenantId: tenant.tenantId,
      title: "Receiving Complete",
      message: `${shipment.shipmentNumber} — ${totalUnits} units received, ${txns.length} cartons`,
      link: `/receiving/${id}`,
    });
  }

  revalidatePath("/receiving");
  return shipment;
}

export async function receiveLine(shipmentId: string, data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id: "mock-new", shipmentId, ...(data as any) };

  const { user, tenant } = await requireTenantContext("receiving:write");
  const parsed = receiveLineSchema.parse(data);

  // Atomic: create receiving transaction + update line qty + transition shipment status
  const transaction = await tenant.db.$transaction(
    async (prisma: Parameters<Parameters<typeof tenant.db.$transaction>[0]>[0]) => {
      const tx = await prisma.receivingTransaction.create({
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
      await prisma.inboundShipmentLine.update({
        where: { id: parsed.lineId },
        data: { receivedQty: { increment: parsed.quantity } },
      });

      // Update shipment status to receiving if still in arrived
      await prisma.inboundShipment.updateMany({
        where: { id: shipmentId, status: "arrived" },
        data: { status: "receiving" },
      });

      return tx;
    }
  );

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "receiving_transaction",
    entityId: transaction.id,
  });

  revalidatePath("/receiving");
  return transaction;
}

async function finalizeReceiving(tenant: TenantContext, shipmentId: string, userId: string) {
  const transactions = await tenant.db.receivingTransaction.findMany({
    where: { shipmentId },
    include: { line: true },
  });

  // Atomic: upsert all inventory records + ledger entries in one transaction
  // Guard: if putaway already ran for a line, create inventory in the putaway
  // target bin instead of the receive bin (prevents duplication).
  await tenant.db.$transaction(
    async (prisma: Parameters<Parameters<typeof tenant.db.$transaction>[0]>[0]) => {
      for (const tx of transactions) {
        if (!tx.binId) continue;

        // Check if putaway already ran for this receiving transaction
        const existingPutaway = await prisma.inventoryTransaction.findFirst({
          where: {
            type: "putaway",
            referenceType: "receiving_transaction",
            referenceId: tx.id,
          },
        });

        // If putaway already ran, inventory is already in the target bin — skip
        if (existingPutaway) continue;

        // Upsert inventory record in the receive bin
        const existing = await prisma.inventory.findFirst({
          where: {
            productId: tx.line.productId,
            binId: tx.binId,
            lotNumber: tx.lotNumber,
            serialNumber: tx.serialNumber,
          },
        });

        if (existing) {
          const newOnHand = existing.onHand + tx.quantity;
          await prisma.inventory.update({
            where: { id: existing.id },
            data: {
              onHand: newOnHand,
              available: newOnHand - existing.allocated,
            },
          });
        } else {
          await prisma.inventory.create({
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
        await prisma.inventoryTransaction.create({
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
  );
}

async function captureBillingOnReceive(tenant: TenantContext, shipmentId: string) {
  const shipment = await tenant.db.inboundShipment.findUnique({
    where: { id: shipmentId },
    include: { transactions: true },
  });
  if (!shipment) return;

  const totalUnits = shipment.transactions.reduce(
    (sum: number, tx: { quantity: number }) => sum + tx.quantity,
    0
  );
  const totalCartons = shipment.transactions.length; // each transaction = one receive scan

  await Promise.all([
    // Bill per carton scanned
    captureEvent(tenant.db, {
      clientId: shipment.clientId,
      serviceType: "receiving_carton",
      qty: totalCartons,
      referenceType: "shipment",
      referenceId: shipmentId,
    }),
    // Bill per unit received
    captureEvent(tenant.db, {
      clientId: shipment.clientId,
      serviceType: "handling_unit",
      qty: totalUnits,
      referenceType: "shipment",
      referenceId: shipmentId,
    }),
  ]);
}

export async function getDiscrepancies() {
  if (config.useMockData) return [];

  const { tenant } = await getReadContext();
  return tenant.db.receivingDiscrepancy.findMany({
    include: {
      shipment: { select: { shipmentNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDiscrepancy(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id: "mock-new", ...(data as any) };

  const { user, tenant } = await requireTenantContext("receiving:write");
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

  const { user, tenant } = await requireTenantContext("receiving:write");

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
