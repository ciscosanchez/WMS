# Session Summary — March 16, 2026

## What Was Built

In a single session, we built the entire **Ramola WMS** platform from scratch — a multi-tenant SaaS warehouse management system.

### By the Numbers

| Metric | Count |
|--------|-------|
| **Routes** | 56 |
| **Unit Tests** | 124 (11 suites, all passing) |
| **Apps** | 4 (WMS back-office, Operator, Client Portal, Superadmin Platform) |
| **Integration Adapters** | 8 (UPS, FedEx, USPS, Shopify, Amazon, NetSuite, DispatchPro, EDI) |
| **Documentation Files** | 10 |
| **Git Commits** | 20+ |
| **Lines of Code** | ~25,000+ |

### What's Working

- **Full WMS UI** — 56 routes across dashboard, receiving, fulfillment, inventory, warehouse, clients, products, picking, shipping, channels, reports, settings
- **Operator Mobile App** — 5 pages optimized for tablet/scanner with barcode scanning hook
- **Client Portal** — 6 pages for customer self-service (inventory, orders, shipments, billing, reports)
- **Superadmin Platform** — tenant management, billing overview for SaaS owner (Cisco)
- **Database** — PostgreSQL 16 running in Docker, Prisma schemas for public + tenant, seeded data
- **Authentication** — NextAuth.js with mock/real toggle, login page with demo mode
- **Multi-tenancy** — schema-per-tenant with LRU connection pool
- **Shopify Integration** — LIVE connection to ramola-dev.myshopify.com, pulling real products
- **All Quality Checks Passing** — TypeScript (0 errors), ESLint (0 warnings), Prettier (all clean), Jest (124 tests)
- **GitHub Actions CI** — runs on every push
- **Docker + AWS deployment ready** — Dockerfile, deployment guide, cost estimates

### Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Framework | Next.js 16 App Router | Server Components, Server Actions, modern React |
| Database | PostgreSQL 16 + Prisma | Reliable, schema-per-tenant, good tooling |
| Multi-tenancy | Schema-per-tenant | Strong data isolation without DB-per-tenant overhead |
| UI | shadcn/ui + Tailwind CSS v4 | Beautiful, customizable, consistent |
| Auth | NextAuth.js v5 (JWT) | Simple, extensible, supports multiple providers |
| Node Version | 22 (LTS) via fnm | Stable — Node 25 caused Prisma + ESLint issues |
| Prisma Connection | @prisma/adapter-pg | Bypasses native engine issues on newer Node versions |
| Docker Postgres Port | 5433 (not 5432) | Local Postgres was already on 5432 |
| Mock Data Toggle | USE_MOCK_DATA env var | Develop UI without DB, flip to real data when ready |
| Separate Repos | WMS + DocAI | Document Intelligence is a separate microservice |
| Brand | Ramola (company) / WMS (product) | Armstrong is first customer, not the platform owner |

## Learnings & Gotchas

### Node.js 25 is Too Bleeding Edge
- Prisma CLI refuses to connect to Postgres on Node 25 ("User was denied access")
- ESLint binary fails to load on Node 25
- **Fix:** Install Node 22 via `fnm` and use `.node-version` file
- **Lesson:** Always use LTS versions for production tools

### Local Postgres Port Conflict
- A local Postgres was running on port 5432, intercepting Docker connections
- Prisma and pg driver both connected to the wrong Postgres
- **Fix:** Changed Docker to port 5433
- **Lesson:** Always check `lsof -i :5432` before assuming Docker is receiving connections

### Prisma Driver Adapter Required
- Even after fixing the port, Prisma's native engine couldn't connect on Node 25
- The `@prisma/adapter-pg` bypasses the native engine entirely and uses the `pg` npm package
- **Fix:** Enable `driverAdapters` preview feature, use `PrismaPg` adapter
- **Lesson:** The adapter approach is actually better — more control, works everywhere

### shadcn/ui v4 Uses @base-ui, Not Radix
- New shadcn/ui components use `@base-ui/react` instead of `@radix-ui`
- `asChild` prop doesn't exist — use `render` prop instead
- Some components (Select, AlertDialogTrigger) have different APIs
- **Fix:** Custom Button with `@radix-ui/react-slot` for `asChild`, `render` prop for others
- **Lesson:** Check the actual component source, not the old docs

### Zod v4 + react-hook-form Type Incompatibility
- Zod v4's `z.coerce` and `.default()` create different input/output types
- `zodResolver` uses input types, `z.infer` gives output types
- **Fix:** Downgraded to Zod v3, used `z.input<typeof schema>` for form types
- **Lesson:** Zod v3 is more compatible with the react-hook-form ecosystem

### Shopify Dev Dashboard vs Legacy Custom Apps
- New Shopify apps use Dev Dashboard (CLI-based, embedded)
- For backend API integrations, the `client_credentials` grant type works
- Access tokens from client_credentials expire in 24 hours
- **Fix:** Use client_credentials for dev, implement proper OAuth for production
- **Lesson:** Shopify's auth landscape is fragmented — read current docs carefully

### ESLint Cleanup is a Big Job
- 126 issues across 31 files after building fast
- Most were unused imports and intentional `any` types
- Background agent took ~15 minutes to fix all of them
- **Lesson:** Run `npx eslint src/` periodically during development, not just at the end

## What's Next

### Immediate
1. Sign up for UPS + FedEx sandbox accounts (free)
2. Wire Shopify adapter to use real API calls instead of mock
3. End-to-end testing: create order in Shopify → import to WMS → pick → pack → ship
4. Create Document Intelligence repo (separate from WMS)

### Before Armstrong Demo
5. More seed data in Postgres (shipments, orders, inventory)
6. Real login flow tested against DB
7. Armstrong-specific branding in their tenant settings

### Before Production
8. Real carrier API credentials (UPS, FedEx production accounts)
9. NetSuite integration (need Armstrong's sandbox access)
10. Long-lived Shopify OAuth tokens (not client_credentials)
11. AWS deployment (RDS + App Runner)
12. Email notifications (SendGrid/SES)

## File Structure (Final)

```
wms/ (56 routes, 124 tests)
├── .github/workflows/ci.yml      # GitHub Actions
├── docker-compose.yml             # Postgres 16 (port 5433) + MinIO
├── Dockerfile                     # Multi-stage production build
├── prisma/
│   ├── schema.prisma              # Public (tenants, users, auth)
│   └── tenant-schema.prisma       # Tenant (all WMS tables + fulfillment)
├── src/
│   ├── app/
│   │   ├── (auth)/login/          # Login page with mock/real toggle
│   │   ├── (tenant)/              # 30+ WMS back-office pages
│   │   ├── (operator)/            # 5 mobile floor pages
│   │   ├── (portal)/portal/       # 6 customer portal pages
│   │   ├── (platform)/platform/   # 4 superadmin pages
│   │   └── api/                   # Auth + uploads routes
│   ├── lib/
│   │   ├── db/                    # Prisma clients (pg adapter)
│   │   ├── auth/                  # NextAuth, RBAC, session
│   │   ├── tenant/                # Multi-tenant resolution
│   │   ├── integrations/
│   │   │   ├── carriers/          # UPS, FedEx, USPS adapters + rate shop
│   │   │   ├── marketplaces/      # Shopify, Amazon adapters
│   │   │   ├── netsuite/          # NetSuite ERP client
│   │   │   └── edi/               # EDI 940/945/856/944 parser + generator
│   │   ├── security/              # Sanitize, rate limit
│   │   ├── export/                # CSV + PDF export
│   │   └── ...                    # Audit, sequences, barcode, S3, config
│   ├── modules/                   # Server actions (clients, products, receiving, inventory, warehouse)
│   ├── components/                # UI components (60+ files)
│   ├── hooks/                     # useBarcodeScanner, useMobile
│   └── providers/                 # Session, Query, Tenant
├── tests/unit/                    # 11 test suites, 124 tests
├── scripts/                       # Provision tenant, seed demo
└── docs/                          # 10 documentation files
```

---

# Session Summary — March 20, 2026

## What Was Done

Picked up from the security/data-integrity state (170 tests, Armstrong live). This session addressed a full production audit, operator feature requests from Armstrong, and deployment.

### Production Audit — All 6 Findings Fixed

| # | Finding | Fix |
|---|---------|-----|
| 1 | Single-tenant integrations | Crons/webhooks now iterate all active tenants via `tenant-connectors.ts`. Credentials from SalesChannel.config with env var fallback. |
| 2 | Portal client isolation | Removed `resolvePortalClient()` fallback to first client (fail-closed). Product ownership validated in `createPortalOrder()`. |
| 3 | Outbound doesn't consume inventory | `generatePickTasksForOrder()` allocates stock. `markShipmentShipped()` decrements onHand + releases allocation. Ledger entries for both. |
| 4 | Non-transactional mutations | Wrapped `moveInventory`, `approveAdjustment`, `receiveLine`, `finalizeReceiving`, `markShipmentShipped`, `generatePickTasksForOrder` in `$transaction()`. |
| 5 | RBAC inconsistency | Synced PERMISSION_LEVEL maps. Added 7 missing permissions. Unknown permissions default to admin-only (level 40). |
| 6 | API hardening | Sanitized all error responses. Wired rate limiter into uploads. |

### Tests: 170 → 292

5 new test suites covering the audit gaps:
- `inventory-integrity.test.ts` — transactional mutations, allocation/deallocation
- `portal-isolation.test.ts` — fail-closed client resolution, product ownership
- `multi-tenant-crons.test.ts` — tenant iteration for all 4 crons
- `rbac-consistency.test.ts` — all permissions enforced, unknown = admin-only
- `api-hardening.test.ts` — error sanitization, rate limiter

### Armstrong Feature Requests — 3 WMS Items Shipped

| # | Feature | Route |
|---|---------|-------|
| 9 | Operator daily dashboard | `/my-tasks` (operator), `/operations` (manager board) |
| 3a | Scan-out verification | Pick screen: product barcode scan, units-per-case display |
| 7 | Pick path optimization | Pick lines sorted by bin barcode; movement analytics in Reports |

### Infrastructure

- Deployed all changes to prod (Hetzner, Docker Compose)
- Migrated Shopify credentials from env vars into SalesChannel.config
- Added CRON_SECRET to WMS container (was missing)
- Ran schema migration for `units_per_case` and `case_barcode` on Armstrong
- Cleaned up stale presentation docs

### New Files Created

| File | Purpose |
|------|---------|
| `src/lib/integrations/tenant-connectors.ts` | Multi-tenant connector resolution helper |
| `src/modules/dashboard/operator-actions.ts` | `getMyTasksSummary()` for operator dashboard |
| `src/modules/dashboard/manager-actions.ts` | `getOperationsBoard()`, `assignTaskToOperator()` |
| `src/app/(operator)/my-tasks/page.tsx` | Operator daily task dashboard |
| `src/app/(tenant)/operations/page.tsx` | Manager operations board |
| `src/app/(tenant)/operations/assign-task-button.tsx` | Task assignment dropdown |
| `scripts/migrate-credentials.ts` | Move env var creds into DB |
| `prisma/tenant-migrations/0003_product_packaging.sql` | units_per_case + case_barcode |
| `docs/armstrong-feature-requests.md` | Feature request tracking (also in DispatchPro repo) |

### Learnings

1. **Turbopack rejects duplicate routes**: `/(operator)/dashboard` and `/(tenant)/dashboard` both resolve to `/dashboard`. Renamed to `/my-tasks`.
2. **Docker standalone builds strip scripts/**: Can't run `npx tsx scripts/...` inside the container. Ran migration via inline `node -e` or from the host with regenerated Prisma clients.
3. **CRON_SECRET was on the cron container but not WMS**: The WMS container needs it to validate incoming requests. Easy miss when env vars are split across services.
4. **Unknown permissions defaulting to level 0 is fail-open**: Changed `PERMISSION_LEVEL[p] ?? 0` to `?? 40` (admin-only) in both session.ts and context.ts.
5. **Credential migration path**: SalesChannel.config (JSON field) works well for per-tenant marketplace creds. Tenant.settings works for carrier/NetSuite creds. Env vars remain as fallback.

### Commits (this session)

| Hash | Message |
|------|---------|
| cb68592 | Fix all 6 production audit findings |
| 3dc80f1 | Add 122 tests, credential migration script, fail-closed unknown permissions |
| 28c03ca | Remove stale presentation docs |
| d212aee | Add CRON_SECRET to WMS container environment |
| d1f4789 | Add operator daily dashboard and manager operations board (#9) |
| 0f79dc7 | Rename operator dashboard route to /my-tasks |
| c15f16f | Add scan-out verification and units-per-case display (#3a) |
| 3240f00 | Add Armstrong feature request scope & status doc |
| a1a1b24 | Add pick path optimization, putaway suggestions, and movement analytics (#7) |
| 355f6a4 | Update Armstrong feature doc: all 3 WMS items shipped |
