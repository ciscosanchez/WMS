import { z } from "zod";

// ─── Kit Definition ─────────────────────────────────────────────────────────

export function kitDefinitionSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    productId: z.string().min(1, msg("productRequired", "Product is required")),
    name: z.string().min(1, msg("nameRequired", "Kit name is required")).max(200),
    isActive: z.boolean().default(true),
    components: z
      .array(
        z.object({
          productId: z
            .string()
            .min(1, msg("componentProductRequired", "Component product is required")),
          quantity: z.number().int().positive(msg("qtyPositive", "Quantity must be positive")),
        })
      )
      .min(1, msg("componentsRequired", "At least one component is required")),
  });
}

export const kitDefinitionSchemaStatic = kitDefinitionSchema();
export type KitDefinitionInput = z.infer<typeof kitDefinitionSchemaStatic>;

// ─── Kit Component (standalone) ─────────────────────────────────────────────

export function kitComponentSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    productId: z.string().min(1, msg("componentProductRequired", "Component product is required")),
    quantity: z.number().int().positive(msg("qtyPositive", "Quantity must be positive")),
  });
}

export const kitComponentSchemaStatic = kitComponentSchema();
export type KitComponentInput = z.infer<typeof kitComponentSchemaStatic>;

// ─── VAS Task ───────────────────────────────────────────────────────────────

export function vasTaskSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    orderId: z.string().optional().nullable(),
    type: z.enum(["assembly", "labeling", "bundling", "custom"]).default("assembly"),
    instructions: z.string().max(2000).optional().nullable(),
    assignedTo: z
      .string()
      .min(1, msg("assignedToRequired", "Assigned operator is required"))
      .optional()
      .nullable(),
  });
}

export const vasTaskSchemaStatic = vasTaskSchema();
export type VasTaskInput = z.infer<typeof vasTaskSchemaStatic>;
