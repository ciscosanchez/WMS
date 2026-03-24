/**
 * FEFO (First Expired, First Out) Picking Tests
 *
 * Validates that inventory with the earliest expiration date is picked first,
 * and that items without expiration dates are picked last.
 */

describe("FEFO Picking Logic", () => {
  // Simulate the FEFO sort that generatePickTasksForOrder uses
  function fefoSort(
    inventory: Array<{
      id: string;
      available: number;
      expirationDate: Date | null;
    }>
  ) {
    return [...inventory].sort((a, b) => {
      // Nulls last
      if (a.expirationDate === null && b.expirationDate === null) {
        return b.available - a.available; // fallback: most available first
      }
      if (a.expirationDate === null) return 1;
      if (b.expirationDate === null) return -1;
      // Earliest expiration first
      const diff = a.expirationDate.getTime() - b.expirationDate.getTime();
      if (diff !== 0) return diff;
      return b.available - a.available;
    });
  }

  it("picks earliest expiring inventory first", () => {
    const inventory = [
      { id: "c", available: 100, expirationDate: new Date("2026-06-01") },
      { id: "a", available: 50, expirationDate: new Date("2026-04-01") },
      { id: "b", available: 75, expirationDate: new Date("2026-05-01") },
    ];

    const sorted = fefoSort(inventory);
    expect(sorted[0].id).toBe("a"); // April — earliest
    expect(sorted[1].id).toBe("b"); // May
    expect(sorted[2].id).toBe("c"); // June — latest
  });

  it("pushes null expiration dates to the end", () => {
    const inventory = [
      { id: "no-exp", available: 200, expirationDate: null },
      { id: "exp-soon", available: 10, expirationDate: new Date("2026-04-15") },
    ];

    const sorted = fefoSort(inventory);
    expect(sorted[0].id).toBe("exp-soon");
    expect(sorted[1].id).toBe("no-exp");
  });

  it("breaks ties by available quantity (most first)", () => {
    const sameDate = new Date("2026-05-01");
    const inventory = [
      { id: "small", available: 10, expirationDate: sameDate },
      { id: "large", available: 100, expirationDate: sameDate },
      { id: "medium", available: 50, expirationDate: sameDate },
    ];

    const sorted = fefoSort(inventory);
    expect(sorted[0].id).toBe("large");
    expect(sorted[1].id).toBe("medium");
    expect(sorted[2].id).toBe("small");
  });

  it("handles all null expiration dates — falls back to available desc", () => {
    const inventory = [
      { id: "a", available: 10, expirationDate: null },
      { id: "b", available: 50, expirationDate: null },
      { id: "c", available: 30, expirationDate: null },
    ];

    const sorted = fefoSort(inventory);
    expect(sorted[0].id).toBe("b"); // 50
    expect(sorted[1].id).toBe("c"); // 30
    expect(sorted[2].id).toBe("a"); // 10
  });

  it("handles empty inventory array", () => {
    const sorted = fefoSort([]);
    expect(sorted).toEqual([]);
  });

  it("handles single item", () => {
    const inventory = [{ id: "only", available: 42, expirationDate: new Date("2026-12-31") }];
    const sorted = fefoSort(inventory);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("only");
  });

  it("correctly orders mixed expired and future items", () => {
    const inventory = [
      { id: "future", available: 100, expirationDate: new Date("2027-01-01") },
      { id: "expired", available: 50, expirationDate: new Date("2025-01-01") },
      { id: "today", available: 75, expirationDate: new Date("2026-03-24") },
      { id: "no-exp", available: 200, expirationDate: null },
    ];

    const sorted = fefoSort(inventory);
    expect(sorted[0].id).toBe("expired"); // Already expired — pick first to clear
    expect(sorted[1].id).toBe("today");
    expect(sorted[2].id).toBe("future");
    expect(sorted[3].id).toBe("no-exp"); // No expiration — last
  });
});
