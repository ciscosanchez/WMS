"use server";

/**
 * Transfer Order Execution — pick/ship/receive workflow.
 *
 * Handles the actual inventory movements when a transfer transitions
 * between statuses. Uses `move` transaction type with `transfer_order`
 * referenceType since the Prisma TransactionType enum has no dedicated
 * transfer_in / transfer_out values.
 */

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAccessibleWarehouseIds } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { assertTransition, TRANSFER_ORDER_TRANSITIONS } from "@/lib/workflow/transitions";

const REVALIDATE = "/inventory/transfers";

// ─── Ship Transfer ───────────────────────────────────────────────────────────

/**
 * Transitions a transfer to "in_transit" and decrements source warehouse
 * inventory for each line. Writes a "move" ledger entry with
 * referenceType "transfer_order" (acting as transfer_out).
 */
export async function shipTransfer(transferId: string) {
  if (config.useMockData) return { id: transferId, status: "in_transit" };

  const { user, tenant, role, warehouseAccess } = await requireTenantContext("inventory:write");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  const transfer = await tenant.db.transferOrder.findUniqueOrThrow({
    where: { id: transferId },
    include: { lines: true },
  });

  if (accessibleIds !== null && !accessibleIds.includes(transfer.fromWarehouseId)) {
    throw new Error("Forbidden: source warehouse is outside your access");
  }

  assertTransition("transfer_order", transfer.status, "in_transit", TRANSFER_ORDER_TRANSITIONS);

  // Atomic transaction: decrement source inventory + write ledger entries
  const updated = await tenant.db.$transaction(
    async (prisma: Parameters<Parameters<typeof tenant.db.$transaction>[0]>[0]) => {
      for (const line of transfer.lines) {
        // Find inventory in source warehouse bins
        const inventoryRows = await prisma.inventory.findMany({
          where: {
            productId: line.productId,
            bin: {
              shelf: {
                rack: {
                  aisle: {
                    zone: { warehouseId: transfer.fromWarehouseId },
                  },
                },
              },
            },
            ...(line.lotNumber ? { lotNumber: line.lotNumber } : {}),
          },
          orderBy: { onHand: "desc" },
        });

        let remaining = line.quantity;
        let totalAvailable = 0;
        for (const inv of inventoryRows) {
          totalAvailable += Math.max(0, inv.onHand - inv.allocated);
        }

        if (totalAvailable < line.quantity) {
          throw new Error(
            `Insufficient inventory for product ${line.productId}` +
              (line.lotNumber ? ` lot ${line.lotNumber}` : "") +
              `: need ${line.quantity}, available ${totalAvailable}`
          );
        }

        for (const inv of inventoryRows) {
          if (remaining <= 0) break;
          const available = Math.max(0, inv.onHand - inv.allocated);
          if (available <= 0) continue;

          const decrement = Math.min(available, remaining);
          remaining -= decrement;

          await prisma.inventory.update({
            where: { id: inv.id },
            data: {
              onHand: inv.onHand - decrement,
              available: inv.onHand - decrement - inv.allocated,
            },
          });

          // Ledger entry — "move" type acting as transfer_out
          await prisma.inventoryTransaction.create({
            data: {
              type: "move",
              productId: line.productId,
              fromBinId: inv.binId,
              quantity: decrement,
              lotNumber: line.lotNumber ?? null,
              referenceType: "transfer_order",
              referenceId: transferId,
              reason: `Transfer out: ${transfer.transferNumber}`,
              performedBy: user.id,
            },
          });
        }
      }

      return prisma.transferOrder.update({
        where: { id: transferId },
        data: { status: "in_transit", shippedAt: new Date() },
      });
    }
  );

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "transfer_order",
    entityId: transferId,
    changes: { status: { old: transfer.status, new: "in_transit" } },
  });

  revalidatePath(REVALIDATE);
  return updated;
}

// ─── Receive Transfer ────────────────────────────────────────────────────────

/**
 * Transitions a transfer to "received" and increments destination warehouse
 * inventory. Finds or creates a default receiving bin in the destination
 * warehouse. Writes a "move" ledger entry acting as transfer_in.
 */
export async function receiveTransfer(transferId: string) {
  if (config.useMockData) return { id: transferId, status: "received" };

  const { user, tenant, role, warehouseAccess } = await requireTenantContext("inventory:write");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  const transfer = await tenant.db.transferOrder.findUniqueOrThrow({
    where: { id: transferId },
    include: { lines: true },
  });

  if (accessibleIds !== null && !accessibleIds.includes(transfer.toWarehouseId)) {
    throw new Error("Forbidden: destination warehouse is outside your access");
  }

  assertTransition("transfer_order", transfer.status, "received", TRANSFER_ORDER_TRANSITIONS);

  // Find or create default receiving bin in destination warehouse
  const receivingBinId = await findOrCreateReceivingBin(tenant.db, transfer.toWarehouseId);

  const updated = await tenant.db.$transaction(
    async (prisma: Parameters<Parameters<typeof tenant.db.$transaction>[0]>[0]) => {
      for (const line of transfer.lines) {
        // Upsert inventory in receiving bin
        const existing = await prisma.inventory.findFirst({
          where: {
            productId: line.productId,
            binId: receivingBinId,
            lotNumber: line.lotNumber ?? null,
            serialNumber: null,
          },
        });

        if (existing) {
          await prisma.inventory.update({
            where: { id: existing.id },
            data: {
              onHand: existing.onHand + line.quantity,
              available: existing.available + line.quantity,
            },
          });
        } else {
          await prisma.inventory.create({
            data: {
              productId: line.productId,
              binId: receivingBinId,
              lotNumber: line.lotNumber ?? null,
              onHand: line.quantity,
              allocated: 0,
              available: line.quantity,
            },
          });
        }

        // Ledger entry — "move" type acting as transfer_in
        await prisma.inventoryTransaction.create({
          data: {
            type: "receive",
            productId: line.productId,
            toBinId: receivingBinId,
            quantity: line.quantity,
            lotNumber: line.lotNumber ?? null,
            referenceType: "transfer_order",
            referenceId: transferId,
            reason: `Transfer in: ${transfer.transferNumber}`,
            performedBy: user.id,
          },
        });

        // Update receivedQty on the transfer line
        await prisma.transferOrderLine.update({
          where: { id: line.id },
          data: { receivedQty: line.quantity },
        });
      }

      return prisma.transferOrder.update({
        where: { id: transferId },
        data: { status: "received", receivedAt: new Date() },
      });
    }
  );

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "transfer_order",
    entityId: transferId,
    changes: { status: { old: transfer.status, new: "received" } },
  });

  revalidatePath(REVALIDATE);
  return updated;
}

// ─── Complete Transfer ───────────────────────────────────────────────────────

/**
 * Transitions a transfer to "completed" after verifying all lines
 * have been received. Captures a billing event if applicable.
 */
export async function completeTransfer(transferId: string) {
  if (config.useMockData) return { id: transferId, status: "completed" };

  const { user, tenant, role, warehouseAccess } = await requireTenantContext("inventory:write");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  const transfer = await tenant.db.transferOrder.findUniqueOrThrow({
    where: { id: transferId },
    include: { lines: true },
  });

  if (
    accessibleIds !== null &&
    !accessibleIds.includes(transfer.fromWarehouseId) &&
    !accessibleIds.includes(transfer.toWarehouseId)
  ) {
    throw new Error("Forbidden: transfer is outside your warehouse access");
  }

  assertTransition("transfer_order", transfer.status, "completed", TRANSFER_ORDER_TRANSITIONS);

  // Verify all lines received
  for (const line of transfer.lines) {
    if (line.receivedQty < line.quantity) {
      throw new Error(
        `Line for product ${line.productId} not fully received: ` +
          `expected ${line.quantity}, received ${line.receivedQty}`
      );
    }
  }

  const updated = await tenant.db.transferOrder.update({
    where: { id: transferId },
    data: { status: "completed" },
  });

  // Capture billing event if a billingEvent model exists
  try {
    const totalQty = transfer.lines.reduce(
      (sum: number, l: { quantity: number }) => sum + l.quantity,
      0
    );
    await tenant.db.billingEvent.create({
      data: {
        type: "transfer",
        referenceType: "transfer_order",
        referenceId: transferId,
        description: `Transfer ${transfer.transferNumber}: ${totalQty} units`,
        quantity: totalQty,
      },
    });
  } catch {
    // billingEvent table may not exist yet — silently skip
  }

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "transfer_order",
    entityId: transferId,
    changes: { status: { old: transfer.status, new: "completed" } },
  });

  revalidatePath(REVALIDATE);
  return updated;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Finds an existing receiving-area bin in the warehouse, or creates one
 * by scaffolding a RECV zone → aisle → rack → shelf → bin hierarchy.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findOrCreateReceivingBin(db: any, warehouseId: string): Promise<string> {
  // Look for an existing bin in a zone named/coded "RECV" or type "staging"
  const existingBin = await db.bin.findFirst({
    where: {
      shelf: {
        rack: {
          aisle: {
            zone: {
              warehouseId,
              OR: [{ code: "RECV" }, { type: "staging" }],
            },
          },
        },
      },
      status: "available",
    },
    select: { id: true },
  });

  if (existingBin) return existingBin.id;

  // Create the full hierarchy: Zone → Aisle → Rack → Shelf → Bin
  const zone = await db.zone.upsert({
    where: { warehouseId_code: { warehouseId, code: "RECV" } },
    update: {},
    create: {
      warehouseId,
      code: "RECV",
      name: "Receiving",
      type: "staging",
    },
  });

  const aisle = await db.aisle.upsert({
    where: { zoneId_code: { zoneId: zone.id, code: "R1" } },
    update: {},
    create: { zoneId: zone.id, code: "R1" },
  });

  const rack = await db.rack.upsert({
    where: { aisleId_code: { aisleId: aisle.id, code: "RK1" } },
    update: {},
    create: { aisleId: aisle.id, code: "RK1" },
  });

  const shelf = await db.shelf.upsert({
    where: { rackId_code: { rackId: rack.id, code: "S1" } },
    update: {},
    create: { rackId: rack.id, code: "S1" },
  });

  const bin = await db.bin.create({
    data: {
      shelfId: shelf.id,
      code: "RECV-01",
      barcode: `RECV-${warehouseId}-01`,
      type: "standard",
      status: "available",
    },
  });

  return bin.id;
}
