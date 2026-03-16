# Document Intelligence (DocAI) — Handoff for New Repo

## Context

Ramola WMS has a complete receiving workflow but currently requires manual keying of BOLs, packing lists, and commercial invoices. The Document Intelligence service will automate this using AI-powered OCR/extraction.

**This is a SEPARATE repo** — not part of the WMS codebase.

## New Repo Setup

```
Repo: ciscosanchez/document-intelligence (or ramola-docai)
Stack: Next.js API routes (or Express/Fastify), Claude Vision API, TypeScript
```

## Architecture

```
┌──────────────────┐         ┌────────────────────────┐
│   Ramola WMS     │   API   │   DocAI Service         │
│                  │────────►│                          │
│  Upload BOL      │  POST   │  Preprocess image        │
│  Get results     │  /api/  │  Send to Claude Vision   │
│  Review & fix    │ extract │  Parse structured JSON   │
│  Create ASN      │         │  Score confidence         │
│                  │◄────────│  Return extracted fields  │
└──────────────────┘         └────────────────────────┘
```

## API Contract (WMS calls DocAI)

### POST /api/extract

```typescript
// Request
{
  image: string;           // base64 encoded image or PDF
  mimeType: string;        // "image/png", "image/jpeg", "application/pdf"
  documentType?: string;   // "bol", "packing_list", "commercial_invoice", "auto"
  context?: {              // Optional: helps improve matching
    clientName?: string;
    expectedProducts?: string[];  // Known SKUs to match against
  }
}

// Response
{
  documentType: "bol",
  overallConfidence: 0.94,
  processingTimeMs: 1250,
  fields: {
    bolNumber: { value: "BOL-2026-0042", confidence: 0.98, boundingBox?: {...} },
    carrier: { value: "XPO Logistics", confidence: 0.95 },
    proNumber: { value: "3849271056", confidence: 0.92 },
    shipperName: { value: "Acme Corporation", confidence: 0.97 },
    consigneeName: { value: "Armstrong Warehouse", confidence: 0.88 },
    poNumbers: { value: ["PO-2026-1234"], confidence: 0.90 },
    shipDate: { value: "2026-03-15", confidence: 0.88 },
    pieces: { value: 24, confidence: 0.85 },
    weight: { value: 18450, confidence: 0.72 },
    weightUnit: { value: "LB", confidence: 0.95 },
    sealNumber: { value: null, confidence: 0.35 },
    specialInstructions: { value: "Fragile - handle with care", confidence: 0.80 },
    lineItems: {
      value: [
        { description: "Standard Widget", quantity: 500, weight: 250, nmfc: "86750" },
        { description: "Premium Gadget", quantity: 200, weight: 240 }
      ],
      confidence: 0.85
    }
  }
}
```

### POST /api/classify

```typescript
// Request
{ image: string; mimeType: string; }

// Response
{ documentType: "bol" | "packing_list" | "commercial_invoice" | "purchase_order" | "unknown", confidence: 0.96 }
```

### GET /api/health

```json
{ "status": "ok", "model": "claude-sonnet-4-5-20250514", "version": "1.0.0" }
```

## Suggested Repo Structure

```
document-intelligence/
├── src/
│   ├── app/api/              # Next.js API routes (or Express)
│   │   ├── extract/route.ts  # Main extraction endpoint
│   │   ├── classify/route.ts # Document type classification
│   │   └── health/route.ts
│   ├── extractors/           # Document-type-specific extraction
│   │   ├── bol.ts            # BOL extraction prompts + field mapping
│   │   ├── packing-list.ts   # Packing list extraction
│   │   ├── commercial-invoice.ts
│   │   └── purchase-order.ts
│   ├── lib/
│   │   ├── claude.ts         # Claude Vision API client wrapper
│   │   ├── preprocess.ts     # Image preprocessing (deskew, enhance, crop)
│   │   ├── confidence.ts     # Field confidence scoring logic
│   │   └── types.ts          # Shared types
│   └── matching/             # Fuzzy matching against known data
│       ├── sku-matcher.ts    # Match extracted product names to SKUs
│       ├── client-matcher.ts # Match shipper/consignee to known clients
│       └── po-matcher.ts     # Match PO numbers to existing ASNs
├── tests/
│   ├── fixtures/             # Sample BOL images, PDFs for testing
│   ├── extractors/
│   └── matching/
├── docker-compose.yml
├── Dockerfile
├── .env.example              # ANTHROPIC_API_KEY, etc.
└── README.md
```

## Key Design Decisions

1. **Claude Vision API** as primary extractor (claude-sonnet-4-5-20250514 for cost, claude-opus-4-6 for accuracy)
2. **Structured output** via system prompts that request JSON with confidence scores
3. **Document classification first** — identify type, then use type-specific extraction prompt
4. **Confidence thresholds** — fields below 80% are flagged for human review in the WMS UI
5. **Context-aware matching** — WMS passes known SKUs/clients so DocAI can fuzzy-match
6. **Stateless service** — no database, just process and return (WMS stores results)

## WMS Integration Point

The WMS already has a thin client stub ready at:
- `src/lib/integrations/docai/` (needs to be created — currently referenced in architecture docs)

The WMS side needs:
1. API client to call DocAI service
2. Review UI (side-by-side: original doc | extracted fields)
3. "Create ASN from extraction" button
4. Store extraction results in `document_processing_jobs` table (already in Prisma schema)

## Environment Variables for DocAI Service

```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-5-20250514
PORT=3001
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
```

## Existing Docs

Full design document already written in the WMS repo:
- `docs/document-intelligence.md` — Complete design with UI mockups, ROI projections, implementation phases

## Decisions Already Made (Carry Forward)

These decisions were made during WMS development and should apply to DocAI too:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Runtime** | Node.js 22 (LTS) | Stable, matches WMS. Use `.node-version` file + fnm |
| **Language** | TypeScript (strict) | Type safety, shared types with WMS |
| **Containerization** | Docker | Multi-stage Dockerfile, same pattern as WMS |
| **Database** | PostgreSQL 16 (if needed) | WMS already has Postgres in Docker on port 5433 |
| **Object Storage** | MinIO (local) / S3 (AWS) | WMS already has MinIO running for document storage |
| **Cloud Target** | AWS (App Runner or ECS + S3) | Same as WMS deployment |
| **AI Provider** | Anthropic Claude API | Vision capabilities, structured output, no training needed |
| **CI/CD** | GitHub Actions | Same as WMS — lint, test, build on push/PR |
| **Formatting** | Prettier + ESLint | Same config as WMS for consistency |
| **Testing** | Jest (unit) + Playwright (E2E) | Match WMS toolchain |
| **Package Manager** | npm with `--legacy-peer-deps` | Consistency with WMS |
| **Docker Compose** | Local dev with services | DocAI can be added as a service in WMS docker-compose or standalone |
| **Auth** | API key or JWT from WMS | DocAI trusts the WMS — no separate auth needed |
| **Deployment** | Same AWS account as WMS | Single VPC, internal API calls |

### Environment Setup (Matching WMS)

```bash
# DocAI runs alongside WMS in development
# WMS: localhost:3000
# DocAI: localhost:3001
# Postgres: localhost:5433 (shared Docker container)
# MinIO: localhost:9000 (shared Docker container)
```

### Docker Compose Integration Option

DocAI can be added to the WMS `docker-compose.yml`:

```yaml
services:
  # ... existing postgres and minio ...

  docai:
    build: ../document-intelligence  # sibling directory
    ports:
      - "3001:3001"
    environment:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      PORT: 3001
      CORS_ORIGIN: http://localhost:3000
```

Or run standalone with its own docker-compose.

### Company / Product Context

- **Company**: Ramola (owned by Cisco Sanchez)
- **Product**: Ramola WMS (the warehouse management platform)
- **DocAI**: A Ramola service — branded as part of the platform, potentially standalone product later
- **First customer**: Armstrong Logistics (goarmstrong.com)
- **Platform is multi-tenant SaaS** — DocAI should be tenant-aware (extraction results scoped per tenant)
- **GitHub**: ciscosanchez org

### What Exists in WMS Already

- `docs/document-intelligence.md` — Full design doc with UI mockups, ROI, phases
- `prisma/tenant-schema.prisma` — Has `DocumentProcessingJob` model (referenced in design, not yet created in schema — needs to be added)
- `src/components/shared/file-upload.tsx` — Upload component already built
- `src/components/receiving/document-panel.tsx` — Document viewer in shipment detail
- `src/app/api/uploads/route.ts` — Pre-signed URL upload to MinIO

## Priority Features for v1

1. BOL extraction (highest value — most common document)
2. Document type auto-classification
3. Packing list extraction (line items for ASN)
4. Commercial invoice extraction (HS codes, values)
5. Confidence scoring + review flagging
