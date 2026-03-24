/**
 * Slotting optimization engine — pure functions, no DB.
 * Performs ABC velocity analysis and optimal bin assignment scoring.
 */

export interface PickData {
  productId: string;
  totalPicked: number;
  orderCount: number;
}

export interface ProductInventory {
  productId: string;
  binId: string;
  binBarcode: string;
  onHand: number;
  weight: number;
  shelfLevel: number; // 1 = floor, 2-3 = golden zone, 4+ = high
  zoneType: string;
}

export interface BinCandidate {
  binId: string;
  barcode: string;
  shelfLevel: number;
  zoneType: string;
  isEmpty: boolean;
}

export interface SlottingConfig {
  abcAThreshold: number; // e.g. 80 = top 80% of volume is A
  abcBThreshold: number; // e.g. 95 = next 15% is B, rest is C
  weightPenalty: number;
}

export interface Recommendation {
  productId: string;
  currentBinId: string;
  recommendedBinId: string;
  abcClass: string;
  pickFrequency: number;
  velocityScore: number;
  weightScore: number;
  ergonomicScore: number;
  totalScore: number;
}

// ─── ABC Classification ─────────────────────────────────────────────────────

export function classifyABC(
  picks: PickData[],
  aThreshold: number,
  bThreshold: number
): Map<string, { abcClass: string; pickFrequency: number }> {
  const result = new Map<string, { abcClass: string; pickFrequency: number }>();

  // Sort descending by total picked
  const sorted = [...picks].sort((a, b) => b.totalPicked - a.totalPicked);
  const totalVolume = sorted.reduce((s, p) => s + p.totalPicked, 0);

  if (totalVolume === 0) {
    for (const p of sorted) {
      result.set(p.productId, { abcClass: "C", pickFrequency: p.totalPicked });
    }
    return result;
  }

  let cumulative = 0;
  for (const p of sorted) {
    cumulative += p.totalPicked;
    const pct = (cumulative / totalVolume) * 100;
    let cls: string;
    if (pct <= aThreshold) cls = "A";
    else if (pct <= bThreshold) cls = "B";
    else cls = "C";

    result.set(p.productId, { abcClass: cls, pickFrequency: p.totalPicked });
  }

  return result;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

function velocityScore(pickFrequency: number, maxFrequency: number): number {
  if (maxFrequency === 0) return 0;
  return Math.round((pickFrequency / maxFrequency) * 100);
}

function weightScore(weight: number, penalty: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - weight * penalty)));
}

function ergonomicScore(shelfLevel: number): number {
  // Golden zone: shelves 2-3 (waist to chest height)
  if (shelfLevel === 2 || shelfLevel === 3) return 100;
  if (shelfLevel === 1) return 60; // floor
  if (shelfLevel === 4) return 50; // above shoulder
  return 30; // very high
}

function binDesirability(bin: BinCandidate): number {
  const ergo = ergonomicScore(bin.shelfLevel);
  const zonePref = bin.zoneType === "storage" ? 100 : bin.zoneType === "pick" ? 120 : 50;
  return ergo + zonePref;
}

// ─── Optimal Assignment ─────────────────────────────────────────────────────

export function generateRecommendations(
  inventory: ProductInventory[],
  bins: BinCandidate[],
  abc: Map<string, { abcClass: string; pickFrequency: number }>,
  config: SlottingConfig
): Recommendation[] {
  const maxFreq = Math.max(...Array.from(abc.values()).map((v) => v.pickFrequency), 1);

  // Score each product's current placement
  const productScores: {
    productId: string;
    currentBinId: string;
    abcClass: string;
    pickFrequency: number;
    vScore: number;
    wScore: number;
    eScore: number;
    totalScore: number;
    weight: number;
  }[] = [];

  for (const inv of inventory) {
    const abcData = abc.get(inv.productId) ?? { abcClass: "C", pickFrequency: 0 };
    const vScore = velocityScore(abcData.pickFrequency, maxFreq);
    const wScore = weightScore(inv.weight, config.weightPenalty);
    const eScore = ergonomicScore(inv.shelfLevel);
    const total = Math.round(0.5 * vScore + 0.25 * wScore + 0.25 * eScore);

    productScores.push({
      productId: inv.productId,
      currentBinId: inv.binId,
      abcClass: abcData.abcClass,
      pickFrequency: abcData.pickFrequency,
      vScore,
      wScore,
      eScore,
      totalScore: total,
      weight: inv.weight,
    });
  }

  // Rank products by velocity (highest first = should get best bins)
  productScores.sort((a, b) => b.pickFrequency - a.pickFrequency);

  // Rank bins by desirability (best first)
  const availableBins = [...bins].sort((a, b) => binDesirability(b) - binDesirability(a));

  // Greedy assignment
  const assigned = new Set<string>();
  const recommendations: Recommendation[] = [];

  for (const product of productScores) {
    // Find the best available bin for this product
    const bestBin = availableBins.find((b) => !assigned.has(b.binId));

    if (!bestBin || bestBin.binId === product.currentBinId) continue; // Already optimal or no bins left

    // Check if this move would actually improve the score
    const newEScore = ergonomicScore(bestBin.shelfLevel);
    const newTotal = Math.round(0.5 * product.vScore + 0.25 * product.wScore + 0.25 * newEScore);

    if (newTotal <= product.totalScore) continue; // No improvement

    assigned.add(bestBin.binId);
    assigned.add(product.currentBinId); // Reserve for potential swap

    recommendations.push({
      productId: product.productId,
      currentBinId: product.currentBinId,
      recommendedBinId: bestBin.binId,
      abcClass: product.abcClass,
      pickFrequency: product.pickFrequency,
      velocityScore: product.vScore,
      weightScore: product.wScore,
      ergonomicScore: newEScore,
      totalScore: newTotal,
    });
  }

  return recommendations;
}
