"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAccessibleWarehouseIds } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const REVALIDATE = "/inventory/replenishment";

const replenishmentRuleSchema = z.object({
  productId: z.string().min(1),
  binId: z.string().min(1),
  minQty: z.number().int().min(0),
  maxQty: z.number().int().positive(),
  reorderPoint: z.number().int().min(0),
});

async function getContext() {
  return requireTenantContext("inventory:read");
}

export async function getReplenishmentRules() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.replenishmentRule.findMany({
    where: { isActive: true },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      bin: { select: { id: true, barcode: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createReplenishmentRule(data: unknown) {
  if (config.useMockData) return { id: "mock-new", ...(data as object) };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const parsed = replenishmentRuleSchema.parse(data);

  if (parsed.minQty >= parsed.maxQty) {
    throw new Error("Min quantity must be less than max quantity");
  }
  if (parsed.reorderPoint < parsed.minQty || parsed.reorderPoint > parsed.maxQty) {
    throw new Error("Reorder point must be between min and max quantities");
  }

  const rule = await tenant.db.replenishmentRule.create({
    data: parsed,
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "replenishment_rule",
    entityId: rule.id,
  });

  revalidatePath(REVALIDATE);
  return rule;
}

export async function updateReplenishmentRule(id: string, data: unknown) {
  if (config.useMockData) return { id, ...(data as object) };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const parsed = replenishmentRuleSchema.partial().parse(data);

  const rule = await tenant.db.replenishmentRule.update({
    where: { id },
    data: parsed,
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "replenishment_rule",
    entityId: id,
  });

  revalidatePath(REVALIDATE);
  return rule;
}

export async function deleteReplenishmentRule(id: string) {
  if (config.useMockData) return { id, deleted: true };

  const { user, tenant } = await requireTenantContext("inventory:write");

  await tenant.db.replenishmentRule.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "replenishment_rule",
    entityId: id,
  });

  revalidatePath(REVALIDATE);
  return { id, deleted: true };
}

export interface ReplenishmentNeed {
  ruleId: string;
  productSku: string;
  productName: string;
  binBarcode: string;
  currentQty: number;
  reorderPoint: number;
  maxQty: number;
  suggestedQty: number;
}

export async function checkReplenishmentNeeds(): Promise<ReplenishmentNeed[]> {
  if (config.useMockData) return [];

  const { tenant } = await getContext();

  const rules = await tenant.db.replenishmentRule.findMany({
    where: { isActive: true },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      bin: { select: { id: true, barcode: true } },
    },
  });

  const needs: ReplenishmentNeed[] = [];

  for (const rule of rules) {
    const inv = await tenant.db.inventory.findFirst({
      where: { productId: rule.productId, binId: rule.binId },
      select: { available: true },
    });

    const currentQty = inv?.available ?? 0;

    if (currentQty <= rule.reorderPoint) {
      needs.push({
        ruleId: rule.id,
        productSku: rule.product.sku,
        productName: rule.product.name,
        binBarcode: rule.bin.barcode,
        currentQty,
        reorderPoint: rule.reorderPoint,
        maxQty: rule.maxQty,
        suggestedQty: rule.maxQty - currentQty,
      });
    }
  }

  return needs;
}

export interface ReplenishmentMoveResult {
  ruleId: string;
  productSku: string;
  fromBinBarcode: string;
  toBinBarcode: string;
  movedQty: number;
}

/**
 * Execute a single replenishment: move inventory from a bulk bin
 * to the pick-face bin defined in the rule.
 */
export async function executeReplenishment(ruleId: string): Promise<ReplenishmentMoveResult> {
  if (config.useMockData) {
    return {
      ruleId,
      productSku: "MOCK",
      fromBinBarcode: "BULK-01",
      toBinBarcode: "PICK-01",
      movedQty: 0,
    };
  }

  const { user, tenant, role, warehouseAccess } = await requireTenantContext("inventory:write");
  const db = tenant.db;
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  const rule = await db.replenishmentRule.findUniqueOrThrow({
    where: { id: ruleId },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      bin: {
        select: {
          id: true,
          barcode: true,
          shelf: {
            select: {
              rack: { select: { aisle: { select: { zone: { select: { warehouseId: true } } } } } },
            },
          },
        },
      },
    },
  });

  // Verify warehouse access for the rule's bin
  if (accessibleIds !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bin = rule.bin as any;
    const warehouseId = bin?.shelf?.rack?.aisle?.zone?.warehouseId;
    if (warehouseId && !accessibleIds.includes(warehouseId)) {
      throw new Error("Access denied: you do not have access to this warehouse");
    }
  }

  // Current qty in the pick-face bin
  const pickInv = await db.inventory.findFirst({
    where: { productId: rule.productId, binId: rule.binId },
    select: { available: true },
  });
  const currentQty = pickInv?.available ?? 0;
  const neededQty = rule.maxQty - currentQty;

  if (neededQty <= 0) {
    return {
      ruleId,
      productSku: rule.product.sku,
      fromBinBarcode: "-",
      toBinBarcode: rule.bin.barcode,
      movedQty: 0,
    };
  }

  // Find bulk inventory for this product in other bins (not the pick-face bin)
  const bulkSources = await db.inventory.findMany({
    where: {
      productId: rule.productId,
      binId: { not: rule.binId },
      available: { gt: 0 },
      bin: { type: "bulk" },
    },
    include: { bin: { select: { id: true, barcode: true } } },
    orderBy: { available: "desc" },
  });

  if (bulkSources.length === 0) {
    throw new Error(`No bulk inventory found for product ${rule.product.sku}`);
  }

  // Use first source with enough, or take what is available
  const source = bulkSources[0];
  const moveQty = Math.min(neededQty, source.available);

  // Atomic move: decrement bulk, increment pick, log transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.$transaction(async (prisma: any) => {
    // Decrement source bulk bin
    const newSourceOnHand = source.onHand - moveQty;
    await prisma.inventory.update({
      where: { id: source.id },
      data: {
        onHand: newSourceOnHand,
        available: newSourceOnHand - source.allocated,
      },
    });

    // Increment pick-face bin
    const existing = await prisma.inventory.findFirst({
      where: { productId: rule.productId, binId: rule.binId },
    });

    if (existing) {
      const newOnHand = existing.onHand + moveQty;
      await prisma.inventory.update({
        where: { id: existing.id },
        data: { onHand: newOnHand, available: newOnHand - existing.allocated },
      });
    } else {
      await prisma.inventory.create({
        data: {
          productId: rule.productId,
          binId: rule.binId,
          onHand: moveQty,
          allocated: 0,
          available: moveQty,
        },
      });
    }

    await prisma.inventoryTransaction.create({
      data: {
        type: "move",
        productId: rule.productId,
        fromBinId: source.binId,
        toBinId: rule.binId,
        quantity: moveQty,
        referenceType: "replenishment_rule",
        referenceId: ruleId,
        performedBy: user.id,
      },
    });
  });

  await logAudit(db, {
    userId: user.id,
    action: "create",
    entityType: "replenishment_move",
    entityId: ruleId,
  });

  revalidatePath(REVALIDATE);
  return {
    ruleId,
    productSku: rule.product.sku,
    fromBinBarcode: source.bin.barcode,
    toBinBarcode: rule.bin.barcode,
    movedQty: moveQty,
  };
}

/**
 * Auto-trigger replenishment for all active rules that are below reorder point.
 * Returns a summary of all moves executed.
 */
export async function autoTriggerReplenishment(): Promise<ReplenishmentMoveResult[]> {
  if (config.useMockData) return [];

  const needs = await checkReplenishmentNeeds();
  const results: ReplenishmentMoveResult[] = [];

  for (const need of needs) {
    try {
      const result = await executeReplenishment(need.ruleId);
      if (result.movedQty > 0) {
        results.push(result);
      }
    } catch (err) {
      console.error(`[Replenishment] Failed for rule ${need.ruleId}:`, err);
    }
  }

  return results;
}
