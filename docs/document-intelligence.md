# Document Intelligence — Eliminating Manual Keying

## The Problem

Warehousing and logistics still runs on paper. Every day, Armstrong staff manually key data from:

- **Bills of Lading (BOL)** — carrier, shipper, consignee, pieces, weight, PO numbers, special instructions
- **Packing Lists** — SKUs, quantities, lot numbers, serial numbers, dimensions
- **Commercial Invoices** — HS codes, declared values, country of origin, incoterms
- **Delivery Receipts / PODs** — signatures, timestamps, damage notes
- **Purchase Orders** — line items, expected quantities, ship dates
- **Customs Documents** — ISF, entry summaries, classification rulings
- **Carrier Rate Confirmations** — rates, accessorials, pickup/delivery details
- **Weight Tickets / Tally Sheets** — piece counts during unloading

This manual keying is:
- **Slow** — 5-15 minutes per BOL, multiply by dozens per day
- **Error-prone** — transposition errors, missed fields, wrong PO linkage
- **Expensive** — dedicated data entry staff or warehouse workers pulled off the floor
- **Bottleneck** — receiving can't start until the ASN is keyed, trucks wait at the dock

## The Solution: Scan → Extract → Verify → Post

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CAPTURE    │────►│   EXTRACT    │────►│    VERIFY    │────►│     POST     │
│              │     │              │     │              │     │              │
│ Phone camera │     │ AI/OCR       │     │ Human review │     │ Create ASN   │
│ Scanner      │     │ extracts     │     │ correct/     │     │ Create order │
│ Email attach │     │ structured   │     │ confirm      │     │ Update inv   │
│ EDI inbound  │     │ data         │     │ fields       │     │ File doc     │
│ Fax/PDF      │     │              │     │              │     │              │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

## Document Types & Extracted Fields

### Bill of Lading (BOL)

The BOL is the most critical document — it triggers the entire receiving process.

```
┌─────────────────────────────────────────────────────────────┐
│                    BILL OF LADING                             │
│                                                              │
│  Extracted Fields:                                           │
│  ├── BOL Number ────────────────→ shipment.bol_number        │
│  ├── Shipper Name/Address ──────→ linked to client           │
│  ├── Consignee ─────────────────→ verified as Armstrong loc  │
│  ├── Carrier Name ──────────────→ shipment.carrier           │
│  ├── PRO / Tracking Number ────→ shipment.tracking_number    │
│  ├── PO Number(s) ─────────────→ shipment.po_number          │
│  ├── Ship Date ─────────────────→ shipment.expected_date     │
│  ├── Pieces / Handling Units ──→ shipment line quantities    │
│  ├── Weight ────────────────────→ shipment total weight      │
│  ├── Freight Class ─────────────→ metadata                   │
│  ├── NMFC / Commodity ─────────→ product matching            │
│  ├── Special Instructions ─────→ shipment.notes              │
│  ├── Seal Number ──────────────→ receiving verification      │
│  └── Signatures ────────────────→ stored as image            │
│                                                              │
│  Confidence Score: 0-100% per field                          │
│  Fields below threshold → highlighted for human review       │
└─────────────────────────────────────────────────────────────┘
```

### Packing List

```
Extracted Fields:
├── PO Number(s) ──────────→ match to existing ASN or create new
├── Line Items:
│   ├── SKU / Part Number ──→ product lookup (fuzzy match)
│   ├── Description ────────→ fallback if SKU not found
│   ├── Quantity ───────────→ shipment_line.expected_qty
│   ├── UOM ────────────────→ shipment_line.uom
│   ├── Lot Number ─────────→ shipment_line.lot_number
│   ├── Serial Numbers ────→ shipment_line.serial_number
│   ├── Weight per unit ───→ product dimensions update
│   └── Country of Origin ──→ product metadata
├── Total Pieces ──────────→ cross-check with BOL
└── Total Weight ──────────→ cross-check with BOL
```

### Commercial Invoice

```
Extracted Fields:
├── Invoice Number ─────────→ document reference
├── Seller / Buyer ─────────→ client matching
├── Line Items:
│   ├── Description ────────→ product matching
│   ├── HS Code ────────────→ product.hs_code (auto-classify)
│   ├── Quantity ───────────→ cross-check with packing list
│   ├── Unit Value ─────────→ customs declared value
│   └── Country of Origin ──→ compliance field
├── Total Value ────────────→ shipment declared value
├── Incoterms ──────────────→ shipment metadata
└── Currency ───────────────→ conversion if needed
```

## Architecture

### AI/OCR Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCUMENT INTELLIGENCE PIPELINE             │
│                                                              │
│  ┌───────────┐                                               │
│  │  CAPTURE   │                                               │
│  │            │                                               │
│  │  Upload UI │──── image/PDF ────┐                          │
│  │  Camera    │                   │                          │
│  │  Email     │                   ▼                          │
│  │  EDI       │          ┌──────────────┐                    │
│  └───────────┘          │  PREPROCESS   │                    │
│                          │              │                    │
│                          │  Deskew      │                    │
│                          │  Enhance     │                    │
│                          │  Classify    │                    │
│                          │  (BOL? PL?   │                    │
│                          │   Invoice?)  │                    │
│                          └──────┬───────┘                    │
│                                 │                            │
│                                 ▼                            │
│                   ┌──────────────────────┐                   │
│                   │    AI EXTRACTION      │                   │
│                   │                       │                   │
│                   │  Option A: Claude API │                   │
│                   │  (vision + structured │                   │
│                   │   output)             │                   │
│                   │                       │                   │
│                   │  Option B: AWS        │                   │
│                   │  Textract             │                   │
│                   │                       │                   │
│                   │  Option C: Google     │                   │
│                   │  Document AI          │                   │
│                   │                       │                   │
│                   │  → Structured JSON    │                   │
│                   │  → Confidence scores  │                   │
│                   └──────────┬────────────┘                   │
│                              │                               │
│                              ▼                               │
│                   ┌───────────────────────┐                  │
│                   │   SMART MATCHING       │                  │
│                   │                        │                  │
│                   │  SKU fuzzy match       │                  │
│                   │  Client name match     │                  │
│                   │  PO number lookup      │                  │
│                   │  Address validation    │                  │
│                   │  HS code validation    │                  │
│                   └──────────┬─────────────┘                 │
│                              │                               │
│                              ▼                               │
│                   ┌───────────────────────┐                  │
│                   │   HUMAN REVIEW UI      │                  │
│                   │                        │                  │
│                   │  Side-by-side:         │                  │
│                   │  Original doc │ Fields │                  │
│                   │               │        │                  │
│                   │  Low-confidence fields │                  │
│                   │  highlighted in yellow │                  │
│                   │                        │                  │
│                   │  Tab/Enter to confirm  │                  │
│                   │  Click to correct      │                  │
│                   │                        │                  │
│                   │  "Looks good" → Post   │                  │
│                   └──────────┬─────────────┘                 │
│                              │                               │
│                              ▼                               │
│                   ┌───────────────────────┐                  │
│                   │   POST TO WMS          │                  │
│                   │                        │                  │
│                   │  Create/update ASN     │                  │
│                   │  Add line items        │                  │
│                   │  Attach original doc   │                  │
│                   │  Audit trail           │                  │
│                   └───────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Recommended AI Approach: Claude Vision API

Claude's vision capabilities are ideal for this because:

1. **Understands messy documents** — handwritten BOLs, faded faxes, rotated scans, multi-page PDFs
2. **Structured output** — can return JSON with field-level confidence scores
3. **Contextual reasoning** — can infer missing fields (e.g., carrier from PRO number format)
4. **Multi-language** — handles international shipping docs
5. **No training required** — works out of the box, improves with prompt engineering
6. **Already in our stack** — Anthropic API, same vendor as our development tools

```typescript
// Example: Extract BOL data using Claude Vision API
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: bolImageBase64 }
      },
      {
        type: "text",
        text: `Extract all fields from this Bill of Lading. Return JSON:
        {
          "bol_number": { "value": string, "confidence": 0-100 },
          "carrier": { "value": string, "confidence": 0-100 },
          "shipper_name": { "value": string, "confidence": 0-100 },
          "consignee_name": { "value": string, "confidence": 0-100 },
          "pro_number": { "value": string, "confidence": 0-100 },
          "po_numbers": { "value": string[], "confidence": 0-100 },
          "ship_date": { "value": string, "confidence": 0-100 },
          "pieces": { "value": number, "confidence": 0-100 },
          "weight": { "value": number, "confidence": 0-100 },
          "weight_unit": { "value": "LB"|"KG", "confidence": 0-100 },
          "freight_class": { "value": string, "confidence": 0-100 },
          "seal_number": { "value": string, "confidence": 0-100 },
          "special_instructions": { "value": string, "confidence": 0-100 },
          "line_items": [{
            "description": string,
            "quantity": number,
            "weight": number,
            "nmfc": string
          }]
        }`
      }
    ]
  }]
});
```

### Fallback Strategy

```
Priority 1: Claude Vision API (best accuracy, contextual understanding)
Priority 2: AWS Textract (backup, good for standard form layouts)
Priority 3: Manual entry (always available as fallback)
```

## User Experience

### Capture Methods

| Method | Use Case | Flow |
|--------|----------|------|
| **Phone camera** | Operator at dock photographs BOL from driver | Operator App → camera → upload → extract |
| **Scanner** | Office staff scans multi-page BOL/packing list | Scan to folder → auto-detect → extract |
| **Email attachment** | Client emails BOL/PO/packing list | Dedicated inbox → auto-process → queue for review |
| **Upload in WMS** | Back-office manually uploads document | WMS UI → drag-and-drop → extract |
| **EDI** | Structured data from enterprise clients | Auto-parse → create ASN directly (no OCR needed) |

### Human Review UI — "Smart Receiving"

```
┌─────────────────────────────────────────────────────────────────┐
│  Smart Receiving — BOL-2026-04821                    ✕ Close    │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │                          │  │ Extracted Data               │ │
│  │  [Original BOL Image]    │  │                              │ │
│  │                          │  │ BOL #: BOL-2026-04821  ✓ 98% │ │
│  │  ← Page 1 of 2 →        │  │ Carrier: XPO Logistics ✓ 95% │ │
│  │                          │  │ PRO #: 3849271056     ✓ 92% │ │
│  │  [Zoom] [Rotate]         │  │ Client: ACME Corp     ✓ 97% │ │
│  │                          │  │ PO #: PO-2026-1234    ✓ 90% │ │
│  │                          │  │ Ship Date: 03/15/2026 ✓ 88% │ │
│  │                          │  │ Pieces: 24 pallets    ✓ 85% │ │
│  │                          │  │ Weight: 18,450 LB     ⚠ 72% │ │
│  │                          │  │ Seal #: [unclear]     ✗ 35% │ │
│  │                          │  │                              │ │
│  │                          │  │ Line Items:                  │ │
│  │                          │  │ 1. Widget-001  × 500   ✓ 91%│ │
│  │                          │  │ 2. Gadget-001  × 200   ✓ 89%│ │
│  │                          │  │ 3. [unclear]   × 100   ⚠ 45%│ │
│  │                          │  │                              │ │
│  └──────────────────────────┘  │ ⚠ 2 fields need review      │ │
│                                 └──────────────────────────────┘ │
│                                                                  │
│  [Skip]              [Save Draft]              [Create ASN →]   │
└─────────────────────────────────────────────────────────────────┘

Legend: ✓ High confidence (>80%)  ⚠ Needs review (40-80%)  ✗ Low (<40%)
```

### Workflow Integration

```
BEFORE (Manual):
  Driver arrives → hand paper BOL to office → 10 min manual keying
  → fix errors → create ASN → print receiving sheet → walk to dock
  → start receiving
  Total: 15-25 minutes before first pallet is scanned

AFTER (Smart Receiving):
  Driver arrives → operator photographs BOL with phone → AI extracts
  → 30 sec review/confirm → ASN auto-created → start receiving
  Total: 1-2 minutes before first pallet is scanned
```

## Data Model Additions

### Document Processing Queue

```sql
-- Added to tenant schema
model DocumentProcessingJob {
  id            String   @id @default(cuid())
  documentId    String?  @map("document_id")
  sourceType    String   @map("source_type")    -- upload, email, camera, scanner
  documentType  String?  @map("document_type")   -- bol, packing_list, invoice, unknown
  status        String   @default("pending")     -- pending, processing, review, completed, failed
  fileUrl       String   @map("file_url")
  fileName      String   @map("file_name")
  mimeType      String?  @map("mime_type")

  -- AI extraction results
  extractedData Json?    @map("extracted_data")  -- structured JSON from AI
  confidence    Float?                            -- overall confidence 0-1
  aiModel       String?  @map("ai_model")        -- which model was used
  aiCost        Float?   @map("ai_cost")         -- API cost for tracking

  -- Human review
  reviewedData  Json?    @map("reviewed_data")   -- corrected data after review
  reviewedBy    String?  @map("reviewed_by")
  reviewedAt    DateTime? @map("reviewed_at")

  -- Result
  resultType    String?  @map("result_type")     -- shipment, order, product_update
  resultId      String?  @map("result_id")       -- ID of created entity

  createdAt     DateTime @default(now()) @map("created_at")
  processedAt   DateTime? @map("processed_at")

  @@index([status])
  @@map("document_processing_jobs")
}
```

### Field-Level Extraction Schema

```typescript
interface ExtractedField<T> {
  value: T;
  confidence: number;     // 0-100
  boundingBox?: {         // location on document for highlighting
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
  };
  source: "ai" | "manual" | "edi";
}

interface ExtractedBOL {
  bolNumber: ExtractedField<string>;
  carrier: ExtractedField<string>;
  proNumber: ExtractedField<string>;
  shipperName: ExtractedField<string>;
  consigneeName: ExtractedField<string>;
  poNumbers: ExtractedField<string[]>;
  shipDate: ExtractedField<string>;
  pieces: ExtractedField<number>;
  weight: ExtractedField<number>;
  weightUnit: ExtractedField<"LB" | "KG">;
  freightClass: ExtractedField<string>;
  sealNumber: ExtractedField<string>;
  specialInstructions: ExtractedField<string>;
  lineItems: ExtractedField<Array<{
    description: string;
    quantity: number;
    weight: number;
    nmfc?: string;
  }>>;
}
```

## Implementation Phases

### Phase 1: BOL Capture & Extract (MVP)
- Upload BOL image/PDF from WMS UI or Operator App camera
- Send to Claude Vision API for extraction
- Display side-by-side review UI
- One-click "Create ASN" from extracted data
- Store original document + extraction results

### Phase 2: Smart Matching
- Fuzzy match extracted client names to existing clients
- Match PO numbers to existing ASNs
- Match product descriptions to SKU catalog
- Suggest best matches with confidence scores
- Learn from corrections over time

### Phase 3: Multi-Document Processing
- Packing list extraction → auto-populate ASN line items
- Commercial invoice extraction → HS codes, values
- Match documents across a single shipment (BOL + PL + CI)
- Cross-validate quantities between documents

### Phase 4: Automated Ingest
- Monitored email inbox → auto-classify → auto-extract → queue for review
- Scanner hot-folder → auto-process new files
- API endpoint for programmatic document submission
- EDI 856 (ASN) parser for structured inbound data

### Phase 5: Learning & Optimization
- Track correction rates per field, per document type
- Fine-tune prompts based on common corrections
- Build client-specific templates (recurring shippers have consistent BOL formats)
- Measure time savings vs manual entry

## ROI Projection

| Metric | Manual | With Document Intelligence |
|--------|--------|---------------------------|
| Time per BOL | 10-15 min | 1-2 min (review only) |
| Error rate | 3-5% | <1% (AI + human verify) |
| BOLs processed/day (1 person) | 30-40 | 200+ |
| Cost per document | ~$3-5 (labor) | ~$0.10-0.30 (API) |
| Dock-to-receiving time | 15-25 min | 2-5 min |

For a facility processing 100 BOLs/day:
- **Manual**: 2-3 FTEs dedicated to data entry (~$120K-$180K/year)
- **AI-assisted**: 0.5 FTE for review (~$30K/year) + ~$10K/year API costs
- **Savings: ~$80K-$140K/year per facility**
