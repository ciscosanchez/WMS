import { z } from "zod";

type T = (key: string) => string;

export function clientSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    code: z.string().min(1, msg("codeRequired", "Code is required")).max(20),
    name: z.string().min(1, msg("nameRequired", "Name is required")).max(200),
    contactName: z.string().max(200).optional().nullable(),
    contactEmail: z.string().email().optional().nullable().or(z.literal("")),
    contactPhone: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    zipCode: z.string().max(20).optional().nullable(),
    taxId: z.string().max(50).optional().nullable(),
    notes: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
  });
}

/** Static instance for server-side use (English) */
export const clientSchemaStatic = clientSchema();
export type ClientFormData = z.input<ReturnType<typeof clientSchema>>;
