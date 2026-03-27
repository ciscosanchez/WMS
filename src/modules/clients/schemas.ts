import { z } from "zod";
import {
  COUNTRY_OPTIONS,
  getRegionOptions,
  normalizeCountryCode,
  normalizePhoneNumber,
  normalizeRegionCode,
} from "./reference-data";

type T = (key: string) => string;

const nullableTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (value === "" || value === undefined || value === null) return null;
    return typeof value === "string" ? value.trim() : value;
  }, z.string().max(max).nullable().optional());

export function clientSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z
    .object({
      code: z.string().trim().min(1, msg("codeRequired", "Code is required")).max(20),
      name: z.string().trim().min(1, msg("nameRequired", "Name is required")).max(200),
      contactName: nullableTrimmedString(200),
      contactEmail: z.preprocess((value) => {
        if (value === "" || value === undefined || value === null) return null;
        return typeof value === "string" ? value.trim().toLowerCase() : value;
      }, z.string().email().nullable().optional()),
      contactPhone: z.preprocess(
        (value) => normalizePhoneNumber(value as string | null | undefined),
        z.string().max(20).nullable().optional()
      ),
      address: nullableTrimmedString(500),
      city: nullableTrimmedString(100),
      state: z.preprocess(
        (value) => normalizeRegionCode(value as string | null | undefined),
        z.string().max(100).nullable().optional()
      ),
      country: z.preprocess(
        (value) => normalizeCountryCode(value as string | null | undefined),
        z.string().max(2).nullable().optional()
      ),
      zipCode: nullableTrimmedString(20),
      taxId: nullableTrimmedString(50),
      notes: nullableTrimmedString(2000),
      isActive: z.boolean().default(true),
    })
    .superRefine((value, ctx) => {
      if (value.country && !COUNTRY_OPTIONS.some((option) => option.code === value.country)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg("countryInvalid", "Select a supported country"),
          path: ["country"],
        });
      }

      if (value.state && value.country) {
        const allowedRegions = getRegionOptions(value.country);
        if (
          allowedRegions.length > 0 &&
          !allowedRegions.some((region) => region.code === value.state)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg("stateInvalid", "Select a valid state or province"),
            path: ["state"],
          });
        }
      }
    });
}

/** Static instance for server-side use (English) */
export const clientSchemaStatic = clientSchema();
export type ClientFormData = z.input<ReturnType<typeof clientSchema>>;
