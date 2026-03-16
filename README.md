# Armstrong WMS

A modern, multi-tenant Warehouse Management System built for **Freight/3PL** and **DTC/E-Commerce Fulfillment** operations. Armstrong combines freight-native workflows (BOL processing, customs compliance, container receiving) with high-volume fulfillment capabilities (order management, wave picking, rate shopping) — in a single unified platform.

## Why Armstrong?

Most WMS platforms force you to choose: **Magaya** covers freight but not fulfillment. **Logiwa** covers DTC fulfillment but not freight. **NetSuite WMS** is an ERP add-on, not purpose-built for 3PL.

Armstrong gives you both — one inventory, one warehouse, two operational modes.

## Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Server Components, Server Actions) |
| **Database** | PostgreSQL 16 with Prisma ORM (dual schema: public + tenant) |
| **Auth** | NextAuth.js v5 with RBAC (admin, manager, warehouse_worker, viewer) |
| **UI** | shadcn/ui + Tailwind CSS v4 |
| **Tables** | TanStack Table |
| **Forms** | react-hook-form + Zod validation |
| **Storage** | MinIO (S3-compatible) for documents/photos |
| **Testing** | Jest + React Testing Library (unit) · Playwright (E2E) |
| **Deployment** | Docker Compose (PostgreSQL + MinIO + App) |

## Multi-Tenancy

Armstrong uses **schema-per-tenant** isolation — each tenant gets their own PostgreSQL schema with complete data separation at the database level.

- **Public schema**: tenants registry, users, auth sessions
- **Tenant schemas** (`tenant_acme`, `tenant_demo`, etc.): all WMS tables
- **Two Prisma clients**: `@prisma/public-client` + `@prisma/tenant-client`
- **LRU connection pool**: max 50 cached Prisma clients per schema

See [docs/architecture.md](docs/architecture.md) for details.

## Modules

### Inbound (Freight/3PL)
- Inbound shipments (ASN) with BOL, carrier, tracking
- Line-by-line receiving with condition inspection
- Lot and serial number tracking
- Receiving discrepancy management (shortage/overage/damage)
- Document uploads (BOLs, packing lists, photos)

### Fulfillment (DTC/E-Commerce)
- Multi-channel order management (Shopify, Amazon, Walmart, API)
- Single, batch, wave, and zone picking
- Packing and outbound shipment management
- Multi-carrier rate shopping and label generation
- Sales channel configuration

### Inventory (Shared)
- Real-time stock browser across all locations
- Immutable transaction ledger (receive, putaway, move, adjust, pick)
- Putaway rules engine
- Inventory adjustments with approval workflow
- Cycle count plans (ABC, zone, full, random)

### Warehouse
- Hierarchical location management: Warehouse → Zone → Aisle → Rack → Shelf → Bin
- Bulk location generator wizard
- Bin barcode generation (Code128)

### Setup
- Client management (cargo owners / 3PL model)
- Product catalog with dimensions, UOM conversions, HS codes
- Sales channel connections

## Quick Start

### Prerequisites
- Node.js 20+ (22 recommended)
- Docker & Docker Compose
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/ciscosanchez/WMS.git
cd WMS

# Install dependencies
npm install

# Start PostgreSQL + MinIO
docker compose up -d

# Generate Prisma clients
npm run db:generate

# Push public schema to database
npm run db:push

# Seed demo data (admin user + demo tenant + sample data)
npm run db:seed

# Start dev server
npm run dev
```

Open **http://localhost:3000** and log in with:
- Email: `admin@armstrong.dev`
- Password: `admin123`

### Dev Mode (No Database)
The app currently runs with mock data — no database required. Just:
```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run unit tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run validate` | Run all checks (typecheck + lint + format + test) |
| `npm run db:generate` | Generate both Prisma clients |
| `npm run db:push` | Push public schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:provision` | Provision a new tenant |

## Project Structure

```
wms/
├── docker-compose.yml
├── prisma/
│   ├── schema.prisma           # Public schema (tenants, users, auth)
│   └── tenant-schema.prisma    # Tenant schema (all WMS tables)
├── src/
│   ├── app/(tenant)/           # All WMS pages
│   │   ├── dashboard/          # KPIs and recent activity
│   │   ├── receiving/          # Inbound shipments (freight)
│   │   ├── orders/             # Fulfillment orders (DTC)
│   │   ├── picking/            # Pick task management
│   │   ├── shipping/           # Outbound shipments
│   │   ├── inventory/          # Stock, movements, adjustments
│   │   ├── warehouse/          # Location management
│   │   ├── clients/            # Cargo owner management
│   │   ├── products/           # SKU catalog
│   │   └── channels/           # Sales channel config
│   ├── lib/                    # Infrastructure (db, auth, audit, etc.)
│   ├── modules/                # Domain logic (actions, schemas)
│   └── components/             # UI components
├── scripts/                    # Provisioning, seeding
├── tests/                      # Unit, integration, E2E tests
└── docs/                       # Architecture documentation
```

## RBAC

| Role | Access |
|------|--------|
| **admin** | Full access to everything |
| **manager** | All operations + approve adjustments + read settings |
| **warehouse_worker** | Receive, inspect, move, pick, count — no master data |
| **viewer** | Read-only across all modules |

## Documentation

- [Architecture](docs/architecture.md) — System design, multi-tenancy, auth, dual-mode operations
- [Data Model](docs/data-model.md) — Full ER diagrams for all schemas
- [Ecosystem](docs/ecosystem.md) — All Armstrong systems and how they connect
- [Identification to Cash](docs/flow-identification-to-cash.md) — Complete user flow from lead gen to revenue collection
- [Receiving Flow](docs/flow-receiving.md) — Freight/3PL inbound workflow
- [Fulfillment Flow](docs/flow-fulfillment.md) — DTC/e-commerce order-to-ship workflow
- [Competitive Analysis](docs/competitive-analysis.md) — Armstrong vs Logiwa, NetSuite, Magaya, Extensiv

## Roadmap

- [x] Phase 0 — Bootstrap (Next.js, Prisma, auth, layout, RBAC)
- [x] Phase 1 — Core entities (clients, products, warehouse, locations)
- [x] Phase 2 — Receiving module (ASN, line receiving, discrepancies)
- [x] Phase 3 — Inventory module (stock browser, movements, adjustments)
- [x] Phase 4 — Fulfillment module (orders, picking, packing, shipping)
- [ ] Phase 5 — Dashboard KPIs, global search, notifications
- [ ] Phase 6 — Connect to real database, wire up server actions
- [ ] Phase 7 — Integration tests, E2E tests, security hardening
- [ ] Future — Billing, customs/compliance, cross-docking, returns, mobile app, EDI

## License

Proprietary — Armstrong Logistics Technology
