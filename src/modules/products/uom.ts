export type UomOption = {
  code: string;
  label: string;
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
