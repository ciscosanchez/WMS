"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { z } from "zod";

const REVALIDATE = "/inventory/cycle-counts";

const cycleCountMethodSchema = z.enum(["abc", "zone", "full", "random"]);
const cycleCountFrequencySchema = z.enum(["daily", "weekly", "monthly", "quarterly"]);

const createPlanSchema = z.object({
  name: z.string().min(1).max(200),
  method: cycleCountMethodSchema,
  frequency: cycleCountFrequencySchema,
  config: z
    .object({
      zoneCodes: z.array(z.string()).optional(),
      randomCount: z.number().int().positive().optional(),
    })
    .optional()
    .default({}),
});

const submitCountSchema = z.object({
  adjustmentId: z.string().min(1),
  counts: z.array(
    z.object({
      lineId: z.string().min(1),
      countedQty: z.number().int().min(0),
    })
  ),
});

// ─── Helpers ────────────────────────────────────────────

async function getContext() {
  return requireTenantContext("inventory:read");
}

function computeNextRunAt(frequency: string, from: Date = new Date()): Date {
  const next = new Date(from);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
  }
  return next;
}

/**
 * Determine if a product should be counted based on ABC method and frequency.
 * A items: weekly, B items: monthly, C items: quarterly.
 */
function shouldCountAbc(abcClass: string, frequency: string): boolean {
  switch (abcClass) {
    case "A":
      return frequency === "weekly" || frequency === "daily";
    case "B":
      return frequency === "monthly" || frequency === "weekly" || frequency === "daily";
    case "C":
      return true; // quarterly catches all
    default:
      return true;
  }
}

// ─── Actions ────────────────────────────────────────────

export async function getCycleCountPlans() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.cycleCountPlan.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createCycleCountPlan(data: unknown) {
  if (config.useMockData) return { id: "mock-plan", ...(data as object) };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const parsed = createPlanSchema.parse(data);

  const plan = await tenant.db.cycleCountPlan.create({
    data: {
      name: parsed.name,
      method: parsed.method,
      frequency: parsed.frequency,
      config: parsed.config,
      nextRunAt: computeNextRunAt(parsed.frequency),
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "cycle_count_plan",
    entityId: plan.id,
  });

  revalidatePath(REVALIDATE);
  return plan;
}

export async function updateCycleCountPlan(id: string, data: unknown) {
  if (config.useMockData) return { id, ...(data as object) };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const parsed = createPlanSchema.partial().parse(data);

  const updateData: Record<string, unknown> = { ...parsed };
  if (parsed.frequency) {
    updateData.nextRunAt = computeNextRunAt(parsed.frequency);
  }

  const plan = await tenant.db.cycleCountPlan.update({
    where: { id },
    data: updateData,
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "cycle_count_plan",
    entityId: id,
  });

  revalidatePath(REVALIDATE);
  return plan;
}

export async function deleteCycleCountPlan(id: string) {
  if (config.useMockData) return { id, deleted: true };

  const { user, tenant } = await requireTenantContext("inventory:write");

  await tenant.db.cycleCountPlan.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "cycle_count_plan",
    entityId: id,
  });

  revalidatePath(REVALIDATE);
  return { id, deleted: true };
}

/**
 * Generate cycle count tasks for a plan. Creates an InventoryAdjustment
 * with type=cycle_count and AdjustmentLines for each bin/product to count.
 */
export async function generateCycleCountTasks(planId: string) {
  if (config.useMockData) return { adjustmentId: "mock-adj", lineCount: 0 };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const db = tenant.db;

  const plan = await db.cycleCountPlan.findUniqueOrThrow({ where: { id: planId } });
  const planConfig = (plan.config ?? {}) as { zoneCodes?: string[]; randomCount?: number };

  // Collect bins to count based on method
  let inventoryRows: Array<{
    id: string;
    productId: string;
    binId: string;
    lotNumber: string | null;
    serialNumber: string | null;
    onHand: number;
  }> = [];

  if (plan.method === "full") {
    inventoryRows = await db.inventory.findMany({
      where: { onHand: { gt: 0 } },
      select: {
        id: true,
        productId: true,
        binId: true,
        lotNumber: true,
        serialNumber: true,
        onHand: true,
      },
    });
  } else if (plan.method === "zone") {
    const zoneCodes = planConfig.zoneCodes ?? [];
    if (zoneCodes.length === 0) {
      throw new Error("Zone method requires at least one zone code in plan config");
    }
    inventoryRows = await db.inventory.findMany({
      where: {
        onHand: { gt: 0 },
        bin: {
          shelf: {
            rack: { aisle: { zone: { code: { in: zoneCodes } } } },
          },
        },
      },
      select: {
        id: true,
        productId: true,
        binId: true,
        lotNumber: true,
        serialNumber: true,
        onHand: true,
      },
    });
  } else if (plan.method === "random") {
    const count = planConfig.randomCount ?? 50;
    const allOccupied = await db.inventory.findMany({
      where: { onHand: { gt: 0 } },
      select: {
        id: true,
        productId: true,
        binId: true,
        lotNumber: true,
        serialNumber: true,
        onHand: true,
      },
    });
    // Fisher-Yates shuffle then take N
    for (let i = allOccupied.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOccupied[i], allOccupied[j]] = [allOccupied[j], allOccupied[i]];
    }
    inventoryRows = allOccupied.slice(0, count);
  } else if (plan.method === "abc") {
    inventoryRows = await collectAbcInventory(db, plan.frequency);
  }

  if (inventoryRows.length === 0) {
    return {
      adjustmentId: null,
      lineCount: 0,
      message: "No inventory rows matched the plan criteria",
    };
  }

  const adjustmentNumber = await nextSequence(db, "CC");

  const adjustment = await db.inventoryAdjustment.create({
    data: {
      adjustmentNumber,
      type: "cycle_count",
      status: "draft",
      reason: `Cycle count: ${plan.name} (${plan.method})`,
      createdBy: user.id,
      lines: {
        create: inventoryRows.map((row) => ({
          productId: row.productId,
          binId: row.binId,
          lotNumber: row.lotNumber,
          serialNumber: row.serialNumber,
          systemQty: row.onHand,
          countedQty: 0,
          variance: -row.onHand, // Will be updated when counts are submitted
        })),
      },
    },
  });

  // Update plan timestamps
  await db.cycleCountPlan.update({
    where: { id: planId },
    data: {
      lastRunAt: new Date(),
      nextRunAt: computeNextRunAt(plan.frequency),
    },
  });

  await logAudit(db, {
    userId: user.id,
    action: "create",
    entityType: "cycle_count",
    entityId: adjustment.id,
  });

  revalidatePath(REVALIDATE);
  return { adjustmentId: adjustment.id, lineCount: inventoryRows.length };
}

/**
 * Collect inventory for ABC method: A items counted weekly,
 * B items monthly, C items quarterly.
 */
async function collectAbcInventory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  frequency: string
): Promise<
  Array<{
    id: string;
    productId: string;
    binId: string;
    lotNumber: string | null;
    serialNumber: string | null;
    onHand: number;
  }>
> {
  // Get pick frequency from slotting recommendations to determine ABC class
  const recs = await db.slottingRecommendation.findMany({
    select: { productId: true, abcClass: true },
    distinct: ["productId"],
  });

  const abcMap = new Map<string, string>();
  for (const rec of recs) {
    abcMap.set(rec.productId, rec.abcClass);
  }

  const allOccupied = await db.inventory.findMany({
    where: { onHand: { gt: 0 } },
    select: {
      id: true,
      productId: true,
      binId: true,
      lotNumber: true,
      serialNumber: true,
      onHand: true,
    },
  });

  return allOccupied.filter((row: { productId: string }) => {
    const cls = abcMap.get(row.productId) ?? "C";
    return shouldCountAbc(cls, frequency);
  });
}

/**
 * Submit actual counts for a cycle count adjustment.
 * Records counted quantities and computes variance for each line.
 */
export async function submitCycleCount(data: unknown) {
  if (config.useMockData) return { success: true };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const db = tenant.db;
  const parsed = submitCountSchema.parse(data);

  const adjustment = await db.inventoryAdjustment.findUniqueOrThrow({
    where: { id: parsed.adjustmentId },
    include: { lines: true },
  });

  if (adjustment.type !== "cycle_count") {
    throw new Error("Adjustment is not a cycle count");
  }
  if (adjustment.status !== "draft") {
    throw new Error(`Cannot submit counts for adjustment in status: ${adjustment.status}`);
  }

  const lineMap = new Map(adjustment.lines.map((l: { id: string }) => [l.id, l]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.$transaction(async (prisma: any) => {
    for (const count of parsed.counts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const line = lineMap.get(count.lineId) as any;
      if (!line) {
        throw new Error(`Adjustment line ${count.lineId} not found`);
      }

      const variance = count.countedQty - line.systemQty;
      await prisma.adjustmentLine.update({
        where: { id: count.lineId },
        data: { countedQty: count.countedQty, variance },
      });
    }

    await prisma.inventoryAdjustment.update({
      where: { id: parsed.adjustmentId },
      data: { status: "pending_approval" },
    });
  });

  await logAudit(db, {
    userId: user.id,
    action: "update",
    entityType: "cycle_count",
    entityId: parsed.adjustmentId,
  });

  revalidatePath(REVALIDATE);
  return { success: true, adjustmentId: parsed.adjustmentId };
}

/**
 * Approve a cycle count: apply variances to inventory (onHand adjustments)
 * and write ledger entries (InventoryTransaction) for each non-zero variance.
 */
export async function approveCycleCount(adjustmentId: string) {
  if (config.useMockData) return { success: true };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const db = tenant.db;

  const adjustment = await db.inventoryAdjustment.findUniqueOrThrow({
    where: { id: adjustmentId },
    include: { lines: true },
  });

  if (adjustment.type !== "cycle_count") {
    throw new Error("Adjustment is not a cycle count");
  }
  if (adjustment.status !== "pending_approval") {
    throw new Error(`Cannot approve adjustment in status: ${adjustment.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.$transaction(async (prisma: any) => {
    for (const line of adjustment.lines) {
      if (line.variance === 0) continue;

      // Update inventory onHand and available
      const inv = await prisma.inventory.findFirst({
        where: {
          productId: line.productId,
          binId: line.binId,
          lotNumber: line.lotNumber,
          serialNumber: line.serialNumber,
        },
      });

      if (inv) {
        const newOnHand = inv.onHand + line.variance;
        await prisma.inventory.update({
          where: { id: inv.id },
          data: {
            onHand: Math.max(0, newOnHand),
            available: Math.max(0, newOnHand - inv.allocated),
          },
        });
      } else if (line.variance > 0) {
        // Found inventory that the system didn't know about
        await prisma.inventory.create({
          data: {
            productId: line.productId,
            binId: line.binId,
            lotNumber: line.lotNumber,
            serialNumber: line.serialNumber,
            onHand: line.variance,
            allocated: 0,
            available: line.variance,
          },
        });
      }

      // Write ledger entry
      await prisma.inventoryTransaction.create({
        data: {
          type: "count",
          productId: line.productId,
          fromBinId: line.variance < 0 ? line.binId : null,
          toBinId: line.variance > 0 ? line.binId : null,
          quantity: Math.abs(line.variance),
          referenceType: "cycle_count",
          referenceId: adjustmentId,
          reason: `Cycle count variance: system=${line.systemQty}, counted=${line.countedQty}`,
          performedBy: user.id,
        },
      });
    }

    await prisma.inventoryAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: "completed",
        approvedBy: user.id,
        approvedAt: new Date(),
        completedAt: new Date(),
      },
    });
  });

  await logAudit(db, {
    userId: user.id,
    action: "update",
    entityType: "cycle_count_approval",
    entityId: adjustmentId,
  });

  revalidatePath(REVALIDATE);
  return { success: true, adjustmentId };
}
