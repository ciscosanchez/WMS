import { z } from "zod";

// ─── Condition Schema ──────────────────────────────────

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    "equals",
    "not_equals",
    "in",
    "not_in",
    "gt",
    "lt",
    "gte",
    "lte",
    "contains",
  ]),
  value: z.unknown(),
});

// ─── Action Schema ─────────────────────────────────────

const actionSchema = z.object({
  type: z.string().min(1),
  params: z.record(z.unknown()).default({}),
});

// ─── Rule Create Schema ────────────────────────────────

export function workflowRuleSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    name: z
      .string()
      .min(1, msg("nameRequired", "Rule name is required"))
      .max(200, msg("nameTooLong", "Name must be 200 characters or fewer")),
    description: z.string().max(1000).optional().nullable(),
    trigger: z
      .string()
      .min(1, msg("triggerRequired", "Trigger event is required")),
    conditions: z.array(conditionSchema).default([]),
    actions: z.array(actionSchema).default([]),
    priority: z.number().int().default(0),
    isActive: z.boolean().default(true),
  });
}

export const workflowRuleSchemaStatic = workflowRuleSchema();
export type WorkflowRuleInput = z.infer<typeof workflowRuleSchemaStatic>;

// ─── Rule Update Schema ────────────────────────────────

export function workflowRuleUpdateSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);
  return z.object({
    name: z
      .string()
      .min(1, msg("nameRequired", "Rule name is required"))
      .max(200, msg("nameTooLong", "Name must be 200 characters or fewer"))
      .optional(),
    description: z.string().max(1000).optional().nullable(),
    trigger: z
      .string()
      .min(1, msg("triggerRequired", "Trigger event is required"))
      .optional(),
    conditions: z.array(conditionSchema).optional(),
    actions: z.array(actionSchema).optional(),
    priority: z.number().int().optional(),
    isActive: z.boolean().optional(),
  });
}

export const workflowRuleUpdateSchemaStatic = workflowRuleUpdateSchema();
export type WorkflowRuleUpdateInput = z.infer<typeof workflowRuleUpdateSchemaStatic>;
