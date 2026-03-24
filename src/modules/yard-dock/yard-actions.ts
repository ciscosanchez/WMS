"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { assertTransition, YARD_VISIT_TRANSITIONS } from "@/lib/workflow/transitions";
import { yardVisitSchemaStatic as yardVisitSchema } from "./schemas";

// ─── Yard Visits ────────────────────────────────────────────────────────────

export async function getActiveYardVisits(warehouseId?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("yard-dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.yardVisit.findMany({
    where: {
      status: { not: "departed" },
      ...(warehouseId ? { yardSpot: { warehouseId } } : {}),
    },
    include: {
      yardSpot: { select: { code: true, name: true, type: true } },
      appointment: { select: { appointmentNumber: true, direction: true, status: true } },
    },
    orderBy: { arrivedAt: "desc" },
  });
}

export async function createYardVisit(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-new" };

  try {
    const { user, tenant } = await requireTenantContext("yard-dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = yardVisitSchema.parse(data);

    const spot = await db.yardSpot.findUniqueOrThrow({ where: { id: parsed.yardSpotId } });
    if (spot.status === "occupied") {
      return { error: `Yard spot ${spot.code} is already occupied` };
    }
    if (spot.status === "blocked") {
      return { error: `Yard spot ${spot.code} is blocked` };
    }

    const visit = await db.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (prisma: any) => {
        const v = await prisma.yardVisit.create({
          data: {
            yardSpotId: parsed.yardSpotId,
            trailerNumber: parsed.trailerNumber,
            carrier: parsed.carrier || null,
            sealNumber: parsed.sealNumber || null,
            appointmentId: parsed.appointmentId || null,
            notes: parsed.notes || null,
          },
        });
        await prisma.yardSpot.update({
          where: { id: parsed.yardSpotId },
          data: { status: "occupied" },
        });
        return v;
      }
    );

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "yard_visit",
      entityId: visit.id,
    });

    revalidatePath("/yard-dock/yard-map");
    return { id: visit.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create yard visit" };
  }
}

export async function moveTrailer(
  yardVisitId: string,
  newYardSpotId: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("yard-dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const visit = await db.yardVisit.findUniqueOrThrow({ where: { id: yardVisitId } });
    if (visit.status === "departed") {
      return { error: "Cannot move a departed trailer" };
    }

    const newSpot = await db.yardSpot.findUniqueOrThrow({ where: { id: newYardSpotId } });
    if (newSpot.status === "occupied" || newSpot.status === "blocked") {
      return { error: `Yard spot ${newSpot.code} is not available` };
    }

    await db.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (prisma: any) => {
        await prisma.yardSpot.update({
          where: { id: visit.yardSpotId },
          data: { status: "empty" },
        });
        await prisma.yardSpot.update({
          where: { id: newYardSpotId },
          data: { status: "occupied" },
        });
        await prisma.yardVisit.update({
          where: { id: yardVisitId },
          data: { yardSpotId: newYardSpotId },
        });
      }
    );

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "yard_visit",
      entityId: yardVisitId,
      changes: { yardSpotId: { old: visit.yardSpotId, new: newYardSpotId } },
    });

    revalidatePath("/yard-dock/yard-map");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to move trailer" };
  }
}

export async function updateYardVisitStatus(
  yardVisitId: string,
  newStatus: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("yard-dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const visit = await db.yardVisit.findUniqueOrThrow({ where: { id: yardVisitId } });
    assertTransition("yard_visit", visit.status, newStatus, YARD_VISIT_TRANSITIONS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { status: newStatus };
    if (newStatus === "departed") updateData.departedAt = new Date();

    await db.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (prisma: any) => {
        await prisma.yardVisit.update({ where: { id: yardVisitId }, data: updateData });
        if (newStatus === "departed") {
          await prisma.yardSpot.update({
            where: { id: visit.yardSpotId },
            data: { status: "empty" },
          });
        }
      }
    );

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "yard_visit",
      entityId: yardVisitId,
      changes: { status: { old: visit.status, new: newStatus } },
    });

    revalidatePath("/yard-dock/yard-map");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update yard visit" };
  }
}

// ─── Calendar Data ──────────────────────────────────────────────────────────

export async function getCalendarAppointments(
  warehouseId: string,
  startDate: string,
  endDate: string
) {
  if (config.useMockData) return { doors: [], appointments: [] };

  const { tenant } = await requireTenantContext("yard-dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const [doors, appointments] = await Promise.all([
    db.dockDoor.findMany({
      where: { warehouseId, isActive: true },
      select: { id: true, code: true, name: true, type: true, status: true },
      orderBy: { code: "asc" },
    }),
    db.dockAppointment.findMany({
      where: {
        warehouseId,
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
        status: { notIn: ["cancelled", "no_show"] },
      },
      include: {
        dockDoor: { select: { code: true } },
        client: { select: { code: true, name: true } },
      },
      orderBy: { scheduledStart: "asc" },
    }),
  ]);

  return { doors, appointments };
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

export async function getYardDockStats(warehouseId?: string) {
  if (config.useMockData) {
    return {
      todayAppointments: 0,
      activeVisits: 0,
      doorsAvailable: 0,
      doorsTotal: 0,
      spotsOccupied: 0,
      spotsTotal: 0,
    };
  }

  const { tenant } = await requireTenantContext("yard-dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const warehouseFilter = warehouseId ? { warehouseId } : {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayAppointments, activeVisits, doors, spots] = await Promise.all([
    db.dockAppointment.count({
      where: {
        ...warehouseFilter,
        scheduledStart: { gte: today, lt: tomorrow },
        status: { notIn: ["cancelled", "no_show"] },
      },
    }),
    db.yardVisit.count({
      where: {
        status: { not: "departed" },
        ...(warehouseId ? { yardSpot: { warehouseId } } : {}),
      },
    }),
    db.dockDoor.findMany({
      where: { ...warehouseFilter, isActive: true },
      select: { status: true },
    }),
    db.yardSpot.findMany({
      where: { ...warehouseFilter, isActive: true },
      select: { status: true },
    }),
  ]);

  return {
    todayAppointments,
    activeVisits,
    doorsAvailable: doors.filter((d: { status: string }) => d.status === "available").length,
    doorsTotal: doors.length,
    spotsOccupied: spots.filter((s: { status: string }) => s.status === "occupied").length,
    spotsTotal: spots.length,
  };
}
