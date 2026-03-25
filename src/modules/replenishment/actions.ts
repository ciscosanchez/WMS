"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
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
  return requireTenantContext();
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
