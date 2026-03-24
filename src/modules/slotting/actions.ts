"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { slottingQueue } from "@/lib/jobs/queue";
import { z } from "zod";

// ─── Config ─────────────────────────────────────────────────────────────────

export async function getSlottingConfig(warehouseId: string) {
  if (config.useMockData) return null;

  const { tenant } = await requireTenantContext("inventory:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.slottingConfig.findUnique({ where: { warehouseId } });
}

const configSchema = z.object({
  abcAThreshold: z.number().int().min(1).max(99),
  abcBThreshold: z.number().int().min(1).max(99),
  lookbackDays: z.number().int().min(7).max(365),
  weightPenalty: z.number().min(0).max(10),
  zonePrefs: z.record(z.unknown()).optional(),
});

export async function updateSlottingConfig(
  warehouseId: string,
  data: unknown
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("inventory:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = configSchema.parse(data);

    await db.slottingConfig.upsert({
      where: { warehouseId },
      create: { warehouseId, ...parsed, zonePrefs: parsed.zonePrefs ?? {} },
      update: { ...parsed, zonePrefs: parsed.zonePrefs ?? {} },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "slotting_config",
      entityId: warehouseId,
    });

    revalidatePath("/inventory/slotting");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save config" };
  }
}

// ─── Runs ───────────────────────────────────────────────────────────────────

export async function triggerSlottingRun(
  warehouseId: string
): Promise<{ runId?: string; error?: string }> {
  if (config.useMockData) return { runId: "mock-run" };

  try {
    const { user, tenant } = await requireTenantContext("inventory:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const run = await db.slottingRun.create({
      data: {
        warehouseId,
        triggeredBy: user.id,
      },
    });

    await slottingQueue.add("slotting_analysis", {
      tenantId: tenant.tenantId,
      runId: run.id,
      warehouseId,
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "slotting_run",
      entityId: run.id,
    });

    revalidatePath("/inventory/slotting");
    return { runId: run.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to trigger run" };
  }
}

export async function getSlottingRuns(warehouseId?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("inventory:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.slottingRun.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getSlottingRun(runId: string) {
  if (config.useMockData) return null;

  const { tenant } = await requireTenantContext("inventory:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.slottingRun.findUnique({
    where: { id: runId },
    include: {
      recommendations: {
        orderBy: { totalScore: "desc" },
        take: 200,
      },
    },
  });
}

// ─── Recommendations ────────────────────────────────────────────────────────

export async function getRecommendations(
  runId: string,
  filters?: { abcClass?: string; status?: string }
) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("inventory:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { runId };
  if (filters?.abcClass) where.abcClass = filters.abcClass;
  if (filters?.status) where.status = filters.status;

  return db.slottingRecommendation.findMany({
    where,
    orderBy: { totalScore: "desc" },
    take: 200,
  });
}

export async function updateRecommendationStatus(
  recommendationId: string,
  status: "rec_accepted" | "rec_rejected"
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("inventory:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.slottingRecommendation.update({
      where: { id: recommendationId },
      data: { status },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "slotting_recommendation",
      entityId: recommendationId,
      changes: { status: { old: null, new: status } },
    });

    revalidatePath("/inventory/slotting");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update recommendation" };
  }
}

export async function bulkUpdateRecommendations(
  runId: string,
  status: "rec_accepted" | "rec_rejected"
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("inventory:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.slottingRecommendation.updateMany({
      where: { runId, status: "rec_pending" },
      data: { status },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "slotting_run",
      entityId: runId,
      changes: { bulkAction: { old: null, new: status } },
    });

    revalidatePath("/inventory/slotting");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bulk update failed" };
  }
}

/**
 * Execute re-slotting: create inventory moves for all accepted recommendations.
 * Processes sequentially to avoid overloading the move transaction.
 */
export async function executeReSlot(runId: string): Promise<{ moved?: number; error?: string }> {
  if (config.useMockData) return { moved: 0 };

  try {
    const { user, tenant } = await requireTenantContext("inventory:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const accepted = await db.slottingRecommendation.findMany({
      where: { runId, status: "rec_accepted" },
    });

    if (accepted.length === 0) {
      return { error: "No accepted recommendations to execute" };
    }

    const { moveInventory } = await import("@/modules/inventory/mutations");
    let moved = 0;

    for (const rec of accepted) {
      try {
        // Find the inventory record to know how much to move
        const inv = await db.inventory.findFirst({
          where: { productId: rec.productId, binId: rec.currentBinId },
        });
        if (!inv || inv.available <= 0) continue;

        await moveInventory({
          productId: rec.productId,
          fromBinId: rec.currentBinId,
          toBinId: rec.recommendedBinId,
          quantity: inv.available, // Move all available stock
        });

        await db.slottingRecommendation.update({
          where: { id: rec.id },
          data: { status: "rec_moved" },
        });

        moved++;
      } catch {
        // Skip individual failures, continue with remaining
        continue;
      }
    }

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "slotting_run",
      entityId: runId,
      changes: { reSlotExecuted: { old: 0, new: moved } },
    });

    revalidatePath("/inventory/slotting");
    revalidatePath("/inventory");
    return { moved };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Re-slotting failed" };
  }
}
