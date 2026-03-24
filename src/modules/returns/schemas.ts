import { z } from "zod";

export function rmaSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    clientId: z.string().min(1, msg("clientRequired", "Client is required")),
    orderId: z.string().optional().nullable(),
    reason: z.string().min(1, msg("reasonRequired", "Reason is required")).max(500),
    notes: z.string().max(1000).optional().nullable(),
  });
}

export const rmaSchemaStatic = rmaSchema();
export type RmaInput = z.infer<typeof rmaSchemaStatic>;

export function returnLineSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    productId: z.string().min(1, msg("productRequired", "Product is required")),
    expectedQty: z.number().int().positive(msg("qtyPositive", "Quantity must be positive")),
    uom: z.string().default("EA"),
    lotNumber: z.string().optional().nullable(),
    serialNumber: z.string().optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  });
}

export const returnLineSchemaStatic = returnLineSchema();
export type ReturnLineInput = z.infer<typeof returnLineSchemaStatic>;

export const receiveReturnLineSchema = z.object({
  lineId: z.string().min(1),
  binId: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  condition: z.enum(["good", "damaged", "quarantine"]).default("good"),
});
export type ReceiveReturnLineInput = z.infer<typeof receiveReturnLineSchema>;

export const inspectReturnLineSchema = z.object({
  lineId: z.string().min(1),
  binId: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  condition: z.enum(["good", "damaged", "quarantine"]),
  disposition: z.enum(["restock", "quarantine", "dispose", "repair"]),
  notes: z.string().max(1000).optional().nullable(),
});
export type InspectReturnLineInput = z.infer<typeof inspectReturnLineSchema>;
