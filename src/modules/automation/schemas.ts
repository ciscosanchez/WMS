import { z } from "zod";

// ─── Device Schema ──────────────────────────────────────

export function deviceSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    warehouseId: z.string().min(1, msg("warehouseRequired", "Warehouse is required")),
    code: z
      .string()
      .min(1, msg("codeRequired", "Device code is required"))
      .max(50, msg("codeTooLong", "Code must be 50 characters or fewer")),
    name: z
      .string()
      .min(1, msg("nameRequired", "Device name is required"))
      .max(100, msg("nameTooLong", "Name must be 100 characters or fewer")),
    type: z.enum(["amr", "conveyor", "pick_to_light", "put_to_light", "sortation"], {
      errorMap: () => ({ message: msg("invalidType", "Invalid device type") }),
    }),
    zoneId: z.string().optional().nullable(),
    ipAddress: z.string().optional().nullable(),
    config: z.record(z.unknown()).optional().default({}),
  });
}

export const deviceSchemaStatic = deviceSchema();
export type DeviceInput = z.infer<typeof deviceSchemaStatic>;

// ─── Device Update Schema ───────────────────────────────

export function deviceUpdateSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    code: z
      .string()
      .min(1, msg("codeRequired", "Device code is required"))
      .max(50, msg("codeTooLong", "Code must be 50 characters or fewer"))
      .optional(),
    name: z
      .string()
      .min(1, msg("nameRequired", "Device name is required"))
      .max(100, msg("nameTooLong", "Name must be 100 characters or fewer"))
      .optional(),
    type: z.enum(["amr", "conveyor", "pick_to_light", "put_to_light", "sortation"]).optional(),
    zoneId: z.string().optional().nullable(),
    ipAddress: z.string().optional().nullable(),
    config: z.record(z.unknown()).optional(),
  });
}

export const deviceUpdateSchemaStatic = deviceUpdateSchema();
export type DeviceUpdateInput = z.infer<typeof deviceUpdateSchemaStatic>;

// ─── Device Status Schema ───────────────────────────────

export const deviceStatusSchema = z.enum([
  "dev_online",
  "dev_offline",
  "dev_error",
  "dev_maintenance",
]);
export type DeviceStatusValue = z.infer<typeof deviceStatusSchema>;

// ─── Device Task Schema ─────────────────────────────────

export function deviceTaskSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    deviceId: z.string().min(1, msg("deviceRequired", "Device is required")),
    taskType: z.enum(["transport", "sort", "pick_signal", "put_signal"], {
      errorMap: () => ({ message: msg("invalidTaskType", "Invalid task type") }),
    }),
    payload: z.record(z.unknown()).optional().default({}),
  });
}

export const deviceTaskSchemaStatic = deviceTaskSchema();
export type DeviceTaskInput = z.infer<typeof deviceTaskSchemaStatic>;
