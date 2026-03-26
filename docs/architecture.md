# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ramola WMS                             │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Next.js  │  │  Prisma  │  │ NextAuth │  │   MinIO/S3   │   │
│  │ App Router│  │   ORM    │  │   v5     │  │   Storage    │   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └──────┬───────┘   │
│        │              │              │               │           │
│  ┌─────┴──────────────┴──────────────┴───────────────┴─────┐   │
│  │                    Middleware Layer                       │   │
│  │          Tenant Resolution · Auth · RBAC                 │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────┴───────────────────────────────┐   │
│  │                     PostgreSQL 16                        │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌────────────┐  ┌────────────┐          │   │
│  │  │  public   │  │ tenant_acme│  │ tenant_demo│   ...    │   │
│  │  │  schema   │  │   schema   │  │   schema   │          │   │
│  │  └──────────┘  └────────────┘  └────────────┘          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Multi-Tenancy: Schema-per-Tenant

### Why schema-per-tenant?

| Approach                      | Isolation                    | Complexity | Cost    |
| ----------------------------- | ---------------------------- | ---------- | ------- |
| **Shared tables** (row-level) | Low — WHERE clause filtering | Low        | Lowest  |
| **Schema-per-tenant** ✅      | High — separate schemas      | Medium     | Medium  |
| **Database-per-tenant**       | Highest — separate DBs       | High       | Highest |

Schema-per-tenant gives us strong data isolation without the operational overhead of separate databases. Each tenant's data lives in its own PostgreSQL schema (e.g., `tenant_acme`), making it impossible for queries to accidentally leak across tenants.

### How it works

```
Request Flow:

  Browser ──→ Middleware ──→ Resolve Tenant ──→ Server Component
                  │                                    │
                  │  x-tenant-slug header (dev)        │
                  │  subdomain extraction (prod)       │
                  │                                    ▼
                  │                           Get tenant from DB
                  │                                    │
                  │                                    ▼
                  │                           LRU Connection Pool
                  │                           (max 50 clients)
                  │                                    │
                  │                                    ▼
                  └──────────────────────────→ PrismaClient(?schema=tenant_acme)
```

### Dual Prisma Clients

```
prisma/
├── schema.prisma           → @prisma/public-client  (tenants, users, auth)
└── tenant-schema.prisma    → @prisma/tenant-client  (all WMS tables)
```

The public client is a singleton. Tenant clients are pooled in an LRU cache keyed by schema name — when a request comes in for `tenant_acme`, we check the pool, create a new client if needed (evicting the oldest if at capacity), and return it.

### Tenant Provisioning

```
1. Create tenant record in public schema (status: provisioning)
2. CREATE SCHEMA IF NOT EXISTS "tenant_acme"
3. Run prisma db push against tenant schema
4. Seed default data (sequence counters, etc.)
5. Update tenant status to active
```

## Authentication & Authorization

### Auth Flow

- **NextAuth.js v5** with JWT strategy (no server-side sessions)
- **Credentials provider** — email/password with bcrypt
- JWT contains: user ID, email, name, superadmin flag, tenant list with roles and optional portal client bindings
- Tenant-specific role stored in `tenant_users` join table
- Portal scoping is stored as `tenant_users.portal_client_id`
- Product personas are derived at runtime, not persisted as extra enum roles

### RBAC Model

```
User ──M:N──→ TenantUser(role) ──M:1──→ Tenant

Roles: admin | manager | warehouse_worker | viewer

Derived product personas:
  superadmin
  tenant_admin
  tenant_manager
  warehouse_worker
  operator
  viewer
  portal_user

Permission check:
  requirePermission(tenantSlug, "inventory:write")
    → resolve tenant access
    → check role against permission map
    → throw if insufficient
```

Notes:

- `portal_user` is derived from tenant membership plus `portal_client_id`
- `operator` is derived from `warehouse_worker`
- middleware and layout routing shape the UX, but server-side context checks are the real enforcement boundary
- portal data access adds client scoping on top of role checks
- middleware applies persona-aware default routing:
  - superadmin -> `/platform`
  - portal user -> `/portal/inventory`
  - operator -> `/my-tasks`
  - other tenant users -> `/dashboard`

See [docs/rbac.md](rbac.md) for the current source-of-truth explanation.

## Data Architecture

### Dual-Mode Operations

```
                    ┌─────────────────────────┐
                    │      SHARED CORE        │
                    │                          │
                    │  Inventory  ·  Products  │
                    │  Warehouse  ·  Clients   │
                    │  Audit Log  ·  Sequences │
                    └────────┬────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                              │
     ┌────────┴────────┐         ┌──────────┴──────────┐
     │  FREIGHT / 3PL  │         │   DTC / FULFILLMENT │
     │                  │         │                      │
     │  Inbound ASNs    │         │  Orders              │
     │  BOL Processing  │         │  Sales Channels      │
     │  Container Recv  │         │  Pick Tasks          │
     │  Customs/HS      │         │  Packing             │
     │  Discrepancies   │         │  Outbound Shipments  │
     │  Inspections     │         │  Carrier Rate Shop   │
     └─────────────────┘         └──────────────────────┘
```

Both modes share the same inventory, warehouse, and client infrastructure. A single tenant can have both modes enabled simultaneously — e.g., receiving containers from overseas (freight) and shipping DTC orders from the same warehouse (fulfillment).

### Document Intelligence (AI-Powered OCR)

Paper BOLs, packing lists, and commercial invoices are the biggest bottleneck in warehouse receiving. Ramola uses AI vision (Claude API) to eliminate manual keying:

```
  Paper BOL / Packing List / Invoice
       │
       ▼
  ┌─ CAPTURE ──────┐     ┌─ EXTRACT ────────┐     ┌─ VERIFY ─────┐     ┌─ POST ──────┐
  │ Phone camera    │────►│ Claude Vision API│────►│ Side-by-side │────►│ Create ASN  │
  │ Scanner         │     │ Structured JSON  │     │ review UI    │     │ Add lines   │
  │ Email attach    │     │ + confidence     │     │ Fix low-conf │     │ Attach doc  │
  │ Upload          │     │ scores per field │     │ fields       │     │ Audit trail │
  └─────────────────┘     └──────────────────┘     └──────────────┘     └─────────────┘
```

Reduces BOL processing from 10-15 min manual keying to 1-2 min review. See [docs/document-intelligence.md](document-intelligence.md) for full design.

### Immutable Transaction Ledger

Every inventory change creates an `inventory_transaction` record:

```
Type       | From Bin | To Bin | Qty | Reference
───────────┼──────────┼────────┼─────┼──────────
receive    | null     | A-01   | 100 | ASN-2026-0001
putaway    | STAGING  | B-05   |  50 | -
move       | B-05     | C-01   |  25 | -
pick       | C-01     | null   |  10 | ORD-2026-0042
adjust     | null     | A-01   |  -2 | ADJ-2026-0003
```

The `inventory` table holds current state; the `inventory_transactions` table is the immutable ledger. Current state can always be rebuilt from the ledger.

## Request Lifecycle

```
1. Request hits Next.js middleware
2. Middleware resolves tenant slug (subdomain or header)
3. Middleware applies persona-aware route defaults
4. Server Component or Server Action executes
5. requireAuth() validates JWT session
6. requireTenantContext(permission?) or requirePortalContext() resolves membership and scope
7. resolveTenant() looks up tenant, gets pooled PrismaClient
8. Business logic executes against tenant schema
9. Audit log records the action
10. revalidatePath() busts cache for affected routes
11. Response returned to client
```

## Tech Decisions

| Decision                               | Rationale                                                    |
| -------------------------------------- | ------------------------------------------------------------ |
| **Server Components first**            | Minimize client JS, data fetched at the edge                 |
| **Server Actions** for mutations       | Type-safe, no API routes needed, auto-revalidation           |
| **URL state** for filters              | Shareable views, works with SSR                              |
| **Zod schemas** shared                 | Same validation on client and server                         |
| **Cursor pagination** for large tables | O(1) vs O(n) for inventory tables                            |
| **Pre-signed URL uploads**             | Client uploads directly to MinIO, server never buffers files |
| **JsBarcode (Code128)**                | Industry standard for warehouse bin labels                   |
