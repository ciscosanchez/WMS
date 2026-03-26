import { z } from "zod";
import { attributeValueInputSchema } from "@/modules/attributes/schemas";

type T = (key: string) => string;

export function orderSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    clientId: z.string().min(1, msg("clientRequired", "Client is required")),
    priority: z.enum(["standard", "expedited", "rush", "same_day"]).default("standard"),
    shipToName: z.string().min(1, msg("shipToNameRequired", "Ship-to name is required")),
    shipToAddress1: z.string().min(1, msg("shipToAddressRequired", "Ship-to address is required")),
    shipToAddress2: z.string().optional().nullable(),
    shipToCity: z.string().min(1, msg("shipToCityRequired", "Ship-to city is required")),
    shipToState: z.string().optional().nullable(),
    shipToZip: z.string().min(1, msg("shipToZipRequired", "Ship-to ZIP is required")),
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
}

export function orderLineSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    productId: z.string().min(1, msg("productRequired", "Product is required")),
    quantity: z.coerce.number().int().min(1, msg("quantityMin", "Quantity must be at least 1")),
    uom: z.string().default("EA"),
    unitPrice: z.coerce.number().optional().nullable(),
    lotNumber: z.string().optional().nullable(),
    serialNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    operationalAttributes: z.array(attributeValueInputSchema).optional().default([]),
  });
}

export const orderSchemaStatic = orderSchema();
export const orderLineSchemaStatic = orderLineSchema();
export type OrderFormData = z.input<ReturnType<typeof orderSchema>>;
export type OrderLineFormData = z.input<ReturnType<typeof orderLineSchema>>;
