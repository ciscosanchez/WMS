import { z } from "zod";
import { attributeValueInputSchema } from "@/modules/attributes/schemas";
import {
  COUNTRY_OPTIONS,
  getRegionOptions,
  normalizeCountryCode,
  normalizePhoneNumber,
  normalizeRegionCode,
} from "@/modules/clients/reference-data";

type T = (key: string) => string;

const nullableTrimmedString = () =>
  z.preprocess((value) => {
    if (value === "" || value === undefined || value === null) return null;
    return typeof value === "string" ? value.trim() : value;
  }, z.string().nullable().optional());

export function orderSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z
    .object({
      clientId: z.string().min(1, msg("clientRequired", "Client is required")),
      priority: z.enum(["standard", "expedited", "rush", "same_day"]).default("standard"),
      shipToName: z.string().trim().min(1, msg("shipToNameRequired", "Ship-to name is required")),
      shipToAddress1: z
        .string()
        .trim()
        .min(1, msg("shipToAddressRequired", "Ship-to address is required")),
      shipToAddress2: nullableTrimmedString(),
      shipToCity: z.string().trim().min(1, msg("shipToCityRequired", "Ship-to city is required")),
      shipToState: z.preprocess(
        (value) => normalizeRegionCode(value as string | null | undefined),
        z.string().max(100).nullable().optional()
      ),
      shipToZip: z.string().trim().min(1, msg("shipToZipRequired", "Ship-to ZIP is required")),
      shipToCountry: z.preprocess(
        (value) => normalizeCountryCode(value as string | null | undefined) ?? "US",
        z.string().max(2)
      ),
      shipToPhone: z.preprocess(
        (value) => normalizePhoneNumber(value as string | null | undefined),
        z.string().max(20).nullable().optional()
      ),
      shipToEmail: z.preprocess((value) => {
        if (value === "" || value === undefined || value === null) return null;
        return typeof value === "string" ? value.trim().toLowerCase() : value;
      }, z.string().email().nullable().optional()),
      requestedCarrier: nullableTrimmedString(),
      requestedService: nullableTrimmedString(),
      shipByDate: z.preprocess(
        (v) => (v === "" || v === undefined || v === null ? null : v),
        z.coerce.date().optional().nullable()
      ),
      notes: nullableTrimmedString(),
    })
    .superRefine((value, ctx) => {
      if (!COUNTRY_OPTIONS.some((option) => option.code === value.shipToCountry)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg("countryInvalid", "Select a supported country"),
          path: ["shipToCountry"],
        });
      }

      if (value.shipToState) {
        const allowedRegions = getRegionOptions(value.shipToCountry);
        if (
          allowedRegions.length > 0 &&
          !allowedRegions.some((region) => region.code === value.shipToState)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg("stateInvalid", "Select a valid state or province"),
            path: ["shipToState"],
          });
        }
      }
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
