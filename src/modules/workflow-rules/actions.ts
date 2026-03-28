"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { workflowRuleSchemaStatic as ruleSchema } from "./schemas";
import { evaluateConditions } from "./engine";

const PATH = "/settings/rules";

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function getRules(trigger?: string) {
  if (config.useMockData) return [];
  const { tenant } = await requireTenantContext("settings:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  if (typeof db.workflowRule?.findMany !== "function") {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { isActive: true };
  if (trigger) where.trigger = trigger;
  try {
    return await db.workflowRule.findMany({ where, orderBy: { priority: "desc" } });
  } catch {
    return [];
  }
}

export async function getRule(id: string) {
  if (config.useMockData) return null;
  const { tenant } = await requireTenantContext("settings:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;
  if (typeof db.workflowRule?.findUnique !== "function") {
    return null;
  }
  try {
    return await db.workflowRule.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

export async function createRule(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-rule" };
  try {
    const { user, tenant } = await requireTenantContext("settings:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = ruleSchema.parse(data);
    const rule = await db.workflowRule.create({
      data: {
        name: parsed.name,
        description: parsed.description || null,
        trigger: parsed.trigger,
        conditions: parsed.conditions,
        actions: parsed.actions,
        priority: parsed.priority ?? 0,
      },
    });
    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "workflow_rule",
      entityId: rule.id,
    });
    revalidatePath(PATH);
    return { id: rule.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create rule" };
  }
}

export async function updateRule(id: string, data: unknown): Promise<{ error?: string }> {
  if (config.useMockData) return {};
  try {
    const { user, tenant } = await requireTenantContext("settings:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = ruleSchema.parse(data);
    await db.workflowRule.update({
      where: { id },
      data: {
        name: parsed.name,
        description: parsed.description || null,
        trigger: parsed.trigger,
        conditions: parsed.conditions,
        actions: parsed.actions,
        priority: parsed.priority ?? 0,
      },
    });
    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "workflow_rule",
      entityId: id,
    });
    revalidatePath(PATH);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update rule" };
  }
}

export async function deleteRule(id: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};
  try {
    const { user, tenant } = await requireTenantContext("settings:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (tenant.db as any).workflowRule.update({
      where: { id },
      data: { isActive: false },
    });
    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "workflow_rule",
      entityId: id,
    });
    revalidatePath(PATH);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete rule" };
  }
}

// ─── Rule Evaluation Engine ─────────────────────────────────────────────────

/**
 * Evaluate all active rules for a trigger event.
 * Returns the actions from all matching rules, sorted by priority.
 */
export async function evaluateRules(
  trigger: string,
  context: Record<string, unknown>
): Promise<{ type: string; params: Record<string, unknown> }[]> {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("settings:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const rules = await db.workflowRule.findMany({
    where: { trigger, isActive: true },
    orderBy: { priority: "desc" },
  });

  const matchedActions: { type: string; params: Record<string, unknown> }[] = [];

  for (const rule of rules) {
    const conditions = (rule.conditions ?? []) as {
      field: string;
      operator: string;
      value: unknown;
    }[];
    if (evaluateConditions(conditions, context)) {
      const actions = (rule.actions ?? []) as {
        type: string;
        params: Record<string, unknown>;
      }[];
      matchedActions.push(...actions);
    }
  }

  return matchedActions;
}
