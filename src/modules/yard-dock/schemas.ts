import { z } from "zod";

// ─── Dock Door ──────────────────────────────────────────────────────────────

export function dockDoorSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    code: z.string().min(1, msg("codeRequired", "Code is required")).max(20),
    name: z.string().min(1, msg("nameRequired", "Name is required")).max(100),
    warehouseId: z.string().min(1, msg("warehouseRequired", "Warehouse is required")),
    type: z.enum(["inbound", "outbound", "both"]).default("both"),
    notes: z.string().max(500).optional().nullable(),
  });
}

export const dockDoorSchemaStatic = dockDoorSchema();
export type DockDoorInput = z.infer<typeof dockDoorSchemaStatic>;

// ─── Yard Spot ──────────────────────────────────────────────────────────────

export function yardSpotSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    code: z.string().min(1, msg("codeRequired", "Code is required")).max(20),
    name: z.string().min(1, msg("nameRequired", "Name is required")).max(100),
    warehouseId: z.string().min(1, msg("warehouseRequired", "Warehouse is required")),
    type: z.enum(["parking", "staging", "refrigerated", "hazmat"]).default("parking"),
    row: z.number().int().nonnegative().optional().nullable(),
    col: z.number().int().nonnegative().optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  });
}

export const yardSpotSchemaStatic = yardSpotSchema();
export type YardSpotInput = z.infer<typeof yardSpotSchemaStatic>;

// ─── Dock Appointment ───────────────────────────────────────────────────────

export function appointmentSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z
    .object({
      direction: z.enum(["inbound", "outbound"]),
      warehouseId: z.string().min(1, msg("warehouseRequired", "Warehouse is required")),
      dockDoorId: z.string().optional().nullable(),
      clientId: z.string().optional().nullable(),
      scheduledStart: z.coerce.date({
        required_error: msg("startRequired", "Start time is required"),
      }),
      scheduledEnd: z.coerce.date({ required_error: msg("endRequired", "End time is required") }),
      carrier: z.string().max(100).optional().nullable(),
      trailerNumber: z.string().max(50).optional().nullable(),
      driverName: z.string().max(100).optional().nullable(),
      driverPhone: z.string().max(30).optional().nullable(),
      inboundShipmentId: z.string().optional().nullable(),
      outboundShipmentId: z.string().optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
    })
    .refine((data) => data.scheduledEnd > data.scheduledStart, {
      message: t ? t("endAfterStart") : "End time must be after start time",
      path: ["scheduledEnd"],
    });
}

export const appointmentSchemaStatic = appointmentSchema();
export type AppointmentInput = z.infer<typeof appointmentSchemaStatic>;

// ─── Driver Check-In ────────────────────────────────────────────────────────

export function driverCheckInSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    appointmentNumber: z
      .string()
      .min(1, msg("appointmentRequired", "Appointment number is required")),
    driverName: z.string().min(1, msg("driverNameRequired", "Driver name is required")).max(100),
    driverLicense: z.string().max(50).optional().nullable(),
    driverPhone: z.string().max(30).optional().nullable(),
    trailerNumber: z.string().min(1, msg("trailerRequired", "Trailer number is required")).max(50),
  });
}

export const driverCheckInSchemaStatic = driverCheckInSchema();
export type DriverCheckInInput = z.infer<typeof driverCheckInSchemaStatic>;

// ─── Yard Visit ─────────────────────────────────────────────────────────────

export function yardVisitSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    yardSpotId: z.string().min(1, msg("spotRequired", "Yard spot is required")),
    trailerNumber: z.string().min(1, msg("trailerRequired", "Trailer number is required")).max(50),
    carrier: z.string().max(100).optional().nullable(),
    sealNumber: z.string().max(50).optional().nullable(),
    appointmentId: z.string().optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  });
}

export const yardVisitSchemaStatic = yardVisitSchema();
export type YardVisitInput = z.infer<typeof yardVisitSchemaStatic>;
