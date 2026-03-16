import { z } from "zod";

export const moveInventorySchema = z.object({
  productId: z.string().min(1),
  fromBinId: z.string().min(1),
  toBinId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

export const adjustmentSchema = z.object({
  type: z.enum(["adjustment", "cycle_count"]).default("adjustment"),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const adjustmentLineSchema = z.object({
  productId: z.string().min(1),
  binId: z.string().min(1),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  systemQty: z.coerce.number().int(),
  countedQty: z.coerce.number().int().min(0),
  notes: z.string().optional().nullable(),
});

export const cycleCountPlanSchema = z.object({
  name: z.string().min(1),
  method: z.enum(["abc", "zone", "full", "random"]),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]),
  config: z.record(z.unknown()).default({}),
});

export type MoveInventoryFormData = z.input<typeof moveInventorySchema>;
export type AdjustmentFormData = z.input<typeof adjustmentSchema>;
