import { z } from "zod";

// ─── Customs entry creation ─────────────────────────────────────────────────

export function createCustomsEntrySchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    entryType: z.string().min(1, msg("entryTypeRequired", "Entry type is required")),
    shipmentId: z.string().optional().nullable(),
    portOfEntry: z.string().optional().nullable(),
    carrier: z.string().optional().nullable(),
    vesselName: z.string().optional().nullable(),
    voyageNumber: z.string().optional().nullable(),
    estimatedArrival: z.coerce.date().optional().nullable(),
    brokerName: z.string().optional().nullable(),
    brokerRef: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });
}

export const createCustomsEntrySchemaStatic = createCustomsEntrySchema();
export type CreateCustomsEntryInput = z.infer<typeof createCustomsEntrySchemaStatic>;

// ─── Customs entry line ─────────────────────────────────────────────────────

export function customsEntryLineSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    entryId: z.string().min(1, msg("entryIdRequired", "Entry ID is required")),
    hsCode: z.string().min(1, msg("hsCodeRequired", "HS code is required")),
    description: z.string().min(1, msg("descriptionRequired", "Description is required")),
    countryOrigin: z.string().min(1, msg("countryRequired", "Country of origin is required")),
    quantity: z.number().int().positive(msg("qtyPositive", "Quantity must be positive")),
    value: z.number().positive(msg("valuePositive", "Value must be positive")),
    dutyRate: z.number().min(0).optional().nullable(),
    dutyAmount: z.number().min(0).optional().nullable(),
  });
}

export const customsEntryLineSchemaStatic = customsEntryLineSchema();
export type CustomsEntryLineInput = z.infer<typeof customsEntryLineSchemaStatic>;

// ─── Status update ──────────────────────────────────────────────────────────

export const customsEntryStatusSchema = z.enum([
  "ce_draft",
  "ce_pending",
  "ce_filed",
  "ce_cleared",
  "ce_held",
  "ce_rejected",
]);
export type CustomsEntryStatus = z.infer<typeof customsEntryStatusSchema>;

// ─── Bonded inventory ───────────────────────────────────────────────────────

export function bondedInventorySchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    productId: z.string().min(1, msg("productRequired", "Product is required")),
    binId: z.string().optional().nullable(),
    entryId: z.string().optional().nullable(),
    quantity: z.number().int().positive(msg("qtyPositive", "Quantity must be positive")),
    bondNumber: z.string().optional().nullable(),
    bondType: z.string().optional().nullable(),
    entryDate: z.coerce.date(),
    releaseDate: z.coerce.date().optional().nullable(),
  });
}

export const bondedInventorySchemaStatic = bondedInventorySchema();
export type BondedInventoryInput = z.infer<typeof bondedInventorySchemaStatic>;
