/**
 * DocAI Integration Types
 *
 * Mirrors the response types from the DocAI service (localhost:3001).
 * These are the shapes WMS receives — DocAI owns the source of truth.
 */

export interface ExtractedField<T> {
  value: T;
  confidence: number;
}

export interface ShipmentLineItem {
  pieces: number;
  packageType: string;
  location?: string;
  partNumber?: string;
  model?: string;
  description: string;
  notes?: string;
  invoiceNumber?: string;
  poNumber?: string;
  quantity: number;
  serialNumber?: string;
}

export interface ShipmentData {
  shipper: ExtractedField<string>;
  carrier: ExtractedField<string>;
  consignee: ExtractedField<string>;
  supplier: ExtractedField<string>;
  receivedBy?: ExtractedField<string | null>;
  customerReference: ExtractedField<string | null>;
  salesOrderNumber: ExtractedField<string | null>;
  invoiceNumber: ExtractedField<string | null>;
  trackingNumber: ExtractedField<string | null>;
  proNumber: ExtractedField<string | null>;
  poNumbers: ExtractedField<string[]>;
  lineItems: ExtractedField<ShipmentLineItem[]>;
  totalPieces: ExtractedField<number>;
  totalWeightKg: ExtractedField<number | null>;
  totalWeightLb: ExtractedField<number | null>;
  notes: ExtractedField<string | null>;
}

export type DocumentType =
  | "bol"
  | "packing_list"
  | "commercial_invoice"
  | "purchase_order"
  | "warehouse_receipt"
  | "receiving_report"
  | "shipping_label";

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface MatchingResults {
  skuMatches?: Array<{ sku: string; matchedSku: string; confidence: number }>;
  clientMatch?: { name: string; matchedName: string; confidence: number };
  poMatches?: Array<{ po: string; matchedPo: string; confidence: number }>;
}

export interface ExtractForReceiptResponse {
  requestId?: string;
  tenantId?: string;
  receipt: ShipmentData;
  sourceDocumentType: DocumentType;
  overallConfidence: number;
  processingTimeMs: number;
  fieldsNeedingReview: string[];
  matching?: MatchingResults;
  usage?: UsageInfo;
}

export interface ClassifyResponse {
  requestId?: string;
  tenantId?: string;
  documentType: DocumentType | "unknown";
  confidence: number;
}

export interface HealthResponse {
  status: "ok" | "error";
  model: string;
  version: string;
  claudeApi?: "ok" | "error" | "degraded";
}

export interface DocAIError {
  error: string;
  message: string;
  requestId?: string;
}
