import { z } from "zod";

export const productSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  sku: z.string().min(1, "SKU is required").max(100),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional().nullable(),
  hsCode: z.string().max(20).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  weight: z.coerce.number().optional().nullable(),
  weightUnit: z.string().default("lb"),
  length: z.coerce.number().optional().nullable(),
  width: z.coerce.number().optional().nullable(),
  height: z.coerce.number().optional().nullable(),
  dimUnit: z.string().default("in"),
  baseUom: z.string().default("EA"),
  trackLot: z.boolean().default(false),
  trackSerial: z.boolean().default(false),
  minStock: z.coerce.number().int().optional().nullable(),
  maxStock: z.coerce.number().int().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type ProductFormData = z.input<typeof productSchema>;

export const uomConversionSchema = z.object({
  fromUom: z.string().min(1),
  toUom: z.string().min(1),
  factor: z.coerce.number().positive(),
});
