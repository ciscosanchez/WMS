import { z } from "zod";

export function crossDockRuleSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    clientId: z.string().optional().nullable(),
    productId: z.string().optional().nullable(),
    priority: z.number().int().min(0, msg("priorityMin", "Priority must be 0 or greater")).default(0),
  });
}

export const crossDockRuleSchemaStatic = crossDockRuleSchema();
export type CrossDockRuleInput = z.infer<typeof crossDockRuleSchemaStatic>;

export function crossDockPlanSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    inboundShipmentId: z.string().min(1, msg("inboundRequired", "Inbound shipment is required")),
    outboundOrderId: z.string().min(1, msg("outboundRequired", "Outbound order is required")),
    productId: z.string().min(1, msg("productRequired", "Product is required")),
    quantity: z.number().int().positive(msg("qtyPositive", "Quantity must be positive")),
    sourceDockDoorId: z.string().optional().nullable(),
    targetDockDoorId: z.string().optional().nullable(),
  });
}

export const crossDockPlanSchemaStatic = crossDockPlanSchema();
export type CrossDockPlanInput = z.infer<typeof crossDockPlanSchemaStatic>;

export const crossDockStatusSchema = z.enum([
  "cd_identified",
  "cd_approved",
  "cd_in_progress",
  "cd_completed",
  "cd_cancelled",
]);
export type CrossDockStatus = z.infer<typeof crossDockStatusSchema>;
