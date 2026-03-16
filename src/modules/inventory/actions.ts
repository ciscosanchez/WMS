"use server";

import { revalidatePath } from "next/cache";
import { resolveTenant } from "@/lib/tenant/context";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { moveInventorySchema, adjustmentSchema, adjustmentLineSchema } from "./schemas";

async function getContext() {
  const [user, tenant] = await Promise.all([requireAuth(), resolveTenant()]);
  if (!tenant) throw new Error("Tenant not found");
  return { user, tenant };
}

export async function getInventory(filters?: {
  productId?: string;
  binId?: string;
  clientId?: string;
  search?: string;
}) {
  const { tenant } = await getContext();

  return tenant.db.inventory.findMany({
    where: {
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.binId ? { binId: filters.binId } : {}),
      ...(filters?.search
        ? {
            product: {
              OR: [
                { sku: { contains: filters.search, mode: "insensitive" as const } },
                { name: { contains: filters.search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    include: {
      product: { include: { client: true } },
      bin: {
        include: {
          shelf: {
            include: {
              rack: {
                include: {
                  aisle: {
                    include: {
                      zone: { include: { warehouse: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getInventoryTransactions(filters?: { productId?: string; type?: string }) {
  const { tenant } = await getContext();

  return tenant.db.inventoryTransaction.findMany({
    where: {
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.type ? { type: filters.type as any } : {}),
    },
    include: {
      product: true,
      fromBin: true,
      toBin: true,
    },
    orderBy: { performedAt: "desc" },
    take: 100,
  });
}

export async function moveInventory(data: unknown) {
  const { user, tenant } = await getContext();
  const parsed = moveInventorySchema.parse(data);

  // Find source inventory
  const source = await tenant.db.inventory.findFirst({
    where: {
      productId: parsed.productId,
      binId: parsed.fromBinId,
      lotNumber: parsed.lotNumber || null,
      serialNumber: parsed.serialNumber || null,
    },
  });

  if (!source || source.available < parsed.quantity) {
    throw new Error("Insufficient available inventory");
  }

  // Deduct from source
  await tenant.db.inventory.update({
    where: { id: source.id },
    data: {
      onHand: { decrement: parsed.quantity },
      available: { decrement: parsed.quantity },
    },
  });

  // Add to destination
  const destExisting = await tenant.db.inventory.findFirst({
    where: {
      productId: parsed.productId,
      binId: parsed.toBinId,
      lotNumber: parsed.lotNumber || null,
      serialNumber: parsed.serialNumber || null,
    },
  });

  if (destExisting) {
    await tenant.db.inventory.update({
      where: { id: destExisting.id },
      data: {
        onHand: { increment: parsed.quantity },
        available: { increment: parsed.quantity },
      },
    });
  } else {
    await tenant.db.inventory.create({
      data: {
        productId: parsed.productId,
        binId: parsed.toBinId,
        lotNumber: parsed.lotNumber || null,
        serialNumber: parsed.serialNumber || null,
        onHand: parsed.quantity,
        allocated: 0,
        available: parsed.quantity,
      },
    });
  }

  // Log transaction
  const tx = await tenant.db.inventoryTransaction.create({
    data: {
      type: "move",
      productId: parsed.productId,
      fromBinId: parsed.fromBinId,
      toBinId: parsed.toBinId,
      quantity: parsed.quantity,
      lotNumber: parsed.lotNumber || null,
      serialNumber: parsed.serialNumber || null,
      reason: parsed.reason || null,
      performedBy: user.id,
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "inventory_move",
    entityId: tx.id,
  });

  revalidatePath("/inventory");
  return tx;
}

export async function createAdjustment(headerData: unknown, lines: unknown[]) {
  const { user, tenant } = await getContext();
  const header = adjustmentSchema.parse(headerData);
  const parsedLines = lines.map((l) => adjustmentLineSchema.parse(l));

  const adjustmentNumber = await nextSequence(tenant.db, "ADJ");

  const adjustment = await tenant.db.inventoryAdjustment.create({
    data: {
      adjustmentNumber,
      type: header.type,
      status: "draft",
      reason: header.reason || null,
      notes: header.notes || null,
      createdBy: user.id,
      lines: {
        create: parsedLines.map((line) => ({
          productId: line.productId,
          binId: line.binId,
          lotNumber: line.lotNumber || null,
          serialNumber: line.serialNumber || null,
          systemQty: line.systemQty,
          countedQty: line.countedQty,
          variance: line.countedQty - line.systemQty,
          notes: line.notes || null,
        })),
      },
    },
    include: { lines: true },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "inventory_adjustment",
    entityId: adjustment.id,
  });

  revalidatePath("/inventory/adjustments");
  return adjustment;
}

export async function approveAdjustment(id: string) {
  const { user, tenant } = await getContext();

  const adjustment = await tenant.db.inventoryAdjustment.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });

  // Apply adjustments to inventory
  for (const line of adjustment.lines) {
    const inv = await tenant.db.inventory.findFirst({
      where: {
        productId: line.productId,
        binId: line.binId,
        lotNumber: line.lotNumber,
        serialNumber: line.serialNumber,
      },
    });

    if (inv) {
      const newOnHand = line.countedQty;
      await tenant.db.inventory.update({
        where: { id: inv.id },
        data: {
          onHand: newOnHand,
          available: newOnHand - inv.allocated,
        },
      });
    } else if (line.countedQty > 0) {
      await tenant.db.inventory.create({
        data: {
          productId: line.productId,
          binId: line.binId,
          lotNumber: line.lotNumber,
          serialNumber: line.serialNumber,
          onHand: line.countedQty,
          allocated: 0,
          available: line.countedQty,
        },
      });
    }

    // Log transaction
    await tenant.db.inventoryTransaction.create({
      data: {
        type: "adjust",
        productId: line.productId,
        toBinId: line.binId,
        quantity: line.variance,
        lotNumber: line.lotNumber,
        serialNumber: line.serialNumber,
        referenceType: "adjustment",
        referenceId: id,
        reason: adjustment.reason || null,
        performedBy: user.id,
      },
    });
  }

  await tenant.db.inventoryAdjustment.update({
    where: { id },
    data: {
      status: "completed",
      approvedBy: user.id,
      approvedAt: new Date(),
      completedAt: new Date(),
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "inventory_adjustment",
    entityId: id,
    changes: { status: { old: "pending_approval", new: "completed" } },
  });

  revalidatePath("/inventory/adjustments");
}

export async function getAdjustments() {
  const { tenant } = await getContext();
  return tenant.db.inventoryAdjustment.findMany({
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
}
