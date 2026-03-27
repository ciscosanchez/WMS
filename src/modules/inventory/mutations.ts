"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { moveInventorySchema, adjustmentSchema, adjustmentLineSchema } from "./schemas";
import { notificationQueue, emailQueue } from "@/lib/jobs/queue";

export async function moveInventory(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id: "mock-new", type: "move", ...(data as any) };

  const { user, tenant } = await requireTenantContext("inventory:write");
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

  // Atomic: deduct source, credit destination, log ledger
  const tx = await tenant.db.$transaction(
    async (prisma: Parameters<Parameters<typeof tenant.db.$transaction>[0]>[0]) => {
      // Re-check availability inside the transaction to prevent races
      const locked = await prisma.inventory.findFirst({
        where: { id: source.id, available: { gte: parsed.quantity } },
      });
      if (!locked) throw new Error("Insufficient available inventory (concurrent modification)");

      // Deduct from source
      await prisma.inventory.update({
        where: { id: source.id },
        data: {
          onHand: { decrement: parsed.quantity },
          available: { decrement: parsed.quantity },
        },
      });

      // Add to destination
      const destExisting = await prisma.inventory.findFirst({
        where: {
          productId: parsed.productId,
          binId: parsed.toBinId,
          lotNumber: parsed.lotNumber || null,
          serialNumber: parsed.serialNumber || null,
        },
      });

      if (destExisting) {
        await prisma.inventory.update({
          where: { id: destExisting.id },
          data: {
            onHand: { increment: parsed.quantity },
            available: { increment: parsed.quantity },
          },
        });
      } else {
        await prisma.inventory.create({
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
      return prisma.inventoryTransaction.create({
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
    }
  );

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
  if (config.useMockData)
    return {
      id: "mock-new",
      adjustmentNumber: "ADJ-MOCK-0001",
      status: "draft",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(headerData as any),
    };

  const { user, tenant } = await requireTenantContext("inventory:write");
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
  if (config.useMockData) return;

  const { user, tenant } = await requireTenantContext("inventory:adjust");

  const adjustment = await tenant.db.inventoryAdjustment.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });

  if (adjustment.status === "completed") return; // Already applied — idempotent

  // Atomic: apply all adjustment lines + mark completed in one transaction
  await tenant.db.$transaction(
    async (prisma: Parameters<Parameters<typeof tenant.db.$transaction>[0]>[0]) => {
      // Re-check status inside transaction to prevent concurrent approvals
      const current = await prisma.inventoryAdjustment.findUnique({
        where: { id },
        select: { status: true },
      });
      if (current?.status === "completed") return;

      for (const line of adjustment.lines) {
        const inv = await prisma.inventory.findFirst({
          where: {
            productId: line.productId,
            binId: line.binId,
            lotNumber: line.lotNumber,
            serialNumber: line.serialNumber,
          },
        });

        if (inv) {
          const newOnHand = line.countedQty;
          await prisma.inventory.update({
            where: { id: inv.id },
            data: {
              onHand: newOnHand,
              available: newOnHand - inv.allocated,
            },
          });
        } else if (line.countedQty > 0) {
          await prisma.inventory.create({
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
        await prisma.inventoryTransaction.create({
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

      await prisma.inventoryAdjustment.update({
        where: { id },
        data: {
          status: "completed",
          approvedBy: user.id,
          approvedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }
  );

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "inventory_adjustment",
    entityId: id,
    changes: { status: { old: "pending_approval", new: "completed" } },
  });

  // Fire-and-forget: check for low-stock products after adjustment
  (async () => {
    try {
      const products = await tenant.db.product.findMany({
        where: { isActive: true, minStock: { not: null } },
        select: {
          id: true,
          sku: true,
          name: true,
          minStock: true,
          inventory: { select: { available: true } },
        },
      });
      const lowStock = products
        .map(
          (p: {
            id: string;
            sku: string;
            name: string;
            minStock: number | null;
            inventory: Array<{ available: number }>;
          }) => ({
            sku: p.sku,
            name: p.name,
            available: p.inventory.reduce(
              (sum: number, inv: { available: number }) => sum + inv.available,
              0
            ),
            minStock: p.minStock ?? 0,
          })
        )
        .filter((p: { available: number; minStock: number }) => p.available < p.minStock);

      if (lowStock.length > 0) {
        await notificationQueue.add("low_stock_alert", {
          type: "warehouse_team",
          tenantId: tenant.tenantId,
          title: "Low Stock Alert",
          message: `${lowStock.length} product(s) below minimum stock after adjustment ${adjustment.adjustmentNumber}`,
          link: "/inventory",
        });
        await emailQueue.add("low_stock_alert_email", {
          template: "low_stock_alert",
          tenantId: tenant.tenantId,
          products: lowStock,
        });
      }
    } catch (err) {
      console.error("[LowStock] Failed to check low-stock after adjustment:", err);
    }
  })();

  revalidatePath("/inventory/adjustments");
}
