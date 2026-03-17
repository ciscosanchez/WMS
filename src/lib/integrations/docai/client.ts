/**
 * DocAI API Client
 *
 * Sends documents to the DocAI service for AI-powered extraction.
 * DocAI runs as a separate microservice (default: localhost:3001).
 */

import type {
  ExtractForReceiptResponse,
  ClassifyResponse,
  HealthResponse,
  DocumentType,
  DocAIError,
} from './types';

const DOCAI_URL = process.env.DOCAI_URL || 'http://localhost:3001';
const DOCAI_API_KEY = process.env.DOCAI_API_KEY || '';
const DOCAI_TIMEOUT = parseInt(process.env.DOCAI_TIMEOUT_MS || '120000');

function headers(tenantId?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (DOCAI_API_KEY) h['x-api-key'] = DOCAI_API_KEY;
  if (tenantId) h['x-tenant-id'] = tenantId;
  return h;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOCAI_TIMEOUT);

  try {
    const res = await fetch(`${DOCAI_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Partial<DocAIError>;
      throw new Error(body.message || `DocAI returned ${res.status}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`DocAI request timed out after ${DOCAI_TIMEOUT}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract structured shipment data from a document.
 * This is the primary endpoint — sends any doc and gets back ShipmentData.
 */
export async function extractForReceipt(opts: {
  fileBase64: string;
  mimeType: string;
  documentType?: DocumentType | 'auto';
  tenantId?: string;
  context?: {
    clientName?: string;
    expectedProducts?: string[];
    knownPOs?: string[];
    consigneeName?: string;
  };
}): Promise<ExtractForReceiptResponse> {
  return request<ExtractForReceiptResponse>('/api/v1/extract-for-receipt', {
    method: 'POST',
    headers: headers(opts.tenantId),
    body: JSON.stringify({
      image: opts.fileBase64,
      mimeType: opts.mimeType,
      documentType: opts.documentType || 'auto',
      context: opts.context,
    }),
  });
}

/**
 * Classify a document without extracting data.
 */
export async function classify(opts: {
  fileBase64: string;
  mimeType: string;
  tenantId?: string;
}): Promise<ClassifyResponse> {
  return request<ClassifyResponse>('/api/v1/classify', {
    method: 'POST',
    headers: headers(opts.tenantId),
    body: JSON.stringify({
      image: opts.fileBase64,
      mimeType: opts.mimeType,
    }),
  });
}

/**
 * Health check — verifies DocAI service and Claude API are reachable.
 */
export async function healthCheck(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/v1/health', {
    method: 'GET',
    headers: headers(),
  });
}
