# Changelog

All notable changes to Ramola WMS.

## 2026-03-20 — Production Audit + Armstrong Features

### Security & Data Integrity
- **Transactional inventory**: All stock mutations (`moveInventory`, `approveAdjustment`, `receiveLine`, `finalizeReceiving`, `markShipmentShipped`, `generatePickTasksForOrder`) wrapped in `$transaction()` with in-tx re-validation
- **Outbound stock consumption**: Pick tasks allocate inventory (allocated++, available--); shipping decrements onHand and releases allocation; ledger entries for both events
- **Multi-tenant integrations**: All 4 crons and 2 webhooks now iterate every active tenant. Credentials read from `SalesChannel.config` per-tenant, env var fallback for backward compat. New helper: `src/lib/integrations/tenant-connectors.ts`
- **Portal client isolation**: Removed `resolvePortalClient()` fallback to first client (fail-closed). Product ownership validated in `createPortalOrder()`
- **RBAC consistency**: Synced `PERMISSION_LEVEL` maps in `session.ts` and `context.ts`. Added 7 missing permissions (`receiving:complete`, `inventory:approve`, `inventory:count`, `reports:read`, `settings:read`, `users:read`, `users:write`). Unknown permissions now default to admin-only (level 40)
- **API hardening**: All API error responses sanitized (log internally, return generic message). Rate limiter wired into upload endpoint with 429 + Retry-After
- **CRON_SECRET**: Added to WMS container environment in docker-compose.prod.yml (was only on cron service)

### Tests (170 → 292)
- `inventory-integrity.test.ts` — 24 tests: transactional mutations, allocation/deallocation lifecycle
- `portal-isolation.test.ts` — 11 tests: fail-closed client resolution, product ownership validation
- `multi-tenant-crons.test.ts` — 4 tests: multi-tenant iteration for shopify, billing, tracking, netsuite
- `rbac-consistency.test.ts` — 79 tests: all permissions enforced, new permissions, unknown = admin-only
- `api-hardening.test.ts` — 4 tests: error sanitization, rate limiter behavior

### Armstrong Feature Requests
- **#9 Operator daily dashboard**: `/my-tasks` shows assigned tasks grouped by type with progress tracking. `/operations` manager board with KPIs, operator workload cards, task assignment dropdown
- **#3a Scan-out verification**: Pick screen accepts product barcode/SKU scan (not just bin). Units-per-case display with carton vs unit warning. Schema: `units_per_case` and `case_barcode` on Product
- **#7 Pick path optimization**: Pick task lines auto-sorted by bin barcode (zone→aisle→rack→shelf). `suggestPutawayBin()` for receiving (putaway rules → consolidation → nearest empty). Movement analytics in Reports tab (moves/day, operator travel, repeat trips)

### Infrastructure
- Credential migration script: `scripts/migrate-credentials.ts`
- Schema migration: `prisma/tenant-migrations/0003_product_packaging.sql`
- Armstrong Shopify credentials migrated from env vars into SalesChannel.config
- Feature request tracking doc shared across WMS + DispatchPro repos

### Cleanup
- Removed stale presentation docs (6 files)
- Updated documentation across README, roadmap, data model, session summary

---

## 2026-03-19 — Security & Data Integrity Hardening

- Fix 5 data integrity bugs: idempotency on terminal states, zero-stock sync, fulfillment IDs
- Enforce RBAC on remaining write paths: inventory, operator, billing
- Fix fail-open `NEXT_PUBLIC_USE_MOCK_DATA` check on login page and topbar
- Update README to reflect production state
- 170 tests passing, prod healthy on Hetzner

---

## 2026-03-18 — Production Deployment

- Merge server-side docker-compose additions
- Deploy to Hetzner CPX21 with Traefik, PostgreSQL, Redis, MinIO
- Provision Armstrong tenant in production
- Shopify live order sync enabled

---

## 2026-03-17 — Database Mode Live

- Switched from mock data to real PostgreSQL
- 12 pages wired to real DB queries
- Orders and shipping modules created
- 35 Playwright E2E tests added
- Auth fixture pattern shared with DispatchPro

---

## 2026-03-16 — Initial Build

- 56 routes across 4 apps (WMS, Operator, Portal, Platform)
- 124 unit tests, 8 integration adapters
- Multi-tenancy (schema-per-tenant), RBAC (4 roles)
- Shopify live connection, carrier/marketplace adapter stubs
- Full documentation suite (10 docs)
