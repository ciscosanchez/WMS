/**
 * DocAI Integration — Barrel Export
 */

export { extractForReceipt, classify, healthCheck } from './client';
export type {
  ExtractForReceiptResponse,
  ClassifyResponse,
  HealthResponse,
  ShipmentData,
  ShipmentLineItem,
  ExtractedField,
  DocumentType,
  UsageInfo,
  MatchingResults,
  DocAIError,
} from './types';
