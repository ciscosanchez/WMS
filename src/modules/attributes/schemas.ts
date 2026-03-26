import { z } from "zod";

export const attributeScopeSchema = z.enum([
  "inbound_shipment",
  "inbound_shipment_line",
  "lpn",
  "inventory_unit",
  "inventory_record",
]);

export const attributeDataTypeSchema = z.enum([
  "text",
  "number",
  "currency",
  "date",
  "boolean",
  "single_select",
  "multi_select",
  "json",
]);

export const attributeOptionSchema = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const jsonRecordSchema = z.record(z.string(), z.unknown()).default({});

export const attributeDefinitionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, "Key must start with a letter and use lowercase letters, numbers, and underscores"),
  label: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  entityScope: attributeScopeSchema,
  dataType: attributeDataTypeSchema,
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  allowSuggestions: z.boolean().default(false),
  validationRules: jsonRecordSchema,
  displayRules: jsonRecordSchema,
  behaviorFlags: jsonRecordSchema,
  sortOrder: z.coerce.number().int().min(0).default(0),
  options: z.array(attributeOptionSchema).default([]),
});

export const attributeValueInputSchema = z.object({
  definitionId: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional().nullable(),
});

export type AttributeScope = z.infer<typeof attributeScopeSchema>;
export type AttributeDataType = z.infer<typeof attributeDataTypeSchema>;
export type AttributeDefinitionInput = z.infer<typeof attributeDefinitionSchema>;
export type AttributeValueInput = z.infer<typeof attributeValueInputSchema>;
