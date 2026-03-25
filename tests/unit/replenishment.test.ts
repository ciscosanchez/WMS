/**
 * Replenishment Rule Tests
 *
 * Tests rule validation and replenishment need calculation logic.
 */

describe("Replenishment Rule Validation", () => {
  function validateRule(rule: { minQty: number; maxQty: number; reorderPoint: number }) {
    const errors: string[] = [];
    if (rule.minQty >= rule.maxQty) errors.push("Min must be less than max");
    if (rule.reorderPoint < rule.minQty) errors.push("Reorder point below min");
    if (rule.reorderPoint > rule.maxQty) errors.push("Reorder point above max");
    return errors;
  }

  it("accepts valid rule", () => {
    expect(validateRule({ minQty: 5, maxQty: 50, reorderPoint: 10 })).toEqual([]);
  });

  it("rejects min >= max", () => {
    const errors = validateRule({ minQty: 50, maxQty: 50, reorderPoint: 50 });
    expect(errors).toContain("Min must be less than max");
  });

  it("rejects reorder point below min", () => {
    const errors = validateRule({ minQty: 10, maxQty: 50, reorderPoint: 5 });
    expect(errors).toContain("Reorder point below min");
  });

  it("rejects reorder point above max", () => {
    const errors = validateRule({ minQty: 5, maxQty: 50, reorderPoint: 60 });
    expect(errors).toContain("Reorder point above max");
  });
});

describe("Replenishment Need Calculation", () => {
  function calculateNeed(
    currentQty: number,
    reorderPoint: number,
    maxQty: number
  ): { needed: boolean; suggestedQty: number } {
    if (currentQty <= reorderPoint) {
      return { needed: true, suggestedQty: maxQty - currentQty };
    }
    return { needed: false, suggestedQty: 0 };
  }

  it("triggers when at reorder point", () => {
    const result = calculateNeed(10, 10, 50);
    expect(result.needed).toBe(true);
    expect(result.suggestedQty).toBe(40);
  });

  it("triggers when below reorder point", () => {
    const result = calculateNeed(3, 10, 50);
    expect(result.needed).toBe(true);
    expect(result.suggestedQty).toBe(47);
  });

  it("does not trigger when above reorder point", () => {
    const result = calculateNeed(25, 10, 50);
    expect(result.needed).toBe(false);
    expect(result.suggestedQty).toBe(0);
  });

  it("handles zero current quantity", () => {
    const result = calculateNeed(0, 5, 100);
    expect(result.needed).toBe(true);
    expect(result.suggestedQty).toBe(100);
  });

  it("suggests fill-to-max quantity", () => {
    const result = calculateNeed(8, 10, 30);
    expect(result.suggestedQty).toBe(22); // 30 - 8
  });
});
