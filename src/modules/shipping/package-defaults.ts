import type { ShipmentPackage } from "@/lib/integrations/carriers/types";

type CartonTypeLike = {
  length: unknown;
  width: unknown;
  height: unknown;
  dimUnit: string;
  tareWeight: unknown;
  weightUnit: string;
} | null;

type ShipmentPackageLike = {
  packageWeight?: unknown;
  packageLength?: unknown;
  packageWidth?: unknown;
  packageHeight?: unknown;
};

const DEFAULT_PACKAGE: ShipmentPackage = {
  weight: 1,
  weightUnit: "lb",
  length: 12,
  width: 10,
  height: 6,
  dimUnit: "in",
};

function normalizeWeightUnit(value: string | null | undefined): ShipmentPackage["weightUnit"] {
  return value === "kg" ? "kg" : "lb";
}

function normalizeDimUnit(value: string | null | undefined): ShipmentPackage["dimUnit"] {
  return value === "cm" ? "cm" : "in";
}

function toPositiveNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

export function resolveShipmentPackage(
  shipment: ShipmentPackageLike,
  cartonType?: CartonTypeLike
): ShipmentPackage {
  const fallbackWeight = toPositiveNumber(cartonType?.tareWeight) ?? DEFAULT_PACKAGE.weight;
  const fallbackLength = toPositiveNumber(cartonType?.length) ?? DEFAULT_PACKAGE.length;
  const fallbackWidth = toPositiveNumber(cartonType?.width) ?? DEFAULT_PACKAGE.width;
  const fallbackHeight = toPositiveNumber(cartonType?.height) ?? DEFAULT_PACKAGE.height;

  return {
    weight: toPositiveNumber(shipment.packageWeight) ?? fallbackWeight,
    weightUnit: normalizeWeightUnit(cartonType?.weightUnit),
    length: toPositiveNumber(shipment.packageLength) ?? fallbackLength,
    width: toPositiveNumber(shipment.packageWidth) ?? fallbackWidth,
    height: toPositiveNumber(shipment.packageHeight) ?? fallbackHeight,
    dimUnit: normalizeDimUnit(cartonType?.dimUnit),
  };
}
