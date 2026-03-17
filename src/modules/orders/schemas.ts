import { z } from "zod";

export const orderSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  priority: z.enum(["standard", "expedited", "rush", "same_day"]).default("standard"),
  shipToName: z.string().min(1, "Ship-to name is required"),
  shipToAddress1: z.string().min(1, "Ship-to address is required"),
  shipToAddress2: z.string().optional().nullable(),
  shipToCity: z.string().min(1, "Ship-to city is required"),
  shipToState: z.string().optional().nullable(),
  shipToZip: z.string().min(1, "Ship-to ZIP is required"),
  shipToCountry: z.string().default("US"),
  shipToPhone: z.string().optional().nullable(),
  shipToEmail: z.string().optional().nullable(),
  requestedCarrier: z.string().optional().nullable(),
  requestedService: z.string().optional().nullable(),
  shipByDate: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.coerce.date().optional().nullable()
  ),
  notes: z.string().optional().nullable(),
});

export const orderLineSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  uom: z.string().default("EA"),
  unitPrice: z.coerce.number().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type OrderFormData = z.input<typeof orderSchema>;
export type OrderLineFormData = z.input<typeof orderLineSchema>;
