import { z } from "zod";

export function complianceCheckSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    entityType: z.string().min(1, msg("entityTypeRequired", "Entity type is required")),
    entityId: z.string().min(1, msg("entityIdRequired", "Entity ID is required")),
    checkType: z.string().min(1, msg("checkTypeRequired", "Check type is required")),
    details: z.string().optional().nullable(),
  });
}

export const complianceCheckSchemaStatic = complianceCheckSchema();
export type ComplianceCheckInput = z.infer<typeof complianceCheckSchemaStatic>;

export function resolveCheckSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    status: z.enum(["comp_cleared", "comp_flagged", "comp_blocked"], {
      errorMap: () => ({
        message: msg("invalidStatus", "Status must be cleared, flagged, or blocked"),
      }),
    }),
    details: z.string().optional().nullable(),
  });
}

export const resolveCheckSchemaStatic = resolveCheckSchema();
export type ResolveCheckInput = z.infer<typeof resolveCheckSchemaStatic>;

export function hazmatFlagSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    productId: z.string().min(1, msg("productRequired", "Product is required")),
    unNumber: z.string().optional().nullable(),
    hazClass: z.string().optional().nullable(),
    packingGroup: z.string().optional().nullable(),
    properName: z.string().optional().nullable(),
    isRestricted: z.boolean().default(false),
  });
}

export const hazmatFlagSchemaStatic = hazmatFlagSchema();
export type HazmatFlagInput = z.infer<typeof hazmatFlagSchemaStatic>;

export function hsCodeSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    hsCode: z.string().regex(/^\d{6,10}$/, msg("hsCodeFormat", "HS code must be 6-10 digits")),
  });
}

export const hsCodeSchemaStatic = hsCodeSchema();
export type HsCodeInput = z.infer<typeof hsCodeSchemaStatic>;

export const complianceStatusSchema = z.enum([
  "comp_pending",
  "comp_cleared",
  "comp_flagged",
  "comp_blocked",
]);
export type ComplianceStatus = z.infer<typeof complianceStatusSchema>;
