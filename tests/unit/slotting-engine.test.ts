/**
 * @jest-environment node
 */
import {
  classifyABC,
  generateRecommendations,
  type PickData,
  type ProductInventory,
  type BinCandidate,
} from "@/modules/slotting/engine";
import type { SlottingConfig } from "@/modules/slotting/engine";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SlottingConfig = {
  abcAThreshold: 80,
  abcBThreshold: 95,
  weightPenalty: 1,
};

const GOLDEN_BIN: BinCandidate = {
  binId: "bin-golden",
  barcode: "BIN-G-01",
  shelfLevel: 2,
  zoneType: "pick",
  isEmpty: true,
};

const HIGH_BIN: BinCandidate = {
  binId: "bin-high",
  barcode: "BIN-H-01",
  shelfLevel: 5,
  zoneType: "storage",
  isEmpty: true,
};

const FLOOR_BIN: BinCandidate = {
  binId: "bin-floor",
  barcode: "BIN-F-01",
  shelfLevel: 1,
  zoneType: "pick",
  isEmpty: true,
};

const MEDIUM_BIN: BinCandidate = {
  binId: "bin-med",
  barcode: "BIN-M-01",
  shelfLevel: 3,
  zoneType: "pick",
  isEmpty: true,
};

// ─── classifyABC ────────────────────────────────────────────────────────────

describe("classifyABC", () => {
  it("returns empty map for empty picks", () => {
    const result = classifyABC([], 80, 95);
    expect(result.size).toBe(0);
  });

  it("classifies a single product as C (cumulative reaches 100%)", () => {
    // A single product reaches 100% cumulative which exceeds both thresholds
    const picks: PickData[] = [{ productId: "P1", totalPicked: 100, orderCount: 10 }];
    const result = classifyABC(picks, 80, 95);

    // 100/100 = 100% > 95 => C
    expect(result.get("P1")?.abcClass).toBe("C");
    expect(result.get("P1")?.pickFrequency).toBe(100);
  });

  it("applies 80/95 threshold correctly for A, B, C classification", () => {
    // P1=800, P2=100, P3=50, P4=30, P5=20 => total=1000
    // Cumulative: P1=80%, P2=90%, P3=95%, P4=98%, P5=100%
    const picks: PickData[] = [
      { productId: "P1", totalPicked: 800, orderCount: 80 },
      { productId: "P2", totalPicked: 100, orderCount: 10 },
      { productId: "P3", totalPicked: 50, orderCount: 5 },
      { productId: "P4", totalPicked: 30, orderCount: 3 },
      { productId: "P5", totalPicked: 20, orderCount: 2 },
    ];
    const result = classifyABC(picks, 80, 95);

    expect(result.get("P1")?.abcClass).toBe("A"); // 80% <= 80
    expect(result.get("P2")?.abcClass).toBe("B"); // 90% <= 95
    expect(result.get("P3")?.abcClass).toBe("B"); // 95% <= 95
    expect(result.get("P4")?.abcClass).toBe("C"); // 98% > 95
    expect(result.get("P5")?.abcClass).toBe("C"); // 100% > 95
  });

  it("classifies all equal picks as A when they fit within the threshold", () => {
    // 4 products each with 25 picks = total 100
    // Cumulative: 25%, 50%, 75%, 100%
    // All <= 80 threshold except last at 100%
    const picks: PickData[] = [
      { productId: "P1", totalPicked: 25, orderCount: 5 },
      { productId: "P2", totalPicked: 25, orderCount: 5 },
      { productId: "P3", totalPicked: 25, orderCount: 5 },
      { productId: "P4", totalPicked: 25, orderCount: 5 },
    ];
    const result = classifyABC(picks, 80, 95);

    // With equal picks, cumulative: 25, 50, 75, 100 => pct: 25, 50, 75, 100
    // P1=A (25<=80), P2=A (50<=80), P3=A (75<=80), P4=C (100>95)
    expect(result.get("P1")?.abcClass).toBe("A");
    expect(result.get("P2")?.abcClass).toBe("A");
    expect(result.get("P3")?.abcClass).toBe("A");
    // Last one pushes past bThreshold
    expect(result.get("P4")?.abcClass).toBe("C");
  });

  it("classifies products with zero picks as C", () => {
    const picks: PickData[] = [
      { productId: "P1", totalPicked: 100, orderCount: 10 },
      { productId: "P2", totalPicked: 0, orderCount: 0 },
      { productId: "P3", totalPicked: 0, orderCount: 0 },
    ];
    const result = classifyABC(picks, 80, 95);

    // P1 = 100% cumulative, which is > 95 so C... but it's the only one with volume.
    // Actually: total=100, P1 cumulative=100 => pct=100 > 95 => C? No:
    // P1 sorted first (100), cumulative 100/100 = 100% > 80 => B? > 95 => C
    // Zero-pick products come last, cumulative stays at 100% => C
    expect(result.get("P2")?.abcClass).toBe("C");
    expect(result.get("P3")?.abcClass).toBe("C");
  });
});

// ─── generateRecommendations ────────────────────────────────────────────────

describe("generateRecommendations", () => {
  it("returns empty array for empty inventory", () => {
    const abc = new Map<string, { abcClass: string; pickFrequency: number }>();
    const result = generateRecommendations([], [GOLDEN_BIN], abc, DEFAULT_CONFIG);
    expect(result).toEqual([]);
  });

  it("returns no recommendation when product is already in optimal bin", () => {
    const inventory: ProductInventory[] = [
      {
        productId: "P1",
        binId: "bin-golden",
        binBarcode: "BIN-G-01",
        onHand: 10,
        weight: 1,
        shelfLevel: 2,
        zoneType: "pick",
      },
    ];
    const abc = new Map([["P1", { abcClass: "A", pickFrequency: 100 }]]);
    // Only available bin is the one the product is already in
    const result = generateRecommendations(inventory, [GOLDEN_BIN], abc, DEFAULT_CONFIG);
    expect(result).toHaveLength(0);
  });

  it("recommends golden zone for high-velocity product on high shelf", () => {
    const inventory: ProductInventory[] = [
      {
        productId: "P1",
        binId: "bin-high",
        binBarcode: "BIN-H-01",
        onHand: 50,
        weight: 1,
        shelfLevel: 5,
        zoneType: "storage",
      },
    ];
    const abc = new Map([["P1", { abcClass: "A", pickFrequency: 200 }]]);
    const bins: BinCandidate[] = [GOLDEN_BIN, HIGH_BIN];
    const result = generateRecommendations(inventory, bins, abc, DEFAULT_CONFIG);

    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe("P1");
    expect(result[0].currentBinId).toBe("bin-high");
    expect(result[0].recommendedBinId).toBe("bin-golden");
    expect(result[0].ergonomicScore).toBe(100); // golden zone shelf level 2
  });

  it("does not recommend a move when it would not improve the score", () => {
    // Product on golden zone shelf, only alternative is a worse bin
    const inventory: ProductInventory[] = [
      {
        productId: "P1",
        binId: "bin-golden",
        binBarcode: "BIN-G-01",
        onHand: 10,
        weight: 1,
        shelfLevel: 2,
        zoneType: "pick",
      },
    ];
    const abc = new Map([["P1", { abcClass: "A", pickFrequency: 100 }]]);
    // Offer only a worse bin as alternative
    const result = generateRecommendations(inventory, [HIGH_BIN], abc, DEFAULT_CONFIG);
    expect(result).toHaveLength(0);
  });

  it("accounts for weight penalty in scoring", () => {
    // Heavy item on high shelf vs light item on high shelf
    const heavyInventory: ProductInventory[] = [
      {
        productId: "HEAVY",
        binId: "bin-high",
        binBarcode: "BIN-H-01",
        onHand: 10,
        weight: 50,
        shelfLevel: 5,
        zoneType: "storage",
      },
    ];
    const lightInventory: ProductInventory[] = [
      {
        productId: "LIGHT",
        binId: "bin-high",
        binBarcode: "BIN-H-01",
        onHand: 10,
        weight: 1,
        shelfLevel: 5,
        zoneType: "storage",
      },
    ];
    const heavyAbc = new Map([["HEAVY", { abcClass: "A", pickFrequency: 100 }]]);
    const lightAbc = new Map([["LIGHT", { abcClass: "A", pickFrequency: 100 }]]);
    const bins: BinCandidate[] = [GOLDEN_BIN, HIGH_BIN];

    const heavyResult = generateRecommendations(heavyInventory, bins, heavyAbc, DEFAULT_CONFIG);
    const lightResult = generateRecommendations(lightInventory, bins, lightAbc, DEFAULT_CONFIG);

    // Both should get recommended to golden zone
    expect(heavyResult).toHaveLength(1);
    expect(lightResult).toHaveLength(1);

    // Heavy item should have lower weightScore than light item
    expect(heavyResult[0].weightScore).toBeLessThan(lightResult[0].weightScore);
  });
});
