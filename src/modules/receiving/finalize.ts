"use server";

import type { TenantContext } from "@/lib/tenant/context";
import { captureEvent } from "@/modules/billing/capture";

/**
 * After a shipment is marked "completed", upsert inventory records for every
 * receiving transaction. Runs inside a single Prisma transaction for atomicity.
 *
 * If putaway already ran for a specific receiving transaction the inventory is
 * already in the target bin — that transaction is skipped to prevent duplication.
 */
export async function finalizeReceiving(tenant: TenantContext, shipmentId: string, userId: string) {
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

/**
 * After a shipment is completed, emit billing events for cartons received and
 * units handled so the billing engine can pick them up during invoicing.
 */
export async function captureBillingOnReceive(tenant: TenantContext, shipmentId: string) {
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
