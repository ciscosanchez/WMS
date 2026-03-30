/**
 * First-Fit Decreasing bin-packing algorithm for cartonization.
 * Pure function — no DB or side effects.
 */

export interface PackItem {
  productId: string;
  quantity: number;
  weight: number; // per unit
  length: number; // per unit
  width: number;
  height: number;
  lotNumber?: string | null;
  serialNumber?: string | null;
}

export interface BoxType {
  id: string;
  code: string;
  length: number;
  width: number;
  height: number;
  maxWeight: number;
  tareWeight: number;
}

export interface PackedCarton {
  cartonTypeId: string;
  cartonTypeCode: string;
  cartonSeq: number;
  items: {
    productId: string;
    quantity: number;
    lotNumber?: string | null;
    serialNumber?: string | null;
  }[];
  totalWeight: number;
  usedVolume: number;
  maxVolume: number;
}

function volume(l: number, w: number, h: number): number {
  return l * w * h;
}

/**
 * Expand multi-quantity items into individual units for packing.
 * Each unit is packed independently to allow splitting across cartons.
 */
function expandItems(items: PackItem[]): PackItem[] {
  const expanded: PackItem[] = [];
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({ ...item, quantity: 1 });
    }
  }
  return expanded;
}

/**
 * Run First-Fit Decreasing cartonization.
 * Returns an array of packed cartons with item assignments.
 */
export function cartonize(items: PackItem[], boxes: BoxType[]): PackedCarton[] {
  if (items.length === 0 || boxes.length === 0) return [];

  // Sort boxes ascending by volume (prefer smallest box first)
  const sortedBoxes = [...boxes].sort(
    (a, b) => volume(a.length, a.width, a.height) - volume(b.length, b.width, b.height)
  );

  // Expand items to individual units, sort descending by volume
  const units = expandItems(items).sort(
    (a, b) => volume(b.length, b.width, b.height) - volume(a.length, a.width, a.height)
  );

  const cartons: {
    box: BoxType;
    items: PackItem[];
    usedVolume: number;
    currentWeight: number;
  }[] = [];

  for (const unit of units) {
    const unitVol = volume(unit.length, unit.width, unit.height);
    const unitWeight = unit.weight;

    // Try to fit into an existing open carton
    let placed = false;
    for (const carton of cartons) {
      const boxVol = volume(carton.box.length, carton.box.width, carton.box.height);
      const remainingVol = boxVol - carton.usedVolume;
      const remainingWeight = carton.box.maxWeight - carton.box.tareWeight - carton.currentWeight;

      if (unitVol <= remainingVol && unitWeight <= remainingWeight) {
        carton.items.push(unit);
        carton.usedVolume += unitVol;
        carton.currentWeight += unitWeight;
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Open a new carton — pick the smallest box that fits this unit
      const eligibleBox = sortedBoxes.find((box) => {
        const boxVol = volume(box.length, box.width, box.height);
        return (
          unitVol <= boxVol &&
          unitWeight <= box.maxWeight - box.tareWeight &&
          unit.length <= Math.max(box.length, box.width, box.height) &&
          unit.width <= Math.max(box.length, box.width, box.height) &&
          unit.height <= Math.max(box.length, box.width, box.height)
        );
      });

      if (!eligibleBox) {
        // No box can fit this item — reject instead of silently overloading
        const largestBox = sortedBoxes[sortedBoxes.length - 1];
        const maxPayload = largestBox.maxWeight - largestBox.tareWeight;
        const largestVol = volume(largestBox.length, largestBox.width, largestBox.height);
        throw new Error(
          `Item ${unit.productId} cannot fit in any available carton type. ` +
            `Item: ${unitWeight}lb / ${unitVol}cu-in, ` +
            `Largest box (${largestBox.code}): ${maxPayload}lb / ${largestVol}cu-in`
        );
      } else {
        cartons.push({
          box: eligibleBox,
          items: [unit],
          usedVolume: unitVol,
          currentWeight: unitWeight,
        });
      }
    }
  }

  // Consolidate: merge same-product units within each carton
  return cartons.map((carton, idx) => {
    const consolidated: Record<
      string,
      {
        productId: string;
        quantity: number;
        lotNumber?: string | null;
        serialNumber?: string | null;
      }
    > = {};
    for (const item of carton.items) {
      const key = `${item.productId}:${item.lotNumber ?? ""}:${item.serialNumber ?? ""}`;
      if (!consolidated[key]) {
        consolidated[key] = {
          productId: item.productId,
          quantity: 0,
          lotNumber: item.lotNumber,
          serialNumber: item.serialNumber,
        };
      }
      consolidated[key].quantity += 1;
    }

    return {
      cartonTypeId: carton.box.id,
      cartonTypeCode: carton.box.code,
      cartonSeq: idx + 1,
      items: Object.values(consolidated),
      totalWeight: Math.round((carton.currentWeight + carton.box.tareWeight) * 10000) / 10000,
      usedVolume: carton.usedVolume,
      maxVolume: volume(carton.box.length, carton.box.width, carton.box.height),
    };
  });
}
