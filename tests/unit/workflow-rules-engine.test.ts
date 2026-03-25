/**
 * @jest-environment node
 *
 * Tests for the workflow rules evaluation engine (pure functions).
 */

import { evaluateConditions } from "@/modules/workflow-rules/engine";

describe("evaluateConditions", () => {
  it("returns true when conditions array is empty (always match)", () => {
    expect(evaluateConditions([], {})).toBe(true);
  });

  it("equals operator matches", () => {
    const conditions = [{ field: "status", operator: "equals", value: "rush" }];
    expect(evaluateConditions(conditions, { status: "rush" })).toBe(true);
    expect(evaluateConditions(conditions, { status: "standard" })).toBe(false);
  });

  it("not_equals operator", () => {
    const conditions = [{ field: "status", operator: "not_equals", value: "cancelled" }];
    expect(evaluateConditions(conditions, { status: "active" })).toBe(true);
    expect(evaluateConditions(conditions, { status: "cancelled" })).toBe(false);
  });

  it("in operator checks array membership", () => {
    const conditions = [{ field: "priority", operator: "in", value: ["rush", "expedited"] }];
    expect(evaluateConditions(conditions, { priority: "rush" })).toBe(true);
    expect(evaluateConditions(conditions, { priority: "standard" })).toBe(false);
  });

  it("not_in operator", () => {
    const conditions = [{ field: "status", operator: "not_in", value: ["cancelled", "on_hold"] }];
    expect(evaluateConditions(conditions, { status: "active" })).toBe(true);
    expect(evaluateConditions(conditions, { status: "cancelled" })).toBe(false);
  });

  it("gt / lt / gte / lte numeric comparisons", () => {
    expect(evaluateConditions([{ field: "qty", operator: "gt", value: 10 }], { qty: 15 })).toBe(
      true
    );
    expect(evaluateConditions([{ field: "qty", operator: "gt", value: 10 }], { qty: 5 })).toBe(
      false
    );
    expect(evaluateConditions([{ field: "qty", operator: "lt", value: 10 }], { qty: 5 })).toBe(
      true
    );
    expect(evaluateConditions([{ field: "qty", operator: "gte", value: 10 }], { qty: 10 })).toBe(
      true
    );
    expect(evaluateConditions([{ field: "qty", operator: "lte", value: 10 }], { qty: 10 })).toBe(
      true
    );
  });

  it("contains operator for string substring", () => {
    const conditions = [{ field: "name", operator: "contains", value: "fragile" }];
    expect(evaluateConditions(conditions, { name: "Handle with fragile care" })).toBe(true);
    expect(evaluateConditions(conditions, { name: "Normal product" })).toBe(false);
  });

  it("dot-notation resolves nested fields", () => {
    const conditions = [{ field: "client.code", operator: "equals", value: "ACME" }];
    const context = { client: { code: "ACME", name: "Acme Corp" } };
    expect(evaluateConditions(conditions, context)).toBe(true);
  });

  it("deeply nested dot-notation", () => {
    const conditions = [{ field: "order.client.tier", operator: "equals", value: "gold" }];
    const context = { order: { client: { tier: "gold" } } };
    expect(evaluateConditions(conditions, context)).toBe(true);
  });

  it("multiple conditions use AND logic", () => {
    const conditions = [
      { field: "priority", operator: "equals", value: "rush" },
      { field: "qty", operator: "gt", value: 100 },
    ];
    expect(evaluateConditions(conditions, { priority: "rush", qty: 200 })).toBe(true);
    expect(evaluateConditions(conditions, { priority: "rush", qty: 50 })).toBe(false);
    expect(evaluateConditions(conditions, { priority: "standard", qty: 200 })).toBe(false);
  });

  it("unknown operator returns false (fail-closed)", () => {
    const conditions = [{ field: "x", operator: "regex", value: ".*" }];
    expect(evaluateConditions(conditions, { x: "anything" })).toBe(false);
  });

  it("missing field returns false", () => {
    const conditions = [{ field: "nonexistent", operator: "equals", value: "test" }];
    expect(evaluateConditions(conditions, { other: "data" })).toBe(false);
  });
});
