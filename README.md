# Ramola WMS

A modern, multi-tenant Warehouse Management System built for **Freight/3PL** and **DTC/E-Commerce Fulfillment** operations. Ramola WMS combines freight-native workflows (BOL processing, container receiving, discrepancy management) with high-volume fulfillment capabilities (order management, wave picking, multi-carrier rate shopping) — in a single unified platform.

**Built by Ramola. Powered by your warehouse.**

## Why Ramola?

Most WMS platforms force you to choose: **Magaya** covers freight but not fulfillment. **Logiwa** covers DTC fulfillment but not freight. **NetSuite WMS** is an ERP add-on, not purpose-built for 3PL.

Ramola gives you both — one inventory, one warehouse, two operational modes.

## Stack

| Layer           | Technology                                                   |
| --------------- | ------------------------------------------------------------ |
| **Framework**   | Next.js (App Router, Server Components, Server Actions)      |
| **Database**    | PostgreSQL 16 with Prisma ORM (dual schema: public + tenant) |
| **Auth**        | NextAuth.js v5 — JWT sessions, bcrypt passwords, RBAC        |
| **UI**          | shadcn/ui + Tailwind CSS v4                                  |
| **Storage**     | MinIO (S3-compatible) for documents, labels, photos          |
| **Cache/Queue** | Redis                                                        |
| **AI**          | Claude Vision API (DocAI) for BOL/packing list OCR           |
| **Testing**     | Jest (560 unit tests) · Playwright (E2E)                     |
| **Deployment**  | Docker Compose — Traefik + PostgreSQL + Redis + MinIO + App  |

## Multi-Tenancy

Schema-per-tenant isolation — each tenant gets their own PostgreSQL schema with complete data separation at the database level.

- **Public schema**: tenants registry, users, auth sessions
- **Tenant schemas** (`armstrong`, etc.): all WMS tables
- **Two Prisma clients**: `@prisma/public-client` + `@prisma/tenant-client`

## Modules

### Inbound (Freight/3PL)

- Inbound shipments (ASN) with BOL, carrier, tracking
- Line-by-line receiving with condition inspection and lot/serial tracking
- Receiving discrepancy management (shortage/overage/damage)
- Document uploads (BOLs, packing lists, photos)
- **DocAI** — Claude Vision OCR to auto-extract fields from BOL/packing list images

### Fulfillment (DTC/E-Commerce)

- Multi-channel order management (Shopify, Amazon, manual)
- Single, batch, wave, and zone picking
- Packing and outbound shipment management
- Multi-carrier rate shopping (UPS, FedEx, USPS) and label generation
- Labels stored in MinIO; presigned URLs for download/reprint
- Shopify: live order sync, inventory push, fulfillment webhook
- Amazon: SP-API inventory sync, ORDER_CHANGE webhook

### Yard & Dock Scheduling

- Dock door management (inbound/outbound/both types, status tracking)
- Yard spot tracking with visual grid map (color-coded occupancy)
- Dock appointment scheduling with overlap prevention
- Gantt-style dock calendar view
- Driver check-in kiosk (large touch-friendly UI)
- Yard visit lifecycle: arrive → park → move to dock → depart
- Full appointment state machine (scheduled → confirmed → checked_in → at_dock → loading/unloading → completed)

### Labor Management

- Operator shift tracking (clock-in/clock-out with hourly rate snapshots)
- Automatic task time logging hooked into pick/pack workflows
- Productivity dashboard: UPH, tasks/hour, operator leaderboard
- Cost-per-unit calculations with proportional per-client allocation
- 3PL labor billing integration (labor_hour, labor_unit billing types)
- Break time tracking
- Shift history and cost reports by client/period

### Returns / RMA

- Return authorization lifecycle (requested → approved → in_transit → received → inspecting → dispositioned → completed)
- Line-by-line return receiving with condition inspection
- Operator inspection + disposition workflow (restock/quarantine/dispose/repair)
- Inventory re-entry for restocked items with ledger entries
- Returns processing billing
- Client portal return requests (portalClientId scoped)

### Cartonization & Manifesting

- Carton type catalog (dimensions, weight limits, tare weight, material cost)
- First-Fit Decreasing bin-packing algorithm for auto-cartonization
- Pack plan persistence (which items in which carton)
- LTL shipment fields (manifest URL, BOL number, freight class)

### Slotting Optimization

- ABC velocity analysis from pick history (configurable thresholds)
- Multi-factor slot scoring: velocity (50%), weight (25%), ergonomics (25%)
- Async BullMQ analysis jobs for large datasets
- Recommendation accept/reject workflow with bulk actions
- Execute re-slot creates inventory move tasks automatically
- Per-warehouse configuration (thresholds, lookback, weight penalty)

### Task Interleaving

- Combines pick + putaway + replenishment into single warehouse trips
- Route builder sorts all task steps by bin barcode (zone-aisle-rack walk order)
- Step-by-step operator UI with progress tracking
- Delegates to existing confirmPickLine/confirmPutaway on completion
- Labor time tracking integration

### VAS / Kitting

- Kit definitions (BOM-style: Kit SKU = N × Component SKUs)
- VAS task types: assembly, labeling, bundling, custom
- Kit component management with product linking

### Cross-Dock Orchestration

- Rule-based matching (by client and/or product)
- Cross-dock plan linking inbound shipments to outbound orders
- Status lifecycle with dock door assignment
- Skip putaway for cross-dock items

### Advanced Analytics

- Throughput trends (daily received/shipped units)
- SLA compliance (on-time shipping percentage)
- Exception heatmap (discrepancies, short picks by day)
- Top products by pick volume
- Warehouse utilization by zone
- Order velocity (avg time to ship)

### Compliance & Customs

- Compliance checks (HS code, hazmat, restricted, sanctions screening)
- Hazmat flags on products (UN number, hazard class, packing group)
- Resolution workflow (pending → cleared/flagged/blocked)

### Automation & Robotics

- Device registry (AMR, conveyor, pick-to-light, put-to-light, sortation)
- Device status monitoring (online/offline/error/maintenance)
- Task queue for device dispatch
- Zone-based device assignment

### Billing

- Per-client rate cards (receiving, storage, pick/pack, shipping, value-add, labor, returns)
- Immutable billing event ledger — captured at every warehouse action
- Invoice generation with line-item breakdown
- Client portal billing view
- Daily storage snapshot cron (2 AM)
- Labor hour/unit billing with proportional client allocation
- Returns processing billing
- Shipping carton billing

### Inventory (Shared)

- Real-time stock browser across all locations
- Immutable transaction ledger (receive, putaway, move, adjust, pick, return_receive, return_dispose)
- Inventory adjustments with manager approval workflow
- Cycle count plans (ABC, zone, full, random)
- Putaway engine with rule-based bin suggestions

### Warehouse

- Hierarchical location management: Warehouse → Zone → Aisle → Rack → Shelf → Bin
- Bulk location generator wizard
- Bin barcode generation (Code128)
- Interleaving toggle per warehouse

### Operator App (Mobile PWA)

- Daily task dashboard (`/my-tasks`) — assigned tasks grouped by type, progress tracking
- Pick with barcode verification (bin OR product scan), pick path optimization (sorted by bin location)
- Pack with item-by-item scan verification
- Move, cycle count from a phone or tablet
- Barcode scanner integration
- Units-per-case display for clear carton vs unit guidance
- Clock-in/clock-out shift management
- Interleaved route execution (combined pick/putaway trips)
- Returns inspection + disposition workflow

### Client Portal

- Clients view their own orders, inventory, shipments, and invoices
- Portal-scoped data isolation via portalClientId in JWT
- Return authorization requests

### Operations Board (Manager)

- Real-time operator workload visibility (`/operations`)
- Task assignment — assign pending pick tasks to operators
- KPIs: completed today, avg completion time, pending tasks, active receiving
- Movement analytics in Reports tab

### Platform Admin

- Superadmin tenant provisioning and user management

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### Setup

```bash
git clone https://github.com/ciscosanchez/WMS.git
cd WMS
npm install

# Copy env and fill in values
cp infra/.env.prod.example .env.local

# Start PostgreSQL + Redis + MinIO
docker compose up -d

# Generate Prisma clients and push schema
npm run db:generate
npm run db:push

# Seed demo data (creates admin user + demo tenant + sample data)
npm run db:seed

# Start dev server
npm run dev
```

Open **http://localhost:3000** — log in with:

- Email: `admin@ramola.io`
- Password: `admin123`

### Mock Mode (optional, dev only)

To run without a database, set in `.env.local`:

```
USE_MOCK_DATA=true
USE_MOCK_AUTH=true
```

Both default to **off** — mock mode must be explicitly opted into. It is never active in production.

### Playwright Persona Fixture

Playwright E2E now supports mock-auth personas through [tests/e2e/auth.setup.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/e2e/auth.setup.ts) when `USE_MOCK_AUTH=true`.

- default persona: tenant admin
- supported personas: `superadmin`, `admin`, `manager`, `operator`, `viewer`, `portal`
- tenant resolution stays cookie/header-based in local test mode

This fixture is intended to cover persona-aware routing and shell behavior without requiring real Auth.js sign-in during browser tests. It still expects a reachable local database for pages that query tenant data.

## Environment Variables

| Variable                                  | Required | Description                                             |
| ----------------------------------------- | -------- | ------------------------------------------------------- |
| `DATABASE_URL`                            | ✓        | Public schema Postgres URL                              |
| `WMS_DATABASE_URL`                        | ✓        | Tenant schema Postgres URL                              |
| `REDIS_URL`                               | ✓        | Redis connection URL                                    |
| `AUTH_SECRET`                             | ✓        | NextAuth JWT signing secret                             |
| `CRON_SECRET`                             | ✓        | Shared secret for cron endpoints (fail-closed if unset) |
| `DOCAI_API_KEY`                           | ✓        | DocAI service API key                                   |
| `ANTHROPIC_API_KEY`                       | ✓        | Claude API key (for DocAI OCR)                          |
| `MINIO_ROOT_USER`                         | ✓        | MinIO access key                                        |
| `MINIO_ROOT_PASSWORD`                     | ✓        | MinIO secret key                                        |
| `SHOPIFY_SHOP_DOMAIN`                     | optional | Enables Shopify order sync                              |
| `SHOPIFY_ACCESS_TOKEN`                    | optional | Shopify Admin API token                                 |
| `SHOPIFY_WEBHOOK_SECRET`                  | optional | Shopify webhook HMAC secret (fail-closed if unset)      |
| `AMAZON_CLIENT_ID`                        | optional | Amazon SP-API client ID                                 |
| `AMAZON_REFRESH_TOKEN`                    | optional | Amazon SP-API refresh token                             |
| `UPS_CLIENT_ID` / `UPS_CLIENT_SECRET`     | optional | UPS OAuth credentials                                   |
| `FEDEX_CLIENT_ID` / `FEDEX_CLIENT_SECRET` | optional | FedEx OAuth credentials                                 |
| `USPS_CLIENT_ID` / `USPS_CLIENT_SECRET`   | optional | USPS OAuth credentials                                  |
| `NETSUITE_ACCOUNT_ID`                     | optional | Enables NetSuite TBA sync                               |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`   | optional | Sentry error tracking DSN                               |
| `SECRETS_KEY`                             | ✓ (prod) | 64-char hex key for AES-256-GCM secret encryption       |

See `infra/.env.prod.example` for the full list.

## Scripts

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Start development server         |
| `npm run build`         | Production build                 |
| `npm run typecheck`     | TypeScript type checking         |
| `npm run lint`          | Run ESLint                       |
| `npm run test`          | Run unit tests (560 tests)       |
| `npm run test:coverage` | Run tests with coverage report   |
| `npm run test:e2e`      | Run Playwright E2E tests         |
| `npm run validate`      | typecheck + lint + format + test |
| `npm run db:generate`   | Generate both Prisma clients     |
| `npm run db:push`       | Push public schema to database   |
| `npm run db:seed`       | Seed demo data                   |
| `npm run db:provision`  | Provision a new tenant           |

## RBAC

| Role                 | Level | Access                                                   |
| -------------------- | ----- | -------------------------------------------------------- |
| **admin**            | 40    | Full access — clients, settings, user management         |
| **manager**          | 30    | All operations + approve inventory adjustments           |
| **warehouse_worker** | 20    | Receive, move, pick, pack, count — no master data writes |
| **viewer**           | 10    | Read-only across all modules                             |

Permissions are enforced on every server action write path via `requireTenantContext("module:write")`. Superadmins bypass tenant-level checks.

## Security

- **Auth**: fail-closed — `USE_MOCK_AUTH=true` required to bypass (never set in prod)
- **RBAC**: single source of truth in `rbac.ts`, enforced on all write server actions
- **CSP**: nonce-based Content-Security-Policy in production (unsafe-eval only in dev)
- **HSTS**: Strict-Transport-Security with 2-year max-age and preload
- **Portal isolation**: portalClientId in JWT, no email-based fallback, upload API scopes by client
- **Tenant layouts**: enforce membership (not just auth) at the layout level
- **Operator layout**: requires `operator:write` permission
- **Cron endpoints**: return 401 if `CRON_SECRET` is unset or wrong
- **Shopify webhook**: HMAC-SHA256 verified; returns 401 if `SHOPIFY_WEBHOOK_SECRET` is unset
- **Amazon webhook**: RSA-SHA1 SNS signature verified; `SubscribeURL` validated against `sns.*.amazonaws.com` before fetch (SSRF guard)
- **Upload API**: entity ownership validated against tenant DB; portal users scoped to their client's entities
- **Channel secrets**: encrypted at rest (AES-256-GCM) alongside carrier secrets
- **Sentry DSN**: moved to env var (not hardcoded in source)
- **Platform routes**: superadmin JWT check in middleware (Edge-safe, no DB call)
- **Rate limiting**: In-memory rate limiter wired into upload endpoint (429 + Retry-After)
- **Ship idempotency**: shipped-status guard prevents double-decrement on retry
- **Pack idempotency**: duplicate check inside transaction, billing inside tx
- **Unknown permissions**: Default to admin-only (level 40), fail-closed for any permission not in the map

## Cron Jobs

Scheduled inside a Docker Alpine container via `crond`:

| Schedule     | Endpoint                    | Purpose                                        |
| ------------ | --------------------------- | ---------------------------------------------- |
| Every 15 min | `/api/cron/shopify-sync`    | Pull new Shopify orders                        |
| Hourly       | `/api/cron/tracking-update` | Check carrier tracking, mark delivered         |
| 2 AM daily   | `/api/cron/storage-billing` | Capture storage billing events                 |
| 3 AM daily   | `/api/cron/netsuite-sync`   | Push billing events + fulfillments to NetSuite |

All cron jobs iterate every active tenant (multi-tenant). Credentials are read from SalesChannel.config per-tenant, with env var fallback for backward compatibility.

## Deployment

Production runs on a single Hetzner CPX21 via Docker Compose with Traefik handling TLS termination (Let's Encrypt). See `infra/docker-compose.prod.yml`.

```bash
# Build and deploy the WMS container
docker compose -f infra/docker-compose.prod.yml build wms
docker compose -f infra/docker-compose.prod.yml up -d wms cron
```

## Project Structure

```
wms/
├── infra/
│   ├── docker-compose.prod.yml  # Production stack
│   └── .env.prod.example        # All env vars documented
├── prisma/
│   ├── schema.prisma            # Public schema (tenants, users, auth)
│   └── tenant-schema.prisma     # Tenant schema (all WMS tables)
├── src/
│   ├── app/
│   │   ├── (auth)/              # Login page
│   │   ├── (tenant)/            # WMS pages (dashboard, orders, etc.)
│   │   ├── (portal)/            # Client portal
│   │   ├── (platform)/          # Superadmin platform
│   │   ├── (operator)/          # Mobile operator app
│   │   └── api/
│   │       ├── cron/            # Cron job endpoints
│   │       └── webhooks/        # Shopify + Amazon webhooks
│   ├── lib/
│   │   ├── auth/                # NextAuth config, session, RBAC
│   │   ├── integrations/        # Carriers, Shopify, Amazon, NetSuite
│   │   ├── tenant/              # Multi-tenancy context + middleware
│   │   └── s3/                  # MinIO client
│   ├── modules/                 # Domain logic (server actions, schemas)
│   └── components/              # UI components
├── tests/
│   ├── unit/                    # Jest unit tests
│   └── e2e/                     # Playwright E2E tests
└── docs/                        # Architecture + flow documentation
```

## Roadmap

### Completed

- [x] Core entities (clients, products, warehouse, locations)
- [x] Receiving module (ASN, line receiving, discrepancies, DocAI OCR)
- [x] Inventory module (stock, movements, adjustments, cycle counts)
- [x] Fulfillment module (orders, picking, packing, shipping)
- [x] Billing engine (rate cards, event ledger, invoice generation)
- [x] Carrier integrations (UPS, FedEx, USPS — rate shop + label generation)
- [x] Shopify (live order sync + inventory push + fulfillment webhook)
- [x] Amazon (SP-API inventory sync + ORDER_CHANGE webhook)
- [x] NetSuite TBA OAuth client (active once credentials provided)
- [x] Operator app (mobile PWA), Client portal, Superadmin platform
- [x] Security hardening (RBAC, fail-closed auth, webhook verification, 560 tests)
- [x] Production audit: data boundaries, inventory integrity, pack idempotency, unified RBAC, CSP/HSTS
- [x] Yard & Dock scheduling (dock doors, appointments, yard map, driver check-in, Gantt calendar)
- [x] Labor management (shifts, task time logging, productivity dashboard, cost reports, billing)
- [x] Returns / RMA (authorization lifecycle, inspection, disposition, inventory re-entry)
- [x] Cartonization & manifesting (carton catalog, FFD bin-packing, pack plans)
- [x] Slotting optimization (ABC analysis, multi-factor scoring, async BullMQ jobs)
- [x] Task interleaving (combined pick/putaway/replenish routes)
- [x] VAS / Kitting (kit definitions, BOM components, VAS tasks)
- [x] Cross-dock orchestration (rule-based matching, inbound-to-outbound bypass)
- [x] Advanced analytics (throughput, SLA compliance, exceptions, utilization)
- [x] Compliance & customs (HS code validation, hazmat flags, screening workflow)
- [x] Automation & robotics coordination (device registry, task queue, status monitoring)

### Pending

- [ ] Carrier sandbox credentials (UPS/FedEx/USPS developer portals)
- [ ] NetSuite credentials from Armstrong
- [ ] Run tenant DB migrations on production (0004-0013)
- [ ] Manifest PDF generation (pdf-lib integration)
- [ ] WebSocket/MQTT for real-time automation device communication

## License

Proprietary — Ramola
