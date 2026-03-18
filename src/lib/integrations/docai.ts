/**
 * DocAI integration — calls Claude Vision API to extract structured data
 * from BOLs, packing lists, shipping labels, and other receiving documents.
 *
 * This is the WMS-side integration layer. The DocAI service (separate repo)
 * lives at github.com/ramola/docai; this module calls Anthropic directly
 * so the WMS can work standalone without the service deployed.
 */
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single extracted field with a value and confidence score (0-1). */
export interface ExtractedField<T = string> {
  value: T | null;
  confidence: number; // 0-1
  rawText?: string; // raw text from document before parsing
}

/** A single line item on a BOL or packing list. */
export interface ShipmentLineItem {
  description?: string;
  sku?: string;
  quantity?: number;
  pieces?: number;
  uom?: string;
  weight?: number;
  packageType?: string;
  poNumber?: string;
  nmfc?: string;
  freightClass?: string;
  confidence: number;
}

/** Structured shipment data extracted from a BOL or packing list. */
export interface ShipmentData {
  carrier?: ExtractedField;
  trackingNumber?: ExtractedField;
  proNumber?: ExtractedField; // BOL number / PRO number
  poNumbers?: ExtractedField<string[]>;
  shipper?: ExtractedField;
  shipperAddress?: ExtractedField;
  supplier?: ExtractedField;
  consignee?: ExtractedField;
  consigneeAddress?: ExtractedField;
  invoiceNumber?: ExtractedField;
  customerReference?: ExtractedField;
  shipDate?: ExtractedField;
  deliveryDate?: ExtractedField;
  totalWeightLb?: ExtractedField<number>;
  totalPieces?: ExtractedField<number>;
  pallets?: ExtractedField<number>;
  freightClass?: ExtractedField;
  hazmat?: ExtractedField<boolean>;
  notes?: ExtractedField;
  /** Line items wrapped as an ExtractedField so the array has a confidence score. */
  lineItems?: ExtractedField<ShipmentLineItem[]>;
}

export interface ExtractForReceiptResponse {
  requestId: string;
  sourceDocumentType: string; // "bol" | "packing_list" | "invoice" | "label" | "unknown"
  receipt: ShipmentData;
  overallConfidence: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a logistics document parser. Extract structured data from shipping documents (BOLs, packing lists, invoices, labels).

Return ONLY valid JSON in this exact shape. Every field is optional — if you cannot find it, omit it or set value to null.
For each field include a "confidence" score from 0.0 to 1.0 based on how certain you are.

{
  "sourceDocumentType": "bol|packing_list|invoice|label|unknown",
  "overallConfidence": 0.0-1.0,
  "receipt": {
    "carrier": { "value": "string", "confidence": 0.0-1.0 },
    "trackingNumber": { "value": "string", "confidence": 0.0-1.0 },
    "proNumber": { "value": "string", "confidence": 0.0-1.0 },
    "poNumbers": { "value": ["string"], "confidence": 0.0-1.0 },
    "shipper": { "value": "string", "confidence": 0.0-1.0 },
    "shipperAddress": { "value": "string", "confidence": 0.0-1.0 },
    "consignee": { "value": "string", "confidence": 0.0-1.0 },
    "consigneeAddress": { "value": "string", "confidence": 0.0-1.0 },
    "shipDate": { "value": "YYYY-MM-DD", "confidence": 0.0-1.0 },
    "deliveryDate": { "value": "YYYY-MM-DD", "confidence": 0.0-1.0 },
    "totalWeightLb": { "value": 0, "confidence": 0.0-1.0 },
    "totalPieces": { "value": 0, "confidence": 0.0-1.0 },
    "pallets": { "value": 0, "confidence": 0.0-1.0 },
    "supplier": { "value": "string", "confidence": 0.0-1.0 },
    "invoiceNumber": { "value": "string", "confidence": 0.0-1.0 },
    "customerReference": { "value": "string", "confidence": 0.0-1.0 },
    "freightClass": { "value": "string", "confidence": 0.0-1.0 },
    "hazmat": { "value": false, "confidence": 0.0-1.0 },
    "notes": { "value": "string", "confidence": 0.0-1.0 },
    "lineItems": {
      "confidence": 0.0-1.0,
      "value": [
        {
          "description": "string",
          "sku": "string",
          "quantity": 0,
          "pieces": 0,
          "uom": "string",
          "weight": 0,
          "packageType": "string",
          "poNumber": "string",
          "confidence": 0.0-1.0
        }
      ]
    }
  }
}

Rules:
- Dates must be ISO 8601 (YYYY-MM-DD)
- Weight in lbs unless otherwise noted
- If the document is an image, read all text carefully including stamps and handwriting
- PRO number and BOL number are the same thing
- Return ONLY the JSON object, no explanation or markdown`;

// ─── Anthropic client ─────────────────────────────────────────────────────────

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env to enable DocAI extraction."
    );
  }
  return new Anthropic({ apiKey });
}

// ─── Main extraction function ─────────────────────────────────────────────────

/**
 * Extract shipment data from a document (image or PDF) using Claude Vision.
 *
 * @param opts.fileBase64  Base64-encoded file content
 * @param opts.mimeType    MIME type (image/jpeg, image/png, application/pdf, etc.)
 * @param opts.tenantId    For request tracing
 * @param opts.context     Optional hints (clientName helps Claude narrow down shipper)
 */
export async function extractForReceipt(opts: {
  fileBase64: string;
  mimeType: string;
  tenantId: string;
  context?: { clientName?: string };
}): Promise<ExtractForReceiptResponse> {
  const client = getClient();

  const userPrompt = opts.context?.clientName
    ? `Extract all shipment data from this document. The expected client/consignee is "${opts.context.clientName}" — use this as a hint if you see partial matches.`
    : "Extract all shipment data from this document.";

  // Claude Vision supports image types natively; PDFs need to be sent as documents
  const isImage = opts.mimeType.startsWith("image/");
  const isPdf = opts.mimeType === "application/pdf";

  if (!isImage && !isPdf) {
    throw new Error(`Unsupported MIME type for extraction: ${opts.mimeType}`);
  }

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: isImage
          ? [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: opts.mimeType as
                    | "image/jpeg"
                    | "image/png"
                    | "image/gif"
                    | "image/webp",
                  data: opts.fileBase64,
                },
              },
              { type: "text", text: userPrompt },
            ]
          : [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: opts.fileBase64,
                },
              },
              { type: "text", text: userPrompt },
            ],
      },
    ],
  });

  // Parse the JSON response
  const rawText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let parsed: { sourceDocumentType: string; overallConfidence: number; receipt: ShipmentData };
  try {
    // Strip any accidental markdown code fences
    const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/```$/m, "").trim();
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`DocAI returned invalid JSON: ${rawText.slice(0, 200)}`);
  }

  // Compute cost (claude-opus-4-6 pricing as of 2025)
  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;
  const estimatedCostUsd = inputTokens * 0.000015 + outputTokens * 0.000075;

  return {
    requestId: message.id,
    sourceDocumentType: parsed.sourceDocumentType ?? "unknown",
    receipt: parsed.receipt ?? {},
    overallConfidence: parsed.overallConfidence ?? 0,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    },
  };
}
