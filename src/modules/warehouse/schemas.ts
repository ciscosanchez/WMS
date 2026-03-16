import { z } from "zod";

export const warehouseSchema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const zoneSchema = z.object({
  warehouseId: z.string().min(1),
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(["storage", "staging", "dock", "quarantine"]).default("storage"),
});

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

export type WarehouseFormData = z.input<typeof warehouseSchema>;
export type ZoneFormData = z.input<typeof zoneSchema>;
export type BulkLocationFormData = z.input<typeof bulkLocationSchema>;
