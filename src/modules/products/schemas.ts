import { z } from "zod";
import { normalizeUomCode } from "./uom";

type T = (key: string) => string;

const uomCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .transform((value) => normalizeUomCode(value))
  .refine((value) => /^[A-Z0-9_-]+$/.test(value), "Invalid UOM code");

export const uomConversionSchema = z.object({
  fromUom: uomCodeSchema,
  toUom: uomCodeSchema,
  factor: z.coerce.number().positive(),
});

export function productSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z
    .object({
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
      baseUom: uomCodeSchema.default("EA"),
      unitsPerCase: z.coerce.number().int().positive().optional().nullable(),
      caseBarcode: z.string().max(100).optional().nullable(),
      uomConversions: z.array(uomConversionSchema).default([]),
      trackLot: z.boolean().default(false),
      trackSerial: z.boolean().default(false),
      minStock: z.coerce.number().int().optional().nullable(),
      maxStock: z.coerce.number().int().optional().nullable(),
      isActive: z.boolean().default(true),
    })
    .superRefine((value, ctx) => {
      const seen = new Set<string>();
      for (const [index, conversion] of value.uomConversions.entries()) {
        if (conversion.fromUom === conversion.toUom) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg("uomConversionDistinct", "Conversion units must be different"),
            path: ["uomConversions", index, "fromUom"],
          });
        }
        if (conversion.toUom !== value.baseUom) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg("uomConversionBase", "Conversions must resolve to the base UOM"),
            path: ["uomConversions", index, "toUom"],
          });
        }
        const key = `${conversion.fromUom}:${conversion.toUom}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg("uomConversionDuplicate", "Duplicate packaging conversion"),
            path: ["uomConversions", index, "fromUom"],
          });
        }
        seen.add(key);
      }
    });
}

export const productSchemaStatic = productSchema();
export type ProductFormData = z.input<ReturnType<typeof productSchema>>;
