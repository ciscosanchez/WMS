export interface RateLine {
  serviceType: string;
  label: string;
  unitRate: number;
  basisCode: string;
  basisLabel: string;
}

export interface ClientRow {
  id: string;
  name: string;
  rateCard: {
    monthlyMinimum: number;
    lines: Array<{ serviceType: string; unitRate: number; uom: string }>;
  } | null;
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  total: number | string;
  dueDate: Date | string | null;
  client: { name: string };
}

export interface BillingConfigProps {
  defaultRateCard: {
    monthlyMinimum: number;
    lines: Array<{ serviceType: string; unitRate: number; uom: string }>;
  } | null;
  clients: ClientRow[];
  invoices: InvoiceRow[];
}

export const SERVICE_CONFIG: Array<{
  serviceType: string;
  label: string;
  basisCode: string;
  basisLabel: string;
}> = [
  {
    serviceType: "receiving_pallet",
    label: "Receiving — Per Pallet",
    basisCode: "per_pallet_usd",
    basisLabel: "$ / pallet",
  },
  {
    serviceType: "receiving_carton",
    label: "Receiving — Per Carton",
    basisCode: "per_carton_usd",
    basisLabel: "$ / carton",
  },
  {
    serviceType: "storage_pallet",
    label: "Storage — Per Pallet / Month",
    basisCode: "per_pallet_month_usd",
    basisLabel: "$ / pallet / month",
  },
  {
    serviceType: "storage_sqft",
    label: "Storage — Per Sq Ft / Month",
    basisCode: "per_sqft_month_usd",
    basisLabel: "$ / sq ft / month",
  },
  {
    serviceType: "handling_order",
    label: "Handling — Per Order",
    basisCode: "per_order_usd",
    basisLabel: "$ / order",
  },
  {
    serviceType: "handling_line",
    label: "Handling — Per Line",
    basisCode: "per_line_usd",
    basisLabel: "$ / line",
  },
  {
    serviceType: "handling_unit",
    label: "Handling — Per Unit",
    basisCode: "per_unit_usd",
    basisLabel: "$ / unit",
  },
  {
    serviceType: "shipping_markup",
    label: "Shipping — Markup",
    basisCode: "percent_markup",
    basisLabel: "% markup",
  },
  {
    serviceType: "value_add_hour",
    label: "Value-Add — Per Hour",
    basisCode: "per_hour_usd",
    basisLabel: "$ / hour",
  },
];

const DEFAULT_RATES: Record<string, number> = {
  receiving_pallet: 8.5,
  receiving_carton: 1.25,
  storage_pallet: 18.0,
  storage_sqft: 0.85,
  handling_order: 3.5,
  handling_line: 0.75,
  handling_unit: 0.15,
  shipping_markup: 10,
  value_add_hour: 45.0,
};

export function buildRateLines(
  savedLines: Array<{ serviceType: string; unitRate: number; uom: string }> | undefined
): RateLine[] {
  return SERVICE_CONFIG.map((cfg) => {
    const saved = savedLines?.find((line) => line.serviceType === cfg.serviceType);
    return {
      serviceType: cfg.serviceType,
      label: cfg.label,
      unitRate: saved ? Number(saved.unitRate) : (DEFAULT_RATES[cfg.serviceType] ?? 0),
      basisCode: cfg.basisCode,
      basisLabel: cfg.basisLabel,
    };
  });
}

export function getBillingServiceConfig(serviceType: string) {
  return SERVICE_CONFIG.find((config) => config.serviceType === serviceType) ?? null;
}

export function validateBillingRateBasis(serviceType: string, basisCode: string) {
  const config = getBillingServiceConfig(serviceType);
  return config !== null && config.basisCode === basisCode;
}
