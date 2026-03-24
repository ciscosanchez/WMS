"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { assertTransition, APPOINTMENT_TRANSITIONS } from "@/lib/workflow/transitions";
import {
  dockDoorSchemaStatic as dockDoorSchema,
  yardSpotSchemaStatic as yardSpotSchema,
  appointmentSchemaStatic as appointmentSchema,
  driverCheckInSchemaStatic as driverCheckInSchema,
} from "./schemas";

// ─── Dock Door CRUD ─────────────────────────────────────────────────────────

export async function getDockDoors(warehouseId?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("yard-dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.dockDoor.findMany({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      isActive: true,
    },
    include: { warehouse: { select: { code: true, name: true } } },
    orderBy: { code: "asc" },
  });
}

export async function getDockDoor(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await requireTenantContext("yard-dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.dockDoor.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      appointments: {
        where: { status: { notIn: ["completed", "cancelled", "no_show"] } },
        orderBy: { scheduledStart: "asc" },
        take: 5,
      },
    },
  });
}

export async function createDockDoor(data: unknown) {
  if (config.useMockData) return { id: "mock-new" };

  const { user, tenant } = await requireTenantContext("yard-dock:manage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const parsed = dockDoorSchema.parse(data);

  const door = await db.dockDoor.create({ data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "dock_door",
    entityId: door.id,
  });

  revalidatePath("/yard-dock");
  return door;
}

export async function updateDockDoor(id: string, data: unknown) {
  if (config.useMockData) return { id };

  const { user, tenant } = await requireTenantContext("yard-dock:manage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const parsed = dockDoorSchema.parse(data);

  const door = await db.dockDoor.update({ where: { id }, data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "dock_door",
    entityId: id,
  });

  revalidatePath("/yard-dock");
  return door;
}

export async function deleteDockDoor(id: string) {
  if (config.useMockData) return { id };

  const { user, tenant } = await requireTenantContext("yard-dock:manage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  await db.dockDoor.update({ where: { id }, data: { isActive: false } });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "dock_door",
    entityId: id,
  });

  revalidatePath("/yard-dock");
  return { id };
}

// ─── Yard Spot CRUD ─────────────────────────────────────────────────────────

export async function getYardSpots(warehouseId?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("yard-dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.yardSpot.findMany({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      isActive: true,
    },
    include: {
      warehouse: { select: { code: true, name: true } },
      yardVisits: {
        where: { status: { not: "departed" } },
        take: 1,
        orderBy: { arrivedAt: "desc" },
      },
    },
    orderBy: [{ row: "asc" }, { col: "asc" }, { code: "asc" }],
  });
}

export async function createYardSpot(data: unknown) {
  if (config.useMockData) return { id: "mock-new" };

  const { user, tenant } = await requireTenantContext("yard-dock:manage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const parsed = yardSpotSchema.parse(data);

  const spot = await db.yardSpot.create({ data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "yard_spot",
    entityId: spot.id,
  });

  revalidatePath("/yard-dock/yard-map");
  return spot;
}

export async function updateYardSpot(id: string, data: unknown) {
  if (config.useMockData) return { id };

  const { user, tenant } = await requireTenantContext("yard-dock:manage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const parsed = yardSpotSchema.parse(data);

  const spot = await db.yardSpot.update({ where: { id }, data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "yard_spot",
    entityId: id,
  });

  revalidatePath("/yard-dock/yard-map");
  return spot;
}

// ─── Dock Appointments ──────────────────────────────────────────────────────

/**
 * Check for overlapping appointments on the same dock door.
 * Returns true if an overlap exists.
 */
async function hasOverlap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  dockDoorId: string,
  start: Date,
  end: Date,
  excludeId?: string
): Promise<boolean> {
  const overlap = await db.dockAppointment.findFirst({
    where: {
      dockDoorId,
      status: { notIn: ["completed", "cancelled", "no_show"] },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return !!overlap;
}

export async function getAppointments(filters?: {
  warehouseId?: string;
  date?: string;
  direction?: string;
  status?: string;
  dockDoorId?: string;
}) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("yard-dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters?.direction) where.direction = filters.direction;
  if (filters?.status) where.status = filters.status;
  if (filters?.dockDoorId) where.dockDoorId = filters.dockDoorId;
  if (filters?.date) {
    const dayStart = new Date(filters.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(filters.date);
    dayEnd.setHours(23, 59, 59, 999);
    where.scheduledStart = { gte: dayStart, lte: dayEnd };
  }

  return db.dockAppointment.findMany({
    where,
    include: {
      dockDoor: { select: { code: true, name: true } },
      client: { select: { code: true, name: true } },
      inboundShipment: { select: { shipmentNumber: true, status: true } },
      outboundShipment: { select: { shipmentNumber: true, status: true } },
    },
    orderBy: { scheduledStart: "asc" },
  });
}

export async function getAppointment(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await requireTenantContext("yard-dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.dockAppointment.findUnique({
    where: { id },
    include: {
      dockDoor: true,
      warehouse: { select: { code: true, name: true } },
      client: { select: { code: true, name: true } },
      inboundShipment: { select: { id: true, shipmentNumber: true, status: true, carrier: true } },
      outboundShipment: { select: { id: true, shipmentNumber: true, status: true, carrier: true } },
      yardVisits: {
        include: { yardSpot: { select: { code: true, name: true } } },
        orderBy: { arrivedAt: "desc" },
      },
    },
  });
}

export async function createAppointment(
  data: unknown
): Promise<{ id?: string; appointmentNumber?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-new", appointmentNumber: "APPT-MOCK-001" };

  const { user, tenant } = await requireTenantContext("yard-dock:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const parsed = appointmentSchema.parse(data);

  // Validate no overlapping appointment on the same dock door
  if (parsed.dockDoorId) {
    const overlap = await hasOverlap(
      db,
      parsed.dockDoorId,
      parsed.scheduledStart,
      parsed.scheduledEnd
    );
    if (overlap) {
      return { error: "This dock door already has an appointment during that time slot" };
    }
  }

  const appointmentNumber = await nextSequence(tenant.db, "APPT");

  const appointment = await db.dockAppointment.create({
    data: {
      appointmentNumber,
      ...parsed,
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "dock_appointment",
    entityId: appointment.id,
  });

  revalidatePath("/yard-dock");
  return { id: appointment.id, appointmentNumber };
}

export async function updateAppointment(id: string, data: unknown): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  const { user, tenant } = await requireTenantContext("yard-dock:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  const parsed = appointmentSchema.parse(data);

  // Validate no overlapping appointment on the same dock door
  if (parsed.dockDoorId) {
    const overlap = await hasOverlap(
      db,
      parsed.dockDoorId,
      parsed.scheduledStart,
      parsed.scheduledEnd,
      id
    );
    if (overlap) {
      return { error: "This dock door already has an appointment during that time slot" };
    }
  }

  await db.dockAppointment.update({ where: { id }, data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "dock_appointment",
    entityId: id,
  });

  revalidatePath("/yard-dock");
  return {};
}

export async function updateAppointmentStatus(
  id: string,
  newStatus: string,
  extra?: { cancelReason?: string }
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("yard-dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const appointment = await db.dockAppointment.findUniqueOrThrow({ where: { id } });

    // Validate state machine
    assertTransition("appointment", appointment.status, newStatus, APPOINTMENT_TRANSITIONS);

    // Build conditional timestamp updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { status: newStatus };
    const now = new Date();

    if (newStatus === "checked_in") updateData.actualArrival = now;
    if (newStatus === "at_dock" || newStatus === "loading" || newStatus === "unloading")
      updateData.dockStart = now;
    if (newStatus === "completed") updateData.dockEnd = now;
    if (newStatus === "cancelled" && extra?.cancelReason)
      updateData.cancelReason = extra.cancelReason;

    // If moving to dock, set the dock door status to occupied
    if (newStatus === "at_dock" && appointment.dockDoorId) {
      await db.dockDoor.update({
        where: { id: appointment.dockDoorId },
        data: { status: "occupied" },
      });
    }

    // If completing or cancelling, free the dock door
    if (
      (newStatus === "completed" || newStatus === "cancelled" || newStatus === "no_show") &&
      appointment.dockDoorId
    ) {
      await db.dockDoor.update({
        where: { id: appointment.dockDoorId },
        data: { status: "available" },
      });
    }

    await db.dockAppointment.update({ where: { id }, data: updateData });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "dock_appointment",
      entityId: id,
      changes: { status: { old: appointment.status, new: newStatus } },
    });

    revalidatePath("/yard-dock");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update appointment status" };
  }
}

export async function assignDockDoor(
  appointmentId: string,
  dockDoorId: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  const { user, tenant } = await requireTenantContext("yard-dock:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const appointment = await db.dockAppointment.findUniqueOrThrow({ where: { id: appointmentId } });

  // Validate no overlap on the new dock door
  const overlap = await hasOverlap(
    db,
    dockDoorId,
    appointment.scheduledStart,
    appointment.scheduledEnd,
    appointmentId
  );
  if (overlap) {
    return { error: "This dock door already has an appointment during that time slot" };
  }

  await db.dockAppointment.update({
    where: { id: appointmentId },
    data: { dockDoorId },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "dock_appointment",
    entityId: appointmentId,
    changes: { dockDoorId: { old: appointment.dockDoorId, new: dockDoorId } },
  });

  revalidatePath("/yard-dock");
  return {};
}

// ─── Driver Check-In ────────────────────────────────────────────────────────

export async function driverCheckIn(
  data: unknown
): Promise<{ error?: string; appointmentId?: string }> {
  if (config.useMockData) return { appointmentId: "mock-1" };

  try {
    const { user, tenant } = await requireTenantContext("yard-dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = driverCheckInSchema.parse(data);

    // Look up appointment by number
    const appointment = await db.dockAppointment.findUnique({
      where: { appointmentNumber: parsed.appointmentNumber },
    });

    if (!appointment) {
      return { error: `Appointment ${parsed.appointmentNumber} not found` };
    }

    // Must be in "confirmed" status to check in
    if (appointment.status !== "confirmed") {
      return { error: `Appointment is in "${appointment.status}" status — expected "confirmed"` };
    }

    // Update appointment with driver info and transition to checked_in
    await db.dockAppointment.update({
      where: { id: appointment.id },
      data: {
        status: "checked_in",
        driverName: parsed.driverName,
        driverLicense: parsed.driverLicense || null,
        driverPhone: parsed.driverPhone || null,
        trailerNumber: parsed.trailerNumber,
        actualArrival: new Date(),
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "dock_appointment",
      entityId: appointment.id,
      changes: { status: { old: "confirmed", new: "checked_in" } },
    });

    revalidatePath("/yard-dock");
    return { appointmentId: appointment.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check-in failed" };
  }
}

// ─── Re-exports from yard-actions.ts (split for <500 line rule) ──────────────
export {
  getActiveYardVisits,
  createYardVisit,
  moveTrailer,
  updateYardVisitStatus,
  getCalendarAppointments,
  getYardDockStats,
} from "./yard-actions";
