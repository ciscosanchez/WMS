import { z } from "zod";

type T = (key: string) => string;

export function productSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    clientId: z.string().min(1, msg("clientRequired", "Client is required")),
    sku: z.string().min(1, msg("skuRequired", "SKU is required")).max(100),
    name: z.string().min(1, msg("nameRequired", "Name is required")).max(200),
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
}

export const productSchemaStatic = productSchema();
export type ProductFormData = z.input<ReturnType<typeof productSchema>>;

export const uomConversionSchema = z.object({
  fromUom: z.string().min(1),
  toUom: z.string().min(1),
  factor: z.coerce.number().positive(),
});
