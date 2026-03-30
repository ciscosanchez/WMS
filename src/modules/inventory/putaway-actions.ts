"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { suggestPutawayLocation } from "./putaway-engine";
import { mockAdjustments } from "@/lib/mock-data";
import { publishInventoryUpdate } from "@/lib/events/event-bus";

async function getContext() {
  return requireTenantContext("inventory:read");
}

export async function getCycleCounts() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.inventoryAdjustment.findMany({
    where: { type: "cycle_count" },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductsForDropdown() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, name: true },
    orderBy: { sku: "asc" },
  });
}

export async function getBinsForDropdown() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.bin.findMany({
    where: { status: "available" },
    select: { id: true, barcode: true },
    orderBy: { barcode: "asc" },
  });
}

export async function getAdjustments() {
  if (config.useMockData) return mockAdjustments;

  const { tenant } = await getContext();
  return tenant.db.inventoryAdjustment.findMany({
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Pending putaway items: receiving transactions on completed shipments
 * that haven't been put away yet (no putaway inventory transaction referencing them).
 */
export async function getPendingPutawayItems() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  const db = tenant.db;

  // Get all receiving transactions that haven't been put away
  const receivingTxns = await db.receivingTransaction.findMany({
    where: {
      shipment: { status: { in: ["receiving", "completed"] } },
    },
    include: {
      line: { include: { product: { include: { client: true } } } },
      shipment: { select: { shipmentNumber: true } },
      bin: true,
    },
    orderBy: { receivedAt: "desc" },
  });

  // Find which ones already have a putaway transaction
  const putawayTxns = await db.inventoryTransaction.findMany({
    where: {
      type: "putaway",
      referenceType: "receiving_transaction",
      referenceId: { in: receivingTxns.map((t: { id: string }) => t.id) },
    },
    select: { referenceId: true },
  });
  const putawayIds = new Set(putawayTxns.map((t: { referenceId: string | null }) => t.referenceId));

  const pending = receivingTxns.filter((tx: { id: string }) => !putawayIds.has(tx.id));

  // Enrich each pending item with putaway engine suggestions
  const results = await Promise.all(
    pending.map(
      async (tx: {
        id: string;
        line: {
          productId: string;
          product: { sku: string; name: string; client: { code: string } | null };
        };
        quantity: number;
        receivedAt: Date;
        shipment: { shipmentNumber: string };
        binId: string | null;
        bin: { barcode: string } | null;
        lotNumber: string | null;
        serialNumber: string | null;
      }) => {
        const suggestions = await suggestPutawayLocation(tx.line.productId, tx.quantity);
        return {
          id: tx.id,
          productId: tx.line.productId,
          productSku: tx.line.product.sku,
          productName: tx.line.product.name,
          clientCode: tx.line.product.client?.code ?? "-",
          quantity: tx.quantity,
          receivedAt: tx.receivedAt,
          shipmentNumber: tx.shipment.shipmentNumber,
          currentBinId: tx.binId,
          currentBinBarcode: tx.bin?.barcode ?? null,
          suggestions: suggestions.filter((s) => s.binId !== ""),
        };
      }
    )
  );

  return results;
}

/**
 * Confirm putaway: creates an inventory record (or updates existing) in the target bin,
 * and logs a putaway inventory transaction.
 */
export async function confirmPutaway(receivingTxId: string, targetBinId: string) {
  if (config.useMockData) return { success: true };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const db = tenant.db;

  const rxTx = await db.receivingTransaction.findUniqueOrThrow({
    where: { id: receivingTxId },
    include: { line: true },
  });

  // Replay protection: check if this receiving transaction was already put away
  const existingPutaway = await db.inventoryTransaction.findFirst({
    where: {
      type: "putaway",
      referenceType: "receiving_transaction",
      referenceId: receivingTxId,
    },
  });
  if (existingPutaway) {
    return { success: true }; // Idempotent — already processed
  }

  // Atomic: decrement source bin + upsert target bin + log putaway transaction
  await db.$transaction(async (prisma: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => {
    // Re-check inside transaction to prevent concurrent putaway
    const doubleCheck = await prisma.inventoryTransaction.findFirst({
      where: {
        type: "putaway",
        referenceType: "receiving_transaction",
        referenceId: receivingTxId,
      },
    });
    if (doubleCheck) return; // Already processed concurrently

    // Decrement inventory in source bin (where finalizeReceiving placed it)
    if (rxTx.binId) {
      const sourceInv = await prisma.inventory.findFirst({
        where: {
          productId: rxTx.line.productId,
          binId: rxTx.binId,
          lotNumber: rxTx.lotNumber,
          serialNumber: rxTx.serialNumber,
        },
      });
      if (!sourceInv || sourceInv.onHand < rxTx.quantity) {
        throw new Error(
          "Source bin has insufficient inventory — receiving may not have been finalized yet"
        );
      }
      const newSourceOnHand = sourceInv.onHand - rxTx.quantity;
      await prisma.inventory.update({
        where: { id: sourceInv.id },
        data: {
          onHand: newSourceOnHand,
          available: newSourceOnHand - sourceInv.allocated,
        },
      });
    }

    // Increment inventory in target bin
    const existing = await prisma.inventory.findFirst({
      where: {
        productId: rxTx.line.productId,
        binId: targetBinId,
        lotNumber: rxTx.lotNumber,
        serialNumber: rxTx.serialNumber,
      },
    });

    if (existing) {
      const newOnHand = existing.onHand + rxTx.quantity;
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
          productId: rxTx.line.productId,
          binId: targetBinId,
          lotNumber: rxTx.lotNumber,
          serialNumber: rxTx.serialNumber,
          onHand: rxTx.quantity,
          allocated: 0,
          available: rxTx.quantity,
        },
      });
    }

    await prisma.inventoryTransaction.create({
      data: {
        type: "putaway",
        productId: rxTx.line.productId,
        fromBinId: rxTx.binId,
        toBinId: targetBinId,
        quantity: rxTx.quantity,
        lotNumber: rxTx.lotNumber,
        serialNumber: rxTx.serialNumber,
        referenceType: "receiving_transaction",
        referenceId: receivingTxId,
        performedBy: user.id,
      },
    });
  });

  await logAudit(db, {
    userId: user.id,
    action: "create",
    entityType: "putaway",
    entityId: receivingTxId,
  });

  // Publish SSE event for real-time UI updates
  try {
    publishInventoryUpdate(tenant.tenantId, {
      action: "putaway",
      productId: rxTx.line.productId,
      binId: targetBinId,
    });
  } catch (sseErr) {
    console.error("[confirmPutaway] SSE publish failed:", sseErr);
  }

  revalidatePath("/inventory/putaway");
  return { success: true };
}
