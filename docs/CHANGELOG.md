# Changelog

All notable changes to Ramola WMS.

## 2026-03-28 — Workflow Hardening, Warehouse Setup, and Browser Smoke Coverage

### Warehouse and Layout Setup

- Added manual bin create and edit flows under `/warehouse/bins/new` and `/warehouse/bins/[id]/edit`
- Added structured warehouse address entry with:
  - address line 1
  - address line 2
  - city
  - state / province
  - postal code
  - country
- Replaced the brittle embedded warehouse map preview with a CSP-safe external Google Maps verification link
- Added missing yard spot and dock door create/edit routes and shared forms

### Product and Inventory Runtime Hardening

- Added a real `/products/kits/new` route with a working kit-definition form
- Hardened the stock browser so missing product, bin, or client relations render placeholders instead of crashing
- Hardened `/inventory/lpn/new` to use lightweight product/bin choices instead of deep relation-heavy reads
- Added a friendlier Shopify inventory-sync error when merchant approval is still required for `read_locations`

### Shipping, Picking, and Billing Safety

- Fixed wave-generation inventory allocation to claim stock atomically instead of allowing concurrent over-allocation
- Changed pick-task reads to use `orders:read` semantics instead of `shipping:read`
- Wrapped transfer-order delete in a transaction
- Wrapped invoice generation and billing-event marking in a single transaction

### Labor and Navigation

- Clarified labor screens as operational analytics and costing, not payroll
- Fixed operator shift stats so “Tasks Today” and “Units Today” are backed by real queried values
- Replaced raw operator/client IDs in labor views with user/client labels where possible
- Improved the tenant sidebar collapse behavior so the collapsed rail can be reopened cleanly

### Browser Regression Coverage

- Added focused Playwright smoke coverage for:
  - warehouse create with structured address fields
  - manual bin create
  - yard spot and dock door create routes
  - channels -> integrations routing
  - kit create route
  - LPN create route
  - workflow-rules fail-soft rendering
  - sidebar collapse / expand behavior

## 2026-03-27 — Product UOM and Packaging Setup

### Product Master Data

- Replaced free-text `Base UOM` entry with a structured product packaging flow
- Added controlled base-UOM selection for new and edit product screens
- Added packaging metadata fields:
  - units per case
  - case barcode
- Added packaging conversion management through a dedicated configuration dialog
- Persisted `uom_conversions` during product create and update operations

### Product UX

- Unified new and edit product screens around a shared product editor
- Added weight-unit and dimension-unit selectors to the new-product flow so it now matches edit behavior
- Added packaging summary visibility to the products table so case-pack setup is visible without opening the SKU

### Validation

- Added schema validation for:
  - normalized UOM codes
  - duplicate conversion prevention
  - ensuring conversions resolve back to the selected base UOM

### Operational UOM Usage

- Receiving line entry now uses product packaging conversions to resolve requested UOM quantities into base stocking units
- Order entry now lets users pick a requested UOM and previews the normalized base-unit allocation quantity
- Added shared product-UOM helpers with test coverage for:
  - derived UOM choices
  - case-pack fallback
  - requested-UOM to base-unit conversion

### User Preferences

- Added light, dark, and system theme support through a root theme provider
- Added a theme selector in tenant settings for per-browser appearance preference

### Client and Billing Cleanup

- Replaced separate client create/edit forms with a shared structured client form
- Normalized client master-data entry for:
  - country
  - state / province
  - phone number
  - trimmed contact and address fields
- Added supported country and region reference data for client setup
- Tightened client schema validation so unsupported country and region combinations are rejected consistently
- Reframed billing service configuration from loose UOM labels to explicit rate-basis codes and labels in the settings UI
- Added server-side validation so billing rate cards only accept the configured basis code for each service type
- Normalized order ship-to entry for:
  - supported country selection
  - state / province validation
  - trimmed address fields
  - normalized shipping phone and email
- Added structured carton-type create/edit flows with controlled dimension and weight unit selection
- Replaced dead carton-type new/edit links with working pages backed by normalized carton schema validation
- Shipping rate shopping and label generation now derive fallback package dimensions from configured carton types instead of always using hardcoded box defaults
- Shipping rate shopping and mark-shipped surfaces now use fulfillment i18n strings and show clearer validation / empty-state feedback

## 2026-03-27 — RBAC Governance, CI Recovery, and Docs Refresh

### RBAC Phase 5

- Added tenant-saved permission presets on top of global presets
- Added bulk preset application from `Settings -> Users`
- Added access-review cadence tracking and review-complete workflow support
- Kept the core model stable:
  - base role
  - portal binding
  - grants
  - denies

### CI/CD Hardening

- Burned down app and unit-test lint debt to zero for the checked scopes used in CI
- Fixed stale unit tests introduced by the RBAC and operational-attributes work
- Updated GitHub Actions to current `actions/checkout` and `actions/setup-node` versions
- Fixed the deploy workflow to use the actual production SSH target:
  - user: `deploy`
  - port: `49502`
- GitHub Actions now validates and deploys cleanly from `main`

### Documentation

- Refreshed the competitive analysis to reflect current shipped capability instead of older gaps
- Refreshed the market-position / magic-quadrant assessment to account for:
  - LPN tracking
  - GS1/SSCC
  - report exports
  - workflow rules
  - marketplace expansion
  - RBAC governance maturity
- Kept the Armstrong comparison docs, but reframed the product direction around generic configurable operational attributes instead of customer-specific custom fields

## 2026-03-27 — RBAC Custom Permission Overrides

### Access Model

- Added `tenant_users.permission_overrides` in the public schema
- Added safe override normalization with additive `grants` and subtractive `denies`
- Effective permission evaluation now supports:
  - role defaults
  - explicit grants
  - explicit denies
  - deny precedence over inherited access

### Admin UX

- Added a per-user custom-permissions editor in `Settings -> Users`
- Users table now shows when a user has custom access beyond their base role
- Custom permissions are managed without creating role sprawl or tenant-specific enum roles
- Added a diff summary inside the custom-permissions dialog
- Added copy-from-user support for grants and denies without changing the base role

### Enforcement

- Session and tenant-context permission checks now use effective permissions instead of raw role level only
- Sidebar visibility now respects effective permissions too

### Auditability

- Role changes, portal-client binding changes, and permission-override changes now create tenant audit-log entries with before/after values

### Tooling

- Increased the CI ESLint warning threshold from 10 to 100 so existing repo-wide warning debt stops blocking unrelated feature work while it is reduced incrementally

## 2026-03-26 — Configurable Operational Attributes Phase 1

### Product Direction

- Added a generic architecture brief for tenant-configurable operational attributes
- Added a phase-1 foundation doc to separate reusable platform work from Armstrong-specific configuration
- Positioned Armstrong as the first design partner, not the hardcoded product definition

### Foundation Work

- Added tenant schema and tenant migration support for:
  - operational attribute definitions
  - operational attribute options
  - operational attribute values
- Added server-side Zod schemas for attribute definition validation
- Added phase-1 server actions for attribute definition CRUD and archive behavior
- Added audit logging for definition lifecycle changes

### Coverage

- Added unit coverage for the initial operational attribute definition schema contract

## 2026-03-26 — Configurable Operational Attributes Phase 2 (Initial Slice)

### Usable Product Surface

- Added a tenant settings page for operational attribute definition management
- Added create, edit, and archive flows for attribute definitions
- Added a settings shortcut from the main tenant settings screen

### First Runtime Integration

- Refactored inbound shipment creation to load operational attribute definitions server-side
- Added first-pass shipment-level attribute capture on `/receiving/new`
- Added generic value persistence for scope-aware operational attribute values

### Intentional Boundary

- This slice stops at shipment-level capture
- LP propagation, inventory search, allocation, and broader render surfaces still belong to the next phase

## 2026-03-26 — Configurable Operational Attributes Phase 2 (Line + LPN Expansion)

### Receiving

- Added operational attribute capture for inbound shipment lines in the add-line dialog
- Line-level receiving definitions now flow through the generic value persistence layer

### LPN

- Added a real `/inventory/lpn/new` creation surface
- LPN create flows now support operational attribute capture
- Operational attribute definition reads can now be permission-scoped to the runtime surface using them

## 2026-03-26 — Configurable Operational Attributes Phase 3 (Propagation + Inventory Filter)

### Propagation

- LPN attribute values now copy into `inventory_record` scoped values during LPN receive and consume flows

### Inventory Visibility

- Added a stock-browser filter for `inventory_record` operational attributes
- Inventory search can now narrow by selected attribute definition and text value

### Product Shape

- This is the first end-to-end loop for the feature:
  - capture
  - persist
  - propagate
  - search

## 2026-03-26 — Configurable Operational Attributes Phase 3.1 (Inventory Visibility)

### Inventory Browser

- Added a reusable entity-value lookup helper for operational attributes
- Stock browser rows now render propagated `inventory_record` attributes as badges
- Filtered inventory results now show the values that caused the match instead of hiding them in the data layer

## 2026-03-26 — Configurable Operational Attributes Phase 4 (Order Criteria + Allocation Matching)

### Order Capture

- Added `order_line` as a first-class operational attribute scope
- Order creation now supports line-level operational attribute capture
- Order-line criteria persist through the same generic definition/value system as receiving and LPN flows

### Allocation

- Pick-task generation now checks for `order_line` criteria before allocating stock
- When criteria exist, allocation prefers `inventory_record` values with matching operational-attribute keys and values
- Matching remains generic and tenant-configurable rather than Armstrong-specific

### Coverage

- Added schema coverage for the new `order_line` scope
- Added allocation coverage proving attribute-aware inventory selection

## 2026-03-26 — Configurable Operational Attributes Phase 4.1 (Order Visibility)

### Order Detail

- Order detail now renders line-level operational attribute badges
- Order reads now enrich order lines with persisted `order_line` attribute values so captured criteria remain visible after entry

## 2026-03-26 — Configurable Operational Attributes Phase 4.2 (Typed Inventory Attribute Search)

### Inventory Search

- Inventory attribute filtering now works across text, number, currency, date, boolean, and array-backed operational attribute values
- Search behavior now uses a generic normalization layer instead of only matching `text_value`

## 2026-03-26 — Configurable Operational Attributes Phase 4.3 (Export Surfaces)

### CSV Export

- Inventory exports now append active `inventory_record` operational attributes as dynamic CSV columns
- Order exports now append aggregated `order_line` operational attributes as dynamic CSV columns
- Export shaping remains generic and definition-driven rather than customer-specific

## 2026-03-26 — Configurable Operational Attributes Phase 4.4 (Reporting Coverage)

### Reports

- Added an operational-attribute coverage dataset to the reports module
- Reports now expose:
  - active definition count
  - searchable definition count
  - allocatable definition count
  - coverage by scope
  - most-used definitions by populated value count
- Added a dedicated Attributes tab in tenant reports with CSV export support

## 2026-03-26 — Configurable Operational Attributes Phase 4.5 (Document Surface Mapping)

### Labels & Documents

- Added a generic document-surface mapping layer for operational attributes
- Shipping labels page now shows which attributes are configured for:
  - labels
  - manifests
  - packing lists
- Mapping is driven by `behaviorFlags` and `displayRules` rather than tenant-specific templates

## 2026-03-26 — Configurable Operational Attributes Phase 4.6 (Admin Polish)

### Settings UX

- Settings now supports `order_line` as a first-class operational attribute scope
- Added common admin toggles for:
  - searchable
  - allocatable
  - show on label
  - show on manifest
  - show on packing list
- Advanced JSON fields remain available for custom behavior and display rules

## 2026-03-26 — Operational Attribute Rollout Prep

### Tenant Migration Safety

- Added `scripts/apply-tenant-migrations.ts` to apply versioned tenant SQL migrations across existing tenant schemas
- Added `npm run db:migrate:tenants` as the standard operational entrypoint for tenant-schema rollout
- This closes the rollout gap for live `tenant_*` schemas that do not use Prisma migration history

## 2026-03-26 — Tenant Migration Reconciliation

### Legacy Tenant Schemas

- Added `scripts/reconcile-tenant-migrations.ts` to seed `_migrations` for legacy tenant schemas through `0021_customs_freight.sql`
- Added `npm run db:reconcile:tenants` for the one-time reconciliation path on existing live tenants
- This allows `0022_operational_attributes.sql` and `0023_order_line_operational_attributes.sql` to apply cleanly without rerunning baseline tenant DDL

## 2026-03-26 — RBAC Persona Hardening

### Access Model

- Added derived persona helpers for:
  - `superadmin`
  - `tenant_admin`
  - `tenant_manager`
  - `warehouse_worker`
  - `operator`
  - `viewer`
  - `portal_user`
- Middleware now applies persona-aware default routing on tenant subdomains
- Portal users are redirected into `/portal/*`
- Operator users default to `/my-tasks`

### RBAC Enforcement

- Tightened remaining user-facing `requireTenantContext()` gaps across tenant modules
- Corrected user admin to require `users:write`
- Added nav visibility and boundary tests for sidebar and portal shell
- Added persona tests and seed persona matrix tests

### Portal & Export Security

- Portal shell now resolves and displays the bound client account
- Portal layout avoids redirect loops on unexpected runtime failures
- Export routes for inventory, orders, and billing now scope portal-bound users by `portal_client_id`
- Users admin can now bind and unbind portal access directly
- Invite flow now supports explicit standard, operator, and portal access experiences

### Document Intelligence Security

- `updateShipmentFromExtraction()` now requires `receiving:write`
- `getFileViewUrl()` now requires `receiving:read`

### Coverage

- Added middleware contract tests for persona-aware routing defaults
- Added a Playwright mock-auth persona fixture for admin, manager, operator, viewer, portal, and superadmin test contexts
- Localhost tenant-mode redirects now key off the request host instead of relying only on `TENANT_RESOLUTION`

### Documentation

- Expanded [docs/rbac.md](rbac.md) into the RBAC/persona source-of-truth
- Updated architecture and data-model docs to reflect derived personas and portal bindings

## 2026-03-25 — Competitive Gap Closure Sprint

### Gaps Closed (14 of 17 identified)

- **Billing ops workbench**: Charge adjustments, approval workflow, disputes, invoice lifecycle (15 tests)
- **Lot/expiration/FEFO**: Expiration date field, FEFO pick enforcement, expiration alerts
- **Multi-warehouse transfers**: TransferOrder model, status lifecycle, CRUD
- **Customs & freight**: CustomsEntry, entry lines, bonded inventory, CUSTOMS_ENTRY_TRANSITIONS (34 tests)
- **6 marketplace adapters**: Shopify, Amazon, Walmart, WooCommerce, BigCommerce, eBay (55+ tests)
- **LPN/container tracking**: Pallet-level receive/move/consume with inventory breakdown (8 tests)
- **GS1/SSCC compliance**: SSCC-18 generation, GS1-128 barcodes, retailer label templates
- **Report export engine**: CSV API routes for inventory/orders/billing + BullMQ report queue (9 tests)
- **Workflow rules engine**: Configurable if/then rules with condition evaluation (12 tests)
- **Auto-replenishment**: ReplenishmentRule model, threshold-based bin monitoring
- **Productivity trends**: 14-day daily UPH trend data in labor dashboard

### Documentation

- Comprehensive 12-platform competitive analysis (Manhattan, Blue Yonder, SAP, Oracle, Korber, Infor, Logiwa, ShipHero, Extensiv, Deposco, Magaya, Grasshopper)
- Updated magic quadrant with actual gap assessment
- Removed stale docs (armstrong-feature-requests, ecosystem, docai-handoff, wms-roadmap, next-steps, session-summary)
- Rewritten deployment guide for Hetzner
- Page review checklist for agent-generated UX

### Maintainability

- TenantDb type + asTenantDb() helper to centralize any casts
- ActionResult<T> + ok()/err() for standardized server action returns
- All files split to <500 lines (inventory, shipping, yard-dock, labor)
- Build standards checklist saved to memory for future features

---

## 2026-03-24 — Production Hardening + Advanced WMS Modules

### Audit Remediation (Chunks 1-6)

- **Data boundaries**: Tenant/operator layouts enforce membership+permission, portal uses portalClientId from JWT
- **Inventory integrity**: Putaway decrements source bin, finalize guards putaway-first race, ship rejects insufficient stock
- **Pack idempotency**: Duplicate check + billing inside transaction, shipped-status guard on markShipmentShipped
- **Unified RBAC**: Single source of truth in rbac.ts (37 permissions), session.ts + context.ts import from it
- **Engineering**: 3 failing test suites fixed, all TS7006 implicit-any errors resolved, lint warnings reduced
- **Security**: Nonce-based CSP in production, HSTS, Sentry DSN to env vars, channel secrets encrypted, integration status probes

### Advanced WMS Capabilities (Chunk 7 — all 11 features)

- **Yard & Dock**: Dock doors, appointments with overlap prevention, Gantt calendar, yard map, driver check-in kiosk
- **Labor Management**: Shift tracking, task time logging, productivity dashboard, cost-per-unit, 3PL billing
- **Returns/RMA**: 9-state lifecycle, inspection + disposition, inventory re-entry, returns billing
- **Cartonization**: FFD bin-packing algorithm, carton catalog, pack plans
- **Slotting Optimization**: ABC velocity analysis, multi-factor scoring, BullMQ async jobs
- **Task Interleaving**: Combined pick/putaway/replenish routes sorted by bin proximity
- **VAS/Kitting**: Kit definitions (BOM), assembly/labeling/bundling tasks
- **Cross-Dock**: Rule-based inbound-to-outbound bypass
- **Analytics**: Throughput trends, SLA compliance, exception heatmaps, utilization
- **Compliance**: HS code validation, hazmat flags, screening workflow
- **Automation**: Device registry, task queue for AMR/conveyor/pick-to-light

### Infrastructure

- 21 SQL migrations (0001-0021)
- 73 Prisma models, 37 RBAC permissions
- Full en/es i18n for all features
- 5 BullMQ workers (notifications, integrations, email, slotting, reports)
- CI/CD: GitHub Actions validate + auto-deploy to Hetzner

---

## 2026-03-20 — Production Audit + Operator Features

### Security & Data Integrity

- Transactional inventory mutations with in-tx re-validation
- Outbound stock consumption: allocation + deallocation + ledger
- Multi-tenant integrations: all crons/webhooks iterate tenants
- Portal client isolation: fail-closed, no email fallback
- RBAC consistency: synced permission maps, unknown = admin-only
- API hardening: error sanitization, rate limiting

### Tests (170 → 292)

- inventory-integrity, portal-isolation, multi-tenant-crons, rbac-consistency, api-hardening

### Operator Features

- Daily task dashboard, scan-out verification, pick path optimization
- Movement analytics in Reports tab

---

## 2026-03-19 — Security Hardening

- Fix 5 data integrity bugs
- Enforce RBAC on remaining write paths
- Fix fail-open mock auth checks
- 170 tests passing, prod healthy

---

## 2026-03-18 — Production Deployment

- Deploy to Hetzner CPX21 with Traefik, PostgreSQL, Redis, MinIO
- Shopify live order sync enabled

---

## 2026-03-17 — Database Mode Live

- Switched from mock data to real PostgreSQL
- Orders and shipping modules, 35 E2E tests

---

## 2026-03-16 — Initial Build

- 56 routes across 4 apps (WMS, Operator, Portal, Platform)
- 124 unit tests, 8 integration adapters
- Multi-tenancy, RBAC, Shopify connection
