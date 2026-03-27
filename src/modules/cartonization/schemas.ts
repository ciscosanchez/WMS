import { z } from "zod";

type T = (key: string) => string;

export const DIMENSION_UNIT_OPTIONS = ["in", "cm"] as const;
export const WEIGHT_UNIT_OPTIONS = ["lb", "kg"] as const;

export function cartonTypeSchema(t?: T) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);

  return z.object({
    name: z.string().trim().min(1, msg("nameRequired", "Name is required")).max(100),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, msg("codeRequired", "Code is required"))
      .max(20),
    length: z.coerce.number().positive(msg("dimensionRequired", "Length must be greater than 0")),
    width: z.coerce.number().positive(msg("dimensionRequired", "Width must be greater than 0")),
    height: z.coerce.number().positive(msg("dimensionRequired", "Height must be greater than 0")),
    dimUnit: z.enum(DIMENSION_UNIT_OPTIONS).default("in"),
    maxWeight: z.coerce.number().positive(msg("weightRequired", "Max weight must be greater than 0")),
    weightUnit: z.enum(WEIGHT_UNIT_OPTIONS).default("lb"),
    tareWeight: z.coerce.number().min(0, msg("tareWeightRequired", "Tare weight cannot be negative")).default(0),
    cost: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? null : value),
      z.coerce.number().min(0, msg("costRequired", "Cost cannot be negative")).nullable().optional()
    ),
  });
}

export const cartonTypeSchemaStatic = cartonTypeSchema();
export type CartonTypeFormData = z.input<ReturnType<typeof cartonTypeSchema>>;
