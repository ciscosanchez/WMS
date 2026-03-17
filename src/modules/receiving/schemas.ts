import { z } from "zod";

export const inboundShipmentSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  carrier: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  bolNumber: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  expectedDate: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.coerce.date().optional().nullable()
  ),
  notes: z.string().optional().nullable(),
});

export const shipmentLineSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  expectedQty: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  uom: z.string().default("EA"),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const receiveLineSchema = z.object({
  lineId: z.string().min(1),
  binId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1),
  condition: z.enum(["good", "damaged", "quarantine"]).default("good"),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const discrepancySchema = z.object({
  shipmentId: z.string().min(1),
  type: z.enum(["shortage", "overage", "damage"]),
  description: z.string().min(1, "Description is required"),
  productId: z.string().optional().nullable(),
  expectedQty: z.coerce.number().int().optional().nullable(),
  actualQty: z.coerce.number().int().optional().nullable(),
});

export type InboundShipmentFormData = z.input<typeof inboundShipmentSchema>;
export type ShipmentLineFormData = z.input<typeof shipmentLineSchema>;
export type ReceiveLineFormData = z.input<typeof receiveLineSchema>;
