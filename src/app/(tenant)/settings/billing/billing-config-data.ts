export interface RateLine {
  serviceType: string;
  label: string;
  unitRate: number;
  uom: string;
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

const SERVICE_CONFIG: Array<{ serviceType: string; label: string; uom: string }> = [
  { serviceType: "receiving_pallet", label: "Receiving — Per Pallet", uom: "$" },
  { serviceType: "receiving_carton", label: "Receiving — Per Carton", uom: "$" },
  { serviceType: "storage_pallet", label: "Storage — Per Pallet / Month", uom: "$" },
  { serviceType: "storage_sqft", label: "Storage — Per Sq Ft / Month", uom: "$" },
  { serviceType: "handling_order", label: "Handling — Per Order", uom: "$" },
  { serviceType: "handling_line", label: "Handling — Per Line", uom: "$" },
  { serviceType: "handling_unit", label: "Handling — Per Unit", uom: "$" },
  { serviceType: "shipping_markup", label: "Shipping — Markup", uom: "%" },
  { serviceType: "value_add_hour", label: "Value-Add — Per Hour", uom: "$" },
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
      uom: cfg.uom,
    };
  });
}
