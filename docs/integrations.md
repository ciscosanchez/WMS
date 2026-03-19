# Ramola WMS — Integrations & Feature Build Log

Last updated: 2026-03-19

---

## Overview

This document covers three major feature phases built on top of the existing WMS core:

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Billing Engine | ✅ Live |
| 2 | DocAI Document Intelligence UI | ✅ Live |
| 3 | Shopify Real Order Sync | ✅ Live |

---

## Phase 1 — Billing Engine

### What it does
Captures a billable event every time the warehouse performs work, aggregates them into invoices, and surfaces revenue data in the reports and client portal.

### Database schema (migration: `prisma/tenant-migrations/0002_billing.sql`)

| Table | Purpose |
|-------|---------|
| `rate_cards` | Per-client rate definitions (or a global default) |
| `rate_card_lines` | One row per service type with unit rate |
| `billing_events` | Immutable ledger — one row per billable action |
| `invoices` | Invoice header per billing cycle per client |
| `invoice_lines` | Line items per invoice (one per service type) |

### Service types tracked

| Code | Description |
|------|-------------|
| `receiving_carton` | Per carton received |
| `handling_unit` | Per unit handled (receiving) |
| `handling_order` | Per order fulfilled |
| `handling_line` | Per order line picked/packed |
| `handling_unit_out` | Per unit shipped |
| `storage_pallet` | Per pallet-position per day |
| `storage_sqft` | Per sq-ft per day |
| `special_project` | Ad-hoc labor |
| `return_processing` | Per return unit |

### Event capture hooks

Events are captured silently (never break the main workflow) via `src/modules/billing/capture.ts`:

- **Receiving completion** (`src/modules/receiving/actions.ts`) — emits `receiving_carton` + `handling_unit` when a shipment is marked completed
- **Pack confirmation** (`src/modules/operator/actions.ts`) — emits `handling_order` + `handling_line` + `handling_unit` when an operator confirms a pack

### Key files

| File | Purpose |
|------|---------|
| `src/modules/billing/capture.ts` | Internal helper — looks up rate card, writes billing event |
| `src/modules/billing/actions.ts` | Server actions: rate cards, invoice generation, summaries |
| `src/app/(tenant)/settings/billing/page.tsx` | Rate card configuration UI (server component) |
| `src/app/(tenant)/settings/billing/_client.tsx` | Rate card interactive form (client component) |
| `src/app/(portal)/portal/billing/page.tsx` | Client portal — real invoices and MTD totals |
| `src/app/(tenant)/reports/page.tsx` | Reports page — real billing summary from DB |

### How to configure rates

1. Go to **Settings → Billing**
2. Set unit rates for each service type under "Default Rate Card"
3. Optionally set per-client overrides in the client-specific section
4. Save — rates take effect on the next billable event

### How to generate an invoice

Call `generateInvoice(clientId, fromDate, toDate)` from `src/modules/billing/actions.ts`. It:
1. Aggregates all uninvoiced `billing_events` for the client in the date range
2. Groups by service type, applies unit rates
3. Applies monthly minimum if configured
4. Creates an `Invoice` + `InvoiceLine` records
5. Marks events as invoiced

---

## Phase 2 — DocAI Document Intelligence

### What it does
Uses Claude Vision (Anthropic API) to extract structured data from shipping documents — BOLs, packing lists, shipping labels — and auto-populate WMS fields.

### Architecture

```
Warehouse staff uploads/photos a document
        ↓
File uploaded to S3/MinIO via /api/uploads
        ↓
processDocument() called → file fetched from S3 → sent to Claude Vision API
        ↓
Structured data extracted (carrier, BOL, tracking, PO, line items, weight)
        ↓
DocumentProcessingJob created with status "review" + confidence scores
        ↓
Staff reviews extracted fields with confidence indicators
        ↓
"Update Shipment" → patches shipment header fields from extraction
```

### UI entry points

| Location | What it does |
|----------|-------------|
| Receiving shipment detail → "Scan Document" button | Upload/photograph a document, review extraction, apply to shipment |
| Receiving list page → "Recent AI Extractions" panel | Shows last 5 DocAI jobs with status and confidence |
| Receiving → "Smart Receiving" | Full extraction-first flow — upload doc, create shipment from it |

### Extracted fields

| Field | Description |
|-------|-------------|
| Carrier | Carrier name |
| BOL / PRO # | Bill of lading or PRO number |
| Tracking # | Carrier tracking number |
| PO # | Purchase order number(s) |
| Shipper | Shipper name/address |
| Total Pieces | Total carton/piece count |
| Weight (lb) | Total shipment weight |
| Line items | SKU, description, quantity, UOM |

### Confidence indicators
- **Green (≥90%)** — high confidence, safe to apply
- **Yellow (70–89%)** — review recommended
- **Red (<70%)** — manual verification required

### Required env var
```
ANTHROPIC_API_KEY=sk-ant-...
```
Set in both the WMS container and `.env` file on the server.

### Key files

| File | Purpose |
|------|---------|
| `src/lib/integrations/docai.ts` | Claude Vision API integration |
| `src/modules/receiving/docai-actions.ts` | Server actions: processDocument, updateShipmentFromExtraction, finalizeShipmentPdf |
| `src/components/receiving/doc-scan-modal.tsx` | 4-stage modal: idle → upload → processing → review → done |
| `src/components/receiving/shipment-detail.tsx` | Receiving detail page with Scan Document button |

---

## Phase 3 — Shopify Real Order Sync

### What it does
Connects the WMS to a Shopify store for bidirectional order and inventory sync:
- Shopify orders → imported as WMS fulfillment orders
- WMS ships order → tracking number pushed back to Shopify
- WMS inventory → synced back to Shopify product availability

### Architecture

```
                    ┌─────────────────────────────┐
                    │         Shopify Store        │
                    │  ramola-dev.myshopify.com    │
                    └────────┬────────────┬────────┘
                             │            │
              Webhook (real-time)    REST API (pull)
              orders/create          GET /orders.json
              orders/cancelled       POST /fulfillments.json
              orders/updated         POST /inventory_levels/set.json
                             │            │
                    ┌────────▼────────────▼────────┐
                    │         Ramola WMS            │
                    │      wms.ramola.app           │
                    │                               │
                    │  /api/webhooks/shopify        │ ← real-time
                    │  /api/cron/shopify-sync       │ ← every 15 min
                    │  Orders page sync button      │ ← manual
                    └───────────────────────────────┘
```

### Shopify webhooks registered

Go to **Shopify Admin → Settings → Notifications → Webhooks** to manage:

| Topic | WMS endpoint | What it does |
|-------|-------------|-------------|
| `orders/create` | `/api/webhooks/shopify` | Import new unfulfilled order |
| `orders/cancelled` | `/api/webhooks/shopify` | Mark WMS order cancelled |
| `orders/updated` | `/api/webhooks/shopify` | Mark WMS order shipped if fulfilled externally |

Webhook signing secret is stored in `SHOPIFY_WEBHOOK_SECRET` env var. All requests are HMAC-SHA256 verified.

### Order import flow

1. Shopify order arrives via webhook or sync pull
2. Line item SKUs matched against WMS product catalog for the configured client
3. Orders with no matching SKUs are skipped (logged)
4. New WMS order created with status `pending`
5. Product records enriched with image URL, weight, vendor if currently blank

### Product enrichment

When a Shopify order is imported, the WMS automatically backfills product data:

| Shopify field | WMS product field | Condition |
|--------------|-------------------|-----------|
| Line item `grams` | `weight` (converted to lb) | Only if weight is blank |
| Product image URL | `imageUrl` | Only if imageUrl is blank |
| `vendor` | Available on line item | Informational |
| `variant_title` | Available on line item | e.g. "Large / Blue" |

### Fulfillment push

When `markShipmentShipped()` is called in `src/modules/shipping/actions.ts`:
1. Shipment and order status updated to `shipped`
2. If the order has a Shopify `externalId`, `pushShopifyFulfillment()` is called
3. Shopify fulfillment created with tracking number and carrier
4. Shopify sends shipping notification email to customer automatically

### Auto-sync (cron)

A Docker container (`shopify-cron`) runs `crond` and calls the sync endpoint every 15 minutes:

```
*/15 * * * * wget /api/cron/shopify-sync?secret=CRON_SECRET
```

The cron syncs orders from the last 24 hours. Webhooks handle real-time delivery; the cron is a safety net for missed webhook events.

### Manual sync

The **Orders** page has a "Sync Shopify" button (visible when `SHOPIFY_SHOP_DOMAIN` and `SHOPIFY_ACCESS_TOKEN` are set). It pulls orders from the last 7 days.

### Required env vars

```bash
# Shopify credentials
SHOPIFY_SHOP_DOMAIN=yourstore.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_...         # From Shopify Admin → Apps → Develop apps → API credentials
SHOPIFY_API_VERSION=2026-01
SHOPIFY_LOCATION_ID=                   # Optional — auto-detected if blank
SHOPIFY_WEBHOOK_SECRET=...             # From Shopify Admin → Settings → Notifications → Webhooks

# WMS routing
ARMSTRONG_TENANT_SLUG=armstrong        # Tenant slug for webhook receiver
SHOPIFY_WMS_CLIENT_CODE=Armstrong      # Client code to assign imported orders to
CRON_SECRET=...                        # Random secret for cron endpoint auth
```

### Key files

| File | Purpose |
|------|---------|
| `src/lib/integrations/marketplaces/shopify.ts` | Shopify Admin REST API adapter |
| `src/lib/integrations/marketplaces/types.ts` | Shared marketplace types |
| `src/modules/orders/shopify-sync.ts` | Server actions: syncShopifyOrders, pushShopifyFulfillment, syncInventoryToShopify |
| `src/app/api/webhooks/shopify/route.ts` | Webhook receiver with HMAC verification |
| `src/app/api/cron/shopify-sync/route.ts` | Cron endpoint for scheduled sync |
| `src/app/(tenant)/orders/_shopify-sync-button.tsx` | Manual sync button component |
| `src/modules/shipping/actions.ts` | markShipmentShipped() with Shopify tracking push |

---

## Production Infrastructure

### Server
- **Host:** Hetzner VPS (`ssh ramola`)
- **Stack:** Docker Compose at `/root/apps/wms/infra/docker-compose.prod.yml`
- **Env file:** `/root/apps/wms/infra/.env`

### Services

| Container | Purpose | Port |
|-----------|---------|------|
| `infra-wms-1` | Next.js WMS app | 3000 (internal) |
| `infra-docai-1` | DocAI service (separate repo) | 3002 (internal) |
| `infra-dispatch-1` | DispatchPro service | 3001 (internal) |
| `infra-postgres-1` | PostgreSQL database | 5432 (internal) |
| `infra-redis-1` | Redis cache | 6379 (internal) |
| `infra-minio-1` | MinIO object storage (S3-compatible) | 9000 (internal) |
| `infra-traefik-1` | Reverse proxy + TLS | 80, 443 |
| `infra-shopify-cron-1` | Shopify auto-sync cron | none |

### Deploy

```bash
ssh ramola
cd /root/apps/wms
git pull origin main
cd infra
docker compose -f docker-compose.prod.yml up -d --no-deps --build wms
```

### Tenant database schema
- Database: `ramola_wms`
- Armstrong tenant schema: `tenant_armstrong`
- Public schema: `public`
- Prisma schema files: `prisma/tenant-schema.prisma` (tenant) + `prisma/schema.prisma` (public)

---

## Pending (Phases 4 & 5)

### Phase 4 — Carrier APIs (blocked on credentials)

Mock implementations exist at:
- `src/lib/integrations/carriers/ups.ts`
- `src/lib/integrations/carriers/fedex.ts`
- `src/lib/integrations/carriers/usps.ts`

When sandbox credentials are available, register at:
- UPS: developer.ups.com
- FedEx: developer.fedex.com
- USPS: developer.usps.com

Required env vars (when ready):
```
UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_ACCOUNT_NUMBER
FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET, FEDEX_ACCOUNT_NUMBER
USPS_USER_ID
```

### Phase 5 — NetSuite Bridge (blocked on Armstrong credentials)

Stub implementation at `src/lib/integrations/netsuite/client.ts`.

Required env vars (when ready):
```
NETSUITE_ACCOUNT_ID
NETSUITE_CONSUMER_KEY, NETSUITE_CONSUMER_SECRET
NETSUITE_TOKEN_ID, NETSUITE_TOKEN_SECRET
```
