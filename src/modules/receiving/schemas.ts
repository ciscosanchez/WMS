import { z } from "zod";
import { attributeValueInputSchema } from "@/modules/attributes/schemas";

type T = (key: string) => string;

export function inboundShipmentSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    clientId: z.string().min(1, msg("clientRequired", "Client is required")),
    carrier: z.string().optional().nullable(),
    trackingNumber: z.string().optional().nullable(),
    bolNumber: z.string().optional().nullable(),
    poNumber: z.string().optional().nullable(),
    expectedDate: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : v),
      z.coerce.date().optional().nullable()
    ),
    notes: z.string().optional().nullable(),
    operationalAttributes: z.array(attributeValueInputSchema).optional().default([]),
  });
}

export function shipmentLineSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    productId: z.string().min(1, msg("productRequired", "Product is required")),
    expectedQty: z.coerce.number().int().min(1, msg("quantityMin", "Quantity must be at least 1")),
    uom: z.string().default("EA"),
    lotNumber: z.string().optional().nullable(),
    serialNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    operationalAttributes: z.array(attributeValueInputSchema).optional().default([]),
  });
}

export const receiveLineSchema = z.object({
  lineId: z.string().min(1),
  binId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1),
  condition: z.enum(["good", "damaged", "quarantine"]).default("good"),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function discrepancySchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    shipmentId: z.string().min(1),
    type: z.enum(["shortage", "overage", "damage"]),
    description: z.string().min(1, msg("descriptionRequired", "Description is required")),
    productId: z.string().optional().nullable(),
    expectedQty: z.coerce.number().int().optional().nullable(),
    actualQty: z.coerce.number().int().optional().nullable(),
  });
}

export const inboundShipmentSchemaStatic = inboundShipmentSchema();
export const shipmentLineSchemaStatic = shipmentLineSchema();
export const discrepancySchemaStatic = discrepancySchema();
export type InboundShipmentFormData = z.input<ReturnType<typeof inboundShipmentSchema>>;
export type ShipmentLineFormData = z.input<ReturnType<typeof shipmentLineSchema>>;
export type ReceiveLineFormData = z.input<typeof receiveLineSchema>;
