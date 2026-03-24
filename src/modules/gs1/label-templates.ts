/**
 * Retailer Compliance Label Templates
 *
 * Different retailers require different label formats and data fields.
 */

export interface LabelField {
  ai: string;
  label: string;
  required: boolean;
}

export interface ComplianceLabelTemplate {
  retailer: string;
  labelSize: { widthMm: number; heightMm: number };
  fields: LabelField[];
  notes: string;
}

const TEMPLATES: Record<string, ComplianceLabelTemplate> = {
  generic: {
    retailer: "Generic GS1",
    labelSize: { widthMm: 102, heightMm: 152 },
    fields: [
      { ai: "00", label: "SSCC", required: true },
      { ai: "01", label: "GTIN", required: false },
      { ai: "10", label: "Batch/Lot", required: false },
      { ai: "17", label: "Expiry Date", required: false },
    ],
    notes: "Standard 4x6 GS1-128 shipping label",
  },
  walmart: {
    retailer: "Walmart",
    labelSize: { widthMm: 102, heightMm: 152 },
    fields: [
      { ai: "00", label: "SSCC-18", required: true },
      { ai: "01", label: "GTIN-14", required: true },
      { ai: "10", label: "Batch/Lot", required: true },
      { ai: "17", label: "Expiry Date", required: true },
      { ai: "400", label: "PO Number", required: true },
    ],
    notes: "Walmart requires SSCC + GTIN + Lot + Expiry + PO on all inbound ASN shipments",
  },
  amazon: {
    retailer: "Amazon",
    labelSize: { widthMm: 102, heightMm: 152 },
    fields: [
      { ai: "00", label: "SSCC-18", required: true },
      { ai: "01", label: "GTIN-14", required: false },
      { ai: "37", label: "Carton Count", required: true },
    ],
    notes: "Amazon FBA requires SSCC and carton count for inbound shipments",
  },
  target: {
    retailer: "Target",
    labelSize: { widthMm: 102, heightMm: 152 },
    fields: [
      { ai: "00", label: "SSCC-18", required: true },
      { ai: "01", label: "GTIN-14", required: true },
      { ai: "10", label: "Batch/Lot", required: false },
      { ai: "400", label: "PO Number", required: true },
    ],
    notes: "Target requires SSCC + GTIN + PO for all vendor shipments",
  },
  costco: {
    retailer: "Costco",
    labelSize: { widthMm: 102, heightMm: 203 },
    fields: [
      { ai: "00", label: "SSCC-18", required: true },
      { ai: "01", label: "GTIN-14", required: true },
      { ai: "10", label: "Batch/Lot", required: true },
      { ai: "17", label: "Expiry Date", required: true },
      { ai: "37", label: "Case Count", required: true },
    ],
    notes: "Costco uses 4x8 labels and requires expiry date on all food items",
  },
};

export function getComplianceLabelTemplate(retailer: string): ComplianceLabelTemplate | null {
  return TEMPLATES[retailer.toLowerCase()] ?? null;
}

export function listAvailableTemplates(): string[] {
  return Object.keys(TEMPLATES);
}

export function getAllTemplates(): ComplianceLabelTemplate[] {
  return Object.values(TEMPLATES);
}
