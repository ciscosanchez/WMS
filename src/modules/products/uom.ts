export type UomOption = {
  code: string;
  label: string;
};

type NumericLike = number | string | { toString(): string };

export type ProductUomSource = {
  baseUom: string;
  unitsPerCase?: number | null;
  uomConversions?: Array<{
    fromUom: string;
    toUom: string;
    factor: NumericLike;
  }>;
};

export type ProductUomChoice = {
  code: string;
  factor: number;
  source: "base" | "case_pack" | "conversion";
};

export const BASE_UOM_OPTIONS: UomOption[] = [
  { code: "EA", label: "Each" },
  { code: "CS", label: "Case" },
  { code: "PK", label: "Pack" },
  { code: "BX", label: "Box" },
  { code: "PLT", label: "Pallet" },
  { code: "RL", label: "Roll" },
  { code: "FT", label: "Foot" },
  { code: "M", label: "Meter" },
  { code: "LB", label: "Pound" },
  { code: "KG", label: "Kilogram" },
];

export const PACKAGING_UOM_OPTIONS: UomOption[] = [
  { code: "CS", label: "Case" },
  { code: "PK", label: "Pack" },
  { code: "BX", label: "Box" },
  { code: "PLT", label: "Pallet" },
  { code: "RL", label: "Roll" },
  { code: "INNER", label: "Inner Pack" },
  { code: "BNDL", label: "Bundle" },
  { code: "CRATE", label: "Crate" },
];

export const WEIGHT_UNIT_OPTIONS: UomOption[] = [
  { code: "lb", label: "lb" },
  { code: "kg", label: "kg" },
  { code: "oz", label: "oz" },
  { code: "g", label: "g" },
];

export const DIM_UNIT_OPTIONS: UomOption[] = [
  { code: "in", label: "in" },
  { code: "ft", label: "ft" },
  { code: "cm", label: "cm" },
  { code: "m", label: "m" },
];

export function normalizeUomCode(value: string | null | undefined, fallback = "EA") {
  const next = value?.trim().toUpperCase();
  return next && next.length > 0 ? next : fallback;
}

export function ensureUomOption(
  options: UomOption[],
  code: string | null | undefined,
  fallbackLabel = "Custom"
) {
  const normalized = normalizeUomCode(code, "");
  if (!normalized) return options;
  if (options.some((option) => option.code === normalized)) return options;
  return [...options, { code: normalized, label: `${fallbackLabel} (${normalized})` }];
}

function numericFactor(value: NumericLike) {
  const next = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(next) ? next : 0;
}

export function getProductUomChoices(product: ProductUomSource): ProductUomChoice[] {
  const baseUom = normalizeUomCode(product.baseUom);
  const choices = new Map<string, ProductUomChoice>([
    [baseUom, { code: baseUom, factor: 1, source: "base" }],
  ]);

  if (product.unitsPerCase && product.unitsPerCase > 0 && baseUom !== "CS") {
    choices.set("CS", {
      code: "CS",
      factor: product.unitsPerCase,
      source: "case_pack",
    });
  }

  for (const conversion of product.uomConversions ?? []) {
    const fromUom = normalizeUomCode(conversion.fromUom, "");
    const toUom = normalizeUomCode(conversion.toUom, baseUom);
    if (!fromUom || toUom !== baseUom) continue;
    const factor = numericFactor(conversion.factor);
    if (factor <= 0) continue;
    choices.set(fromUom, {
      code: fromUom,
      factor,
      source: "conversion",
    });
  }

  return Array.from(choices.values());
}

export function convertQuantityToBaseUom(
  product: ProductUomSource,
  quantity: number,
  requestedUom: string | null | undefined
) {
  const normalizedUom = normalizeUomCode(requestedUom, product.baseUom);
  const choice = getProductUomChoices(product).find((item) => item.code === normalizedUom);
  if (!choice) {
    throw new Error(`Unsupported UOM ${normalizedUom} for product`);
  }

  const baseQuantity = quantity * choice.factor;
  if (!Number.isInteger(baseQuantity)) {
    throw new Error(`UOM ${normalizedUom} must resolve to whole base units`);
  }

  return {
    requestedUom: normalizedUom,
    baseUom: normalizeUomCode(product.baseUom),
    baseQuantity,
    factor: choice.factor,
  };
}
