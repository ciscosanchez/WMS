"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";

// ─── Manager Dashboard Queries ──────────────────────────────────────────────

export async function getLaborDashboard() {
  if (config.useMockData) {
    return {
      activeOperators: 0,
      avgUph: 0,
      avgTph: 0,
      laborCostMtd: 0,
      costPerUnit: 0,
      productivityByOperator: [],
      productivityTrend: [],
      taskDistribution: [],
      leaderboard: [],
    };
  }

  const { tenant } = await requireTenantContext("operator:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeOperators = await db.operatorShift.count({
    where: { status: "clocked_in" },
  });

  const todayLogs = await db.taskTimeLog.findMany({
    where: { completedAt: { gte: todayStart } },
  });

  let totalUnits = 0;
  let totalTaskHours = 0;
  for (const log of todayLogs) {
    totalUnits += log.unitsHandled;
    if (log.completedAt && log.startedAt) {
      totalTaskHours +=
        (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 3600000;
    }
  }
  const avgUph = totalTaskHours > 0 ? Math.round(totalUnits / totalTaskHours) : 0;
  const avgTph = totalTaskHours > 0 ? Math.round((todayLogs.length / totalTaskHours) * 10) / 10 : 0;

  const mtdShifts = await db.operatorShift.findMany({
    where: { clockIn: { gte: monthStart }, status: "clocked_out" },
  });
  let laborCostMtd = 0;
  let mtdTotalUnits = 0;
  for (const shift of mtdShifts) {
    if (shift.hourlyRate && shift.clockOut) {
      const hours =
        (new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime()) / 3600000;
      const productive = Math.max(0, hours - shift.breakMinutes / 60);
      laborCostMtd += productive * Number(shift.hourlyRate);
    }
  }

  const mtdLogs = await db.taskTimeLog.findMany({
    where: { completedAt: { gte: monthStart } },
    select: { unitsHandled: true },
  });
  for (const log of mtdLogs) mtdTotalUnits += log.unitsHandled;
  const costPerUnit =
    mtdTotalUnits > 0 ? Math.round((laborCostMtd / mtdTotalUnits) * 100) / 100 : 0;

  const taskCounts = await db.taskTimeLog.groupBy({
    by: ["taskType"],
    where: { completedAt: { gte: todayStart } },
    _count: true,
  });
  const taskDistribution = taskCounts.map((t: { taskType: string; _count: number }) => ({
    name: t.taskType,
    value: t._count,
  }));

  const operatorStats: Record<string, { tasks: number; units: number; hours: number }> = {};
  for (const log of todayLogs) {
    if (!operatorStats[log.operatorId]) {
      operatorStats[log.operatorId] = { tasks: 0, units: 0, hours: 0 };
    }
    operatorStats[log.operatorId].tasks += 1;
    operatorStats[log.operatorId].units += log.unitsHandled;
    if (log.completedAt && log.startedAt) {
      operatorStats[log.operatorId].hours +=
        (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 3600000;
    }
  }

  const leaderboard = Object.entries(operatorStats)
    .map(([operatorId, stats]) => ({
      operatorId,
      tasks: stats.tasks,
      units: stats.units,
      hours: Math.round(stats.hours * 10) / 10,
      uph: stats.hours > 0 ? Math.round(stats.units / stats.hours) : 0,
    }))
    .sort((a, b) => b.uph - a.uph);

  return {
    activeOperators,
    avgUph,
    avgTph,
    laborCostMtd: Math.round(laborCostMtd * 100) / 100,
    costPerUnit,
    taskDistribution,
    leaderboard,
    productivityByOperator: leaderboard.map((op) => ({
      name: op.operatorId.slice(0, 8),
      uph: op.uph,
    })),
    productivityTrend: await getProductivityTrend(db, 14),
  };
}

/** Daily average UPH over the last N days. */
async function getProductivityTrend(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  days: number
): Promise<{ date: string; uph: number }[]> {
  const trend: { date: string; uph: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const logs = await db.taskTimeLog.findMany({
      where: { completedAt: { gte: dayStart, lte: dayEnd } },
      select: { unitsHandled: true, startedAt: true, completedAt: true },
    });

    let units = 0;
    let hours = 0;
    for (const log of logs) {
      units += log.unitsHandled;
      if (log.completedAt && log.startedAt) {
        hours +=
          (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 3600000;
      }
    }

    trend.push({
      date: dayStart.toISOString().slice(0, 10),
      uph: hours > 0 ? Math.round(units / hours) : 0,
    });
  }

  return trend;
}

// ─── Shift History ──────────────────────────────────────────────────────────

export async function getShifts(filters?: {
  dateFrom?: string;
  dateTo?: string;
  operatorId?: string;
}) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("operator:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (filters?.operatorId) where.operatorId = filters.operatorId;
  if (filters?.dateFrom || filters?.dateTo) {
    where.clockIn = {};
    if (filters?.dateFrom) where.clockIn.gte = new Date(filters.dateFrom);
    if (filters?.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      where.clockIn.lte = end;
    }
  }

  return db.operatorShift.findMany({
    where,
    include: {
      taskTimeLogs: {
        select: { unitsHandled: true, linesHandled: true, taskType: true },
      },
    },
    orderBy: { clockIn: "desc" },
    take: 200,
  });
}

// ─── Cost Report ────────────────────────────────────────────────────────────

export async function getLaborCostReport(dateFrom: string, dateTo: string, clientId?: string) {
  if (config.useMockData)
    return { totalHours: 0, totalCost: 0, totalUnits: 0, costPerUnit: 0, byClient: [] };

  const { tenant } = await requireTenantContext("settings:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const start = new Date(dateFrom);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateTo);
  end.setHours(23, 59, 59, 999);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logWhere: Record<string, any> = { completedAt: { gte: start, lte: end } };
  if (clientId) logWhere.clientId = clientId;

  const logs = await db.taskTimeLog.findMany({ where: logWhere });

  const byClient: Record<string, { hours: number; units: number; cost: number }> = {};
  for (const log of logs) {
    const key = log.clientId ?? "unattributed";
    if (!byClient[key]) byClient[key] = { hours: 0, units: 0, cost: 0 };
    byClient[key].units += log.unitsHandled;
    if (log.completedAt && log.startedAt) {
      byClient[key].hours +=
        (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 3600000;
    }
  }

  const shifts = await db.operatorShift.findMany({
    where: { clockIn: { gte: start }, clockOut: { lte: end }, status: "clocked_out" },
  });

  let totalCost = 0;
  let totalHours = 0;
  for (const shift of shifts) {
    if (shift.hourlyRate && shift.clockOut) {
      const hours =
        (new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime()) / 3600000;
      const productive = Math.max(0, hours - shift.breakMinutes / 60);
      totalHours += productive;
      totalCost += productive * Number(shift.hourlyRate);
    }
  }

  let totalUnits = 0;
  const clientEntries = Object.entries(byClient).map(([cId, data]) => {
    totalUnits += data.units;
    const proportion = totalHours > 0 ? data.hours / totalHours : 0;
    const cost = Math.round(totalCost * proportion * 100) / 100;
    return { clientId: cId, hours: Math.round(data.hours * 10) / 10, units: data.units, cost };
  });

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalCost: Math.round(totalCost * 100) / 100,
    totalUnits,
    costPerUnit: totalUnits > 0 ? Math.round((totalCost / totalUnits) * 100) / 100 : 0,
    byClient: clientEntries,
  };
}

// ─── Labor Rates ────────────────────────────────────────────────────────────

export async function getLaborRates() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("settings:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.laborRate.findMany({
    where: { isActive: true },
    orderBy: [{ operatorId: "asc" }, { effectiveFrom: "desc" }],
  });
}

export async function saveLaborRate(data: {
  operatorId?: string | null;
  role?: string | null;
  hourlyRate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("settings:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.laborRate.create({
      data: {
        operatorId: data.operatorId || null,
        role: data.role || null,
        hourlyRate: data.hourlyRate,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "labor_rate",
      entityId: "new",
    });

    revalidatePath("/labor");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save rate" };
  }
}
