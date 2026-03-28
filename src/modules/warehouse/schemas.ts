import { z } from "zod";

type T = (key: string) => string;

export function warehouseSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    code: z.string().min(1, msg("codeRequired", "Code is required")).max(20),
    name: z.string().min(1, msg("nameRequired", "Name is required")).max(200),
    address: z.string().max(500).optional().nullable(),
    isActive: z.boolean().default(true),
  });
}

export function zoneSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    warehouseId: z.string().min(1),
    code: z.string().min(1, msg("codeRequired", "Code is required")).max(20),
    name: z.string().min(1, msg("nameRequired", "Name is required")).max(200),
    type: z.enum(["storage", "staging", "dock", "quarantine"]).default("storage"),
  });
}

export const bulkLocationSchema = z.object({
  warehouseId: z.string().min(1),
  zoneCode: z.string().min(1),
  zoneName: z.string().min(1),
  zoneType: z.enum(["storage", "staging", "dock", "quarantine"]).default("storage"),
  aisles: z.coerce.number().int().min(1).max(100),
  racksPerAisle: z.coerce.number().int().min(1).max(100),
  shelvesPerRack: z.coerce.number().int().min(1).max(20),
  binsPerShelf: z.coerce.number().int().min(1).max(50),
  binType: z.enum(["standard", "bulk", "pick"]).default("standard"),
});

export const binSchema = z.object({
  shelfId: z.string().min(1),
  code: z.string().min(1).max(20),
  barcode: z.string().min(1).max(120),
  type: z.enum(["standard", "bulk", "pick"]).default("standard"),
  status: z.enum(["available", "full", "reserved", "blocked"]).default("available"),
  capacity: z.coerce.number().int().min(1).max(100000).optional().nullable(),
});

export const warehouseSchemaStatic = warehouseSchema();
export const zoneSchemaStatic = zoneSchema();
export const binSchemaStatic = binSchema;
export type WarehouseFormData = z.input<ReturnType<typeof warehouseSchema>>;
export type ZoneFormData = z.input<ReturnType<typeof zoneSchema>>;
export type BulkLocationFormData = z.input<typeof bulkLocationSchema>;
export type BinFormData = z.input<typeof binSchema>;
