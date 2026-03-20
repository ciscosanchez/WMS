# Ramola WMS

A modern, multi-tenant Warehouse Management System built for **Freight/3PL** and **DTC/E-Commerce Fulfillment** operations. Ramola WMS combines freight-native workflows (BOL processing, container receiving, discrepancy management) with high-volume fulfillment capabilities (order management, wave picking, multi-carrier rate shopping) — in a single unified platform.

**Built by Ramola. Powered by your warehouse.**

## Why Ramola?

Most WMS platforms force you to choose: **Magaya** covers freight but not fulfillment. **Logiwa** covers DTC fulfillment but not freight. **NetSuite WMS** is an ERP add-on, not purpose-built for 3PL.

Ramola gives you both — one inventory, one warehouse, two operational modes.

## Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js (App Router, Server Components, Server Actions) |
| **Database** | PostgreSQL 16 with Prisma ORM (dual schema: public + tenant) |
| **Auth** | NextAuth.js v5 — JWT sessions, bcrypt passwords, RBAC |
| **UI** | shadcn/ui + Tailwind CSS v4 |
| **Storage** | MinIO (S3-compatible) for documents, labels, photos |
| **Cache/Queue** | Redis |
| **AI** | Claude Vision API (DocAI) for BOL/packing list OCR |
| **Testing** | Jest (292 unit tests) · Playwright (E2E) |
| **Deployment** | Docker Compose — Traefik + PostgreSQL + Redis + MinIO + App |

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

### Billing
- Per-client rate cards (receiving, storage, pick/pack, shipping, value-add)
- Immutable billing event ledger — captured at every warehouse action
- Invoice generation with line-item breakdown
- Client portal billing view
- Daily storage snapshot cron (2 AM)

### Inventory (Shared)
- Real-time stock browser across all locations
- Immutable transaction ledger (receive, putaway, move, adjust, pick)
- Inventory adjustments with manager approval workflow
- Cycle count plans (ABC, zone, full, random)

### Warehouse
- Hierarchical location management: Warehouse → Zone → Aisle → Rack → Shelf → Bin
- Bulk location generator wizard
- Bin barcode generation (Code128)

### Operator App (Mobile PWA)
- Daily task dashboard (`/my-tasks`) — assigned tasks grouped by type, progress tracking
- Pick with barcode verification (bin OR product scan), pick path optimization (sorted by bin location)
- Pack with item-by-item scan verification
- Move, cycle count from a phone or tablet
- Barcode scanner integration
- Units-per-case display for clear carton vs unit guidance

### Client Portal
- Clients view their own orders, inventory, shipments, and invoices
- Read-only access scoped to their data

### Operations Board (Manager)
- Real-time operator workload visibility (`/operations`)
- Task assignment — assign pending pick tasks to operators
- KPIs: completed today, avg completion time, pending tasks, active receiving
- Movement analytics in Reports tab — moves/day, operator travel patterns, repeat trip detection

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

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✓ | Public schema Postgres URL |
| `WMS_DATABASE_URL` | ✓ | Tenant schema Postgres URL |
| `REDIS_URL` | ✓ | Redis connection URL |
| `AUTH_SECRET` | ✓ | NextAuth JWT signing secret |
| `CRON_SECRET` | ✓ | Shared secret for cron endpoints (fail-closed if unset) |
| `DOCAI_API_KEY` | ✓ | DocAI service API key |
| `ANTHROPIC_API_KEY` | ✓ | Claude API key (for DocAI OCR) |
| `MINIO_ROOT_USER` | ✓ | MinIO access key |
| `MINIO_ROOT_PASSWORD` | ✓ | MinIO secret key |
| `SHOPIFY_SHOP_DOMAIN` | optional | Enables Shopify order sync |
| `SHOPIFY_ACCESS_TOKEN` | optional | Shopify Admin API token |
| `SHOPIFY_WEBHOOK_SECRET` | optional | Shopify webhook HMAC secret (fail-closed if unset) |
| `AMAZON_CLIENT_ID` | optional | Amazon SP-API client ID |
| `AMAZON_REFRESH_TOKEN` | optional | Amazon SP-API refresh token |
| `UPS_CLIENT_ID` / `UPS_CLIENT_SECRET` | optional | UPS OAuth credentials |
| `FEDEX_CLIENT_ID` / `FEDEX_CLIENT_SECRET` | optional | FedEx OAuth credentials |
| `USPS_CLIENT_ID` / `USPS_CLIENT_SECRET` | optional | USPS OAuth credentials |
| `NETSUITE_ACCOUNT_ID` | optional | Enables NetSuite TBA sync |

See `infra/.env.prod.example` for the full list.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (292 tests) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run validate` | typecheck + lint + format + test |
| `npm run db:generate` | Generate both Prisma clients |
| `npm run db:push` | Push public schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:provision` | Provision a new tenant |

## RBAC

| Role | Level | Access |
|------|-------|--------|
| **admin** | 40 | Full access — clients, settings, user management |
| **manager** | 30 | All operations + approve inventory adjustments |
| **warehouse_worker** | 20 | Receive, move, pick, pack, count — no master data writes |
| **viewer** | 10 | Read-only across all modules |

Permissions are enforced on every server action write path via `requireTenantContext("module:write")`. Superadmins bypass tenant-level checks.

## Security

- **Auth**: fail-closed — `USE_MOCK_AUTH=true` required to bypass (never set in prod)
- **RBAC**: enforced on all write server actions
- **Cron endpoints**: return 401 if `CRON_SECRET` is unset or wrong
- **Shopify webhook**: HMAC-SHA256 verified; returns 401 if `SHOPIFY_WEBHOOK_SECRET` is unset
- **Amazon webhook**: RSA-SHA1 SNS signature verified; `SubscribeURL` validated against `sns.*.amazonaws.com` before fetch (SSRF guard)
- **Upload API**: entity ownership validated against tenant DB before presigned URL is issued
- **Platform routes**: superadmin JWT check in middleware (Edge-safe, no DB call)
- **Rate limiting**: In-memory rate limiter wired into upload endpoint (429 + Retry-After)
- **Error sanitization**: All API routes return generic error messages; internal details logged server-side only
- **Unknown permissions**: Default to admin-only (level 40), fail-closed for any permission not in the map

## Cron Jobs

Scheduled inside a Docker Alpine container via `crond`:

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| Every 15 min | `/api/cron/shopify-sync` | Pull new Shopify orders |
| Hourly | `/api/cron/tracking-update` | Check carrier tracking, mark delivered |
| 2 AM daily | `/api/cron/storage-billing` | Capture storage billing events |
| 3 AM daily | `/api/cron/netsuite-sync` | Push billing events + fulfillments to NetSuite |

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
- [x] Security hardening (RBAC, fail-closed auth, webhook verification, 292 tests)
- [x] Production audit: transactional inventory, multi-tenant integrations, portal isolation, RBAC consistency, API hardening
- [x] Operator features: daily task dashboard, scan-out verification, pick path optimization, movement analytics
- [ ] Carrier sandbox credentials (UPS/FedEx/USPS developer portals)
- [ ] NetSuite credentials from Armstrong
- [ ] Email notifications (shipment updates, invoice delivery)

## License

Proprietary — Ramola
