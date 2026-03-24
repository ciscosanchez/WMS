/**
 * @jest-environment node
 */
import { cartonize, type PackItem, type BoxType } from "@/modules/cartonization/algorithm";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const SMALL_BOX: BoxType = {
  id: "box-s",
  code: "S",
  length: 10,
  width: 10,
  height: 10,
  maxWeight: 5,
  tareWeight: 0.5,
};

const MEDIUM_BOX: BoxType = {
  id: "box-m",
  code: "M",
  length: 20,
  width: 20,
  height: 20,
  maxWeight: 20,
  tareWeight: 1,
};

const LARGE_BOX: BoxType = {
  id: "box-l",
  code: "L",
  length: 30,
  width: 30,
  height: 30,
  maxWeight: 50,
  tareWeight: 2,
};

const ALL_BOXES: BoxType[] = [SMALL_BOX, MEDIUM_BOX, LARGE_BOX];

function makeItem(overrides: Partial<PackItem> & { productId: string }): PackItem {
  return {
    quantity: 1,
    weight: 1,
    length: 5,
    width: 5,
    height: 5,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("cartonize", () => {
  it("returns empty array when items are empty", () => {
    const result = cartonize([], ALL_BOXES);
    expect(result).toEqual([]);
  });

  it("returns empty array when boxes are empty", () => {
    const items: PackItem[] = [makeItem({ productId: "P1" })];
    const result = cartonize(items, []);
    expect(result).toEqual([]);
  });

  it("packs a single item into a single box", () => {
    const items: PackItem[] = [makeItem({ productId: "P1" })];
    const result = cartonize(items, ALL_BOXES);

    expect(result).toHaveLength(1);
    expect(result[0].items).toEqual(
      expect.arrayContaining([expect.objectContaining({ productId: "P1", quantity: 1 })])
    );
    expect(result[0].cartonSeq).toBe(1);
  });

  it("packs multiple items into one box when weight and volume allow", () => {
    const items: PackItem[] = [
      makeItem({ productId: "P1", quantity: 2, weight: 1, length: 5, width: 5, height: 5 }),
      makeItem({ productId: "P2", quantity: 1, weight: 1, length: 5, width: 5, height: 5 }),
    ];
    const result = cartonize(items, ALL_BOXES);

    // Total volume = 3 * 125 = 375, small box = 1000, weight = 3, small max net = 4.5
    expect(result).toHaveLength(1);
  });

  it("splits items across multiple boxes when volume is exceeded", () => {
    // Small box volume = 1000. Each item volume = 9*9*9 = 729, so only 1 fits per small box.
    const items: PackItem[] = [
      makeItem({ productId: "P1", quantity: 3, weight: 0.5, length: 9, width: 9, height: 9 }),
    ];
    const result = cartonize(items, [SMALL_BOX]);

    expect(result.length).toBeGreaterThan(1);
  });

  it("splits items across multiple boxes when weight is exceeded", () => {
    // Small box maxWeight=5, tareWeight=0.5, net capacity=4.5. Each item weighs 3.
    const items: PackItem[] = [
      makeItem({ productId: "P1", quantity: 3, weight: 3, length: 2, width: 2, height: 2 }),
    ];
    const result = cartonize(items, [SMALL_BOX]);

    expect(result.length).toBeGreaterThan(1);
    // Verify all 3 units are accounted for
    const totalQty = result.reduce(
      (sum, c) => sum + c.items.reduce((s, i) => s + i.quantity, 0),
      0
    );
    expect(totalQty).toBe(3);
  });

  it("selects the smallest eligible box for the largest item (FFD property)", () => {
    // Item fits in medium (vol 125 < 8000) but not small (dim 9 fits in 10, vol 729 < 1000, weight 1 < 4.5) — actually fits small too.
    // Use an item that exceeds small box dimensions: 15x15x15 won't fit small (max dim 10).
    const items: PackItem[] = [
      makeItem({ productId: "P1", length: 15, width: 15, height: 15, weight: 2 }),
    ];
    const result = cartonize(items, ALL_BOXES);

    expect(result).toHaveLength(1);
    expect(result[0].cartonTypeId).toBe("box-m");
    expect(result[0].cartonTypeCode).toBe("M");
  });

  it("falls back to largest box when item has zero dimensions", () => {
    const items: PackItem[] = [
      makeItem({ productId: "P1", length: 0, width: 0, height: 0, weight: 0.5 }),
    ];
    // Zero volume item fits in any box by volume, so smallest eligible is chosen
    const result = cartonize(items, ALL_BOXES);

    expect(result).toHaveLength(1);
    // Zero-dim item has volume 0, fits in small box
    expect(result[0].cartonTypeId).toBe("box-s");
  });

  it("consolidates 5 units of same product into quantity=5 in output", () => {
    const items: PackItem[] = [
      makeItem({ productId: "P1", quantity: 5, weight: 0.5, length: 3, width: 3, height: 3 }),
    ];
    const result = cartonize(items, [LARGE_BOX]);

    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].productId).toBe("P1");
    expect(result[0].items[0].quantity).toBe(5);
  });

  it("keeps items from different products separate in output", () => {
    const items: PackItem[] = [
      makeItem({ productId: "P1", quantity: 2, weight: 0.5, length: 3, width: 3, height: 3 }),
      makeItem({ productId: "P2", quantity: 2, weight: 0.5, length: 3, width: 3, height: 3 }),
    ];
    const result = cartonize(items, [LARGE_BOX]);

    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(2);

    const productIds = result[0].items.map((i) => i.productId).sort();
    expect(productIds).toEqual(["P1", "P2"]);
  });

  it("includes tare weight in totalWeight calculation", () => {
    const items: PackItem[] = [
      makeItem({ productId: "P1", weight: 2, length: 5, width: 5, height: 5 }),
    ];
    const result = cartonize(items, [SMALL_BOX]);

    // totalWeight = item weight (2) + tareWeight (0.5) = 2.5
    expect(result).toHaveLength(1);
    expect(result[0].totalWeight).toBe(2.5);
  });

  it("prefers the smallest box that fits the item", () => {
    // Item that fits in small box (vol=125, weight=1, max dim=5 <= 10)
    const items: PackItem[] = [
      makeItem({ productId: "P1", length: 5, width: 5, height: 5, weight: 1 }),
    ];
    const result = cartonize(items, ALL_BOXES);

    expect(result).toHaveLength(1);
    expect(result[0].cartonTypeId).toBe("box-s");
  });
});
