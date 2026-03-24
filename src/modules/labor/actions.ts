"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { captureEvent } from "@/modules/billing/capture";

// ─── Shift Management (called from operator app) ────────────────────────────

/**
 * Resolve the current hourly rate for an operator.
 * Priority: operator-specific rate > role-based rate > null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveHourlyRate(db: any, operatorId: string): Promise<number | null> {
  const now = new Date();
  const rate = await db.laborRate.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      operatorId,
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (rate) return Number(rate.hourlyRate);

  // Fall back to default rate (operatorId is null)
  const defaultRate = await db.laborRate.findFirst({
    where: {
      isActive: true,
      operatorId: null,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  return defaultRate ? Number(defaultRate.hourlyRate) : null;
}

export async function clockIn(): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-shift" };

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    // Check if already clocked in
    const active = await db.operatorShift.findFirst({
      where: { operatorId: user.id, status: "clocked_in" },
    });
    if (active) return { id: active.id }; // Idempotent

    const hourlyRate = await resolveHourlyRate(db, user.id);

    const shift = await db.operatorShift.create({
      data: {
        operatorId: user.id,
        clockIn: new Date(),
        hourlyRate,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "operator_shift",
      entityId: shift.id,
    });

    revalidatePath("/shift");
    return { id: shift.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Clock in failed" };
  }
}

export async function clockOut(): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const shift = await db.operatorShift.findFirst({
      where: { operatorId: user.id, status: "clocked_in" },
      include: { taskTimeLogs: true },
    });
    if (!shift) return { error: "No active shift" };

    const clockOut = new Date();
    await db.operatorShift.update({
      where: { id: shift.id },
      data: { clockOut, status: "clocked_out" },
    });

    // Capture labor billing events per client
    if (shift.hourlyRate) {
      const totalMinutes = (clockOut.getTime() - new Date(shift.clockIn).getTime()) / 60000;
      const productiveHours = Math.max(0, (totalMinutes - shift.breakMinutes) / 60);

      // Group task time by client for per-client billing
      const clientMinutes: Record<string, number> = {};
      for (const log of shift.taskTimeLogs) {
        if (!log.clientId || !log.completedAt) continue;
        const mins =
          (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 60000;
        clientMinutes[log.clientId] = (clientMinutes[log.clientId] ?? 0) + mins;
      }

      const totalTaskMinutes = Object.values(clientMinutes).reduce(
        (s: number, m: number) => s + m,
        0
      );

      // Allocate labor hours proportionally to each client
      for (const [clientId, mins] of Object.entries(clientMinutes)) {
        const proportion = totalTaskMinutes > 0 ? mins / totalTaskMinutes : 0;
        const clientHours = productiveHours * proportion;
        if (clientHours > 0) {
          await captureEvent(tenant.db, {
            clientId,
            serviceType: "labor_hour",
            qty: Math.round(clientHours * 100) / 100,
            referenceType: "shift",
            referenceId: shift.id,
          });
        }
      }
    }

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "operator_shift",
      entityId: shift.id,
      changes: { status: { old: "clocked_in", new: "clocked_out" } },
    });

    revalidatePath("/shift");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Clock out failed" };
  }
}

export async function getMyActiveShift() {
  if (config.useMockData) return null;

  const { user, tenant } = await requireTenantContext("operator:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.operatorShift.findFirst({
    where: { operatorId: user.id, status: "clocked_in" },
  });
}

export async function addBreakTime(minutes: number): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const shift = await db.operatorShift.findFirst({
      where: { operatorId: user.id, status: "clocked_in" },
    });
    if (!shift) return { error: "No active shift" };

    await db.operatorShift.update({
      where: { id: shift.id },
      data: { breakMinutes: { increment: minutes } },
    });

    revalidatePath("/shift");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add break" };
  }
}

// ─── Task Time Log Helpers (called from other modules) ──────────────────────

/**
 * Start tracking time for a task. Called when an operator claims/starts a task.
 * Returns the TaskTimeLog id.
 */
export async function startTaskTimeLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  operatorId: string,
  taskType: string,
  referenceId: string,
  clientId?: string | null
): Promise<string | null> {
  try {
    // Find active shift for this operator
    const shift = await db.operatorShift.findFirst({
      where: { operatorId, status: "clocked_in" },
    });

    const log = await db.taskTimeLog.create({
      data: {
        shiftId: shift?.id ?? null,
        operatorId,
        taskType,
        referenceId,
        clientId: clientId ?? null,
        startedAt: new Date(),
      },
    });

    return log.id;
  } catch {
    return null; // Never break the main workflow
  }
}

/**
 * Complete a task time log. Called when a task finishes.
 */
export async function completeTaskTimeLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  referenceId: string,
  unitsHandled: number,
  linesHandled: number
): Promise<void> {
  try {
    const log = await db.taskTimeLog.findFirst({
      where: { referenceId, completedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!log) return;

    await db.taskTimeLog.update({
      where: { id: log.id },
      data: {
        completedAt: new Date(),
        unitsHandled,
        linesHandled,
      },
    });
  } catch {
    // Never break the main workflow
  }
}
