// ─── Workflow Rules Engine ──────────────────────────────
// Pure functions for evaluating workflow rule conditions against event context.

export interface Condition {
  field: string;
  operator: string;
  value: unknown;
}

export interface RuleAction {
  type: string;
  params: Record<string, unknown>;
}

// ─── Field Resolution ──────────────────────────────────

/**
 * Resolve a dot-notation path against a nested object.
 * e.g. "client.code" on { client: { code: "ACME" } } → "ACME"
 */
function resolveField(context: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ─── Condition Evaluation ──────────────────────────────

/**
 * Evaluate a single condition against context. Returns false for unknown operators (fail-closed).
 */
function evaluateSingle(condition: Condition, context: Record<string, unknown>): boolean {
  const actual = resolveField(context, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "equals":
      return actual === expected;

    case "not_equals":
      return actual !== expected;

    case "in":
      return Array.isArray(expected) && expected.includes(actual);

    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual);

    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;

    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;

    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;

    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;

    case "contains":
      return typeof actual === "string" && typeof expected === "string" && actual.includes(expected);

    default:
      // Unknown operator → fail-closed (no match)
      return false;
  }
}

// ─── Public API ────────────────────────────────────────

/**
 * Evaluate all conditions against context using AND logic.
 * Empty conditions array = always matches (vacuous truth).
 */
export function evaluateConditions(
  conditions: Condition[],
  context: Record<string, unknown>,
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => evaluateSingle(c, context));
}
