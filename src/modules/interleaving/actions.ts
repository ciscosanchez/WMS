"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { startTaskTimeLog, completeTaskTimeLog } from "@/modules/labor/actions";

// ─── Build Interleaved Route ────────────────────────────────────────────────

/**
 * Build an interleaved route for an operator by combining pending picks,
 * putaways, and replenishments into a single bin-proximity-sorted trip.
 */
export async function buildInterleavedRoute(): Promise<{ routeId?: string; error?: string }> {
  if (config.useMockData) return { routeId: "mock-route" };

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    // Check if operator already has an active route
    const existing = await db.interleavedRoute.findFirst({
      where: { operatorId: user.id, status: { in: ["route_pending", "route_in_progress"] } },
    });
    if (existing) return { routeId: existing.id };

    // Gather candidate steps
    interface Step {
      type: string;
      referenceId: string;
      binId: string;
      binBarcode: string;
      productId: string;
      quantity: number;
    }
    const candidates: Step[] = [];

    // 1. Pending pick lines (from unassigned tasks, up to 15)
    const pickTasks = await db.pickTask.findMany({
      where: { status: "pending" },
      include: { lines: { include: { bin: { select: { id: true, barcode: true } } } } },
      take: 5,
    });
    for (const task of pickTasks) {
      for (const line of task.lines) {
        if (candidates.length >= 15) break;
        if (!line.binId) continue;
        candidates.push({
          type: "il_pick",
          referenceId: line.id,
          binId: line.binId,
          binBarcode: line.bin?.barcode ?? "zzz",
          productId: line.productId,
          quantity: line.quantity - line.pickedQty,
        });
      }
    }

    // 2. Pending putaway items (up to 10)
    const putawayTxns = await db.receivingTransaction.findMany({
      where: {
        binId: { not: null },
        NOT: {
          id: {
            in: (
              await db.inventoryTransaction.findMany({
                where: { type: "putaway", referenceType: "receiving_transaction" },
                select: { referenceId: true },
              })
            ).map((t: { referenceId: string | null }) => t.referenceId),
          },
        },
      },
      include: { bin: { select: { id: true, barcode: true } }, line: true },
      take: 10,
    });
    for (const tx of putawayTxns) {
      if (!tx.binId) continue;
      candidates.push({
        type: "il_putaway",
        referenceId: tx.id,
        binId: tx.binId,
        binBarcode: tx.bin?.barcode ?? "zzz",
        productId: tx.line.productId,
        quantity: tx.quantity,
      });
    }

    if (candidates.length === 0) {
      return { error: "No tasks available for interleaving" };
    }

    // Sort all steps by bin barcode (zone-aisle-rack-shelf walk order)
    candidates.sort((a, b) => a.binBarcode.localeCompare(b.binBarcode));

    // Create route with ordered steps
    const routeNumber = await nextSequence(tenant.db, "RTE");
    const route = await db.interleavedRoute.create({
      data: {
        routeNumber,
        operatorId: user.id,
        status: "route_in_progress",
        startedAt: new Date(),
        steps: {
          create: candidates.map((step, idx) => ({
            seq: idx + 1,
            type: step.type,
            referenceId: step.referenceId,
            binId: step.binId,
            productId: step.productId,
            quantity: step.quantity,
          })),
        },
      },
    });

    // Mark source pick tasks as in_progress
    const claimedTaskIds = new Set<string>();
    for (const task of pickTasks) {
      if (task.lines.some((l: { id: string }) => candidates.some((c) => c.referenceId === l.id))) {
        claimedTaskIds.add(task.id);
      }
    }
    if (claimedTaskIds.size > 0) {
      await db.pickTask.updateMany({
        where: { id: { in: Array.from(claimedTaskIds) }, status: "pending" },
        data: { status: "in_progress", assignedTo: user.id, startedAt: new Date() },
      });
    }

    // Start labor tracking
    startTaskTimeLog(tenant.db, user.id, "interleaved", route.id).catch(() => {});

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "interleaved_route",
      entityId: route.id,
      changes: { steps: { old: 0, new: candidates.length } },
    });

    revalidatePath("/interleave");
    return { routeId: route.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to build route" };
  }
}

// ─── Get Active Route ───────────────────────────────────────────────────────

export async function getMyInterleavedRoute() {
  if (config.useMockData) return null;

  const { user, tenant } = await requireTenantContext("operator:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.interleavedRoute.findFirst({
    where: { operatorId: user.id, status: { in: ["route_pending", "route_in_progress"] } },
    include: {
      steps: {
        orderBy: { seq: "asc" },
      },
    },
  });
}

// ─── Complete Step ──────────────────────────────────────────────────────────

export async function completeInterleavedStep(
  stepId: string,
  qty: number
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const step = await db.interleavedStep.findUniqueOrThrow({
      where: { id: stepId },
      include: { route: true },
    });

    if (step.status !== "il_pending") return {}; // Idempotent

    // Delegate to existing module logic based on step type
    if (step.type === "il_pick") {
      const { confirmPickLine } = await import("@/modules/operator/actions");
      await confirmPickLine(step.referenceId, qty);
    } else if (step.type === "il_putaway") {
      const { suggestPutawayBin } = await import("@/modules/operator/actions");
      const { confirmPutaway } = await import("@/modules/inventory/actions");
      const suggestion = await suggestPutawayBin(step.productId);
      if (suggestion) {
        await confirmPutaway(step.referenceId, suggestion.binId);
      }
    }

    // Mark step completed
    await db.interleavedStep.update({
      where: { id: stepId },
      data: { status: "il_completed", completedAt: new Date() },
    });

    // Check if all steps are done
    const remaining = await db.interleavedStep.count({
      where: { routeId: step.routeId, status: "il_pending" },
    });

    if (remaining === 0) {
      await db.interleavedRoute.update({
        where: { id: step.routeId },
        data: { status: "route_completed", completedAt: new Date() },
      });

      // Complete labor tracking
      const totalSteps = await db.interleavedStep.count({
        where: { routeId: step.routeId, status: "il_completed" },
      });
      const totalQty = await db.interleavedStep.aggregate({
        where: { routeId: step.routeId, status: "il_completed" },
        _sum: { quantity: true },
      });
      completeTaskTimeLog(tenant.db, step.routeId, totalQty._sum?.quantity ?? 0, totalSteps).catch(
        () => {}
      );
    }

    revalidatePath("/interleave");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to complete step" };
  }
}

// ─── Skip Step ──────────────────────────────────────────────────────────────

export async function skipInterleavedStep(stepId: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.interleavedStep.update({
      where: { id: stepId },
      data: { status: "il_skipped", completedAt: new Date() },
    });

    const step = await db.interleavedStep.findUnique({ where: { id: stepId } });
    const remaining = await db.interleavedStep.count({
      where: { routeId: step.routeId, status: "il_pending" },
    });

    if (remaining === 0) {
      await db.interleavedRoute.update({
        where: { id: step.routeId },
        data: { status: "route_completed", completedAt: new Date() },
      });
    }

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "interleaved_step",
      entityId: stepId,
      changes: { status: { old: "il_pending", new: "il_skipped" } },
    });

    revalidatePath("/interleave");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to skip step" };
  }
}

// ─── Cancel Route ───────────────────────────────────────────────────────────

export async function cancelInterleavedRoute(routeId: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.interleavedRoute.update({
      where: { id: routeId },
      data: { status: "route_completed", completedAt: new Date() },
    });

    // Mark remaining steps as skipped
    await db.interleavedStep.updateMany({
      where: { routeId, status: "il_pending" },
      data: { status: "il_skipped", completedAt: new Date() },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "interleaved_route",
      entityId: routeId,
      changes: { status: { old: "route_in_progress", new: "route_completed" } },
    });

    revalidatePath("/interleave");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to cancel route" };
  }
}
