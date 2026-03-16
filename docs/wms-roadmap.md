# Ramola WMS — Full Roadmap to Production

*Last updated: 2026-03-16*

## Current State Summary

The WMS has **49 routes across 4 apps** (WMS back-office, Operator App, Client Portal, Superadmin Platform). Postgres is running in Docker on port 5433 with Prisma pg driver adapter. Pages support both mock data and real DB queries via the `USE_MOCK_DATA` toggle.

### What's Built

| Area | Status | Details |
|------|--------|---------|
| UI Shell | Done | Sidebar nav, topbar, breadcrumbs, search (Cmd+K), notifications |
| Dashboard | Done | 5 KPI cards, 4 charts (recharts), recent activity feed |
| Clients CRUD | Done | List, create, edit, delete with DataTable |
| Products CRUD | Done | List, create, edit, delete with UOM/tracking |
| Warehouse | Done | Cards, detail page with zones/aisles, bulk generator, add zone |
| Receiving | Done | Shipment list, detail with tabs, receive dialog, add line, document upload |
| Fulfillment Orders | Done | Order list, detail with timeline, create form with line items |
| Picking | Done | Pick task list with KPIs, assignment |
| Shipping | Done | Outbound table, detail with tracking timeline, reprint label |
| Inventory Browser | Done | Stock table with location/lot/availability |
| Movements Ledger | Done | Transaction history table |
| Adjustments | Done | List page, create form with variance calculation |
| Cycle Counts | Done | Plans table with KPIs, create dialog, start count |
| Channels | Done | Sales channel cards |
| Reports | Done | 5 tabs with charts + summary metrics, CSV export |
| Settings | Done | General config, operational modes, sequence prefixes, user management, invite |
| Operator App | Done | Receive, pick, pack, move, count (5 mobile-optimized pages) |
| Client Portal | Done | Inventory, orders, shipments, billing, reports (6 pages) |
| Superadmin Platform | Done | Dashboard, tenant management, billing overview (4 pages) |
| Database | Done | Docker Postgres 16 on port 5433, Prisma pg adapter, seeded |
| Auth | Done | Login page with mock/real toggle, SessionProvider restored |
| Prisma Schemas | Done | Public + tenant with fulfillment models, driver adapters |
| Server Actions | Done | All CRUD with mock/real toggle per function |
| RBAC | Done | 4 roles, permission map, helpers |
| Integration Layer | Stubs | NetSuite client, carrier types, rate shop engine, marketplace types |
| Audit Logging | Done | Utility functions |
| Sequence Numbers | Done | Auto-number generator |
| File Upload | Done | Pre-signed URL upload API, file upload component, document panel |
| CSV/PDF Export | Done | CSV download utility, print-to-PDF, export buttons |
| Error Handling | Done | Error boundary, 404, loading skeletons |
| Dockerfile | Done | Multi-stage build, standalone output |
| Tests | Started | 4 unit test files, Playwright config |
| Docs | Done | Architecture, data model, ecosystem, flows, deployment, competitive analysis |

---

## Phase A: Wire Up the Database (Foundation)

**Goal:** Replace all mock data with real database queries. This is the prerequisite for everything else.

### A1. Database Setup
- [ ] Docker Compose verified working (Postgres 16 + MinIO)
- [ ] `npm run db:push` creates public schema tables
- [ ] Tenant provisioning script creates demo tenant schema
- [ ] `npm run db:seed` populates demo data
- [ ] Verify both Prisma clients query correctly

### A2. Restore Auth
- [ ] Re-enable NextAuth.js credentials provider in `session.ts`
- [ ] Restore `SessionProvider` in root layout
- [ ] Restore login page (currently redirects to dashboard)
- [ ] Wire up `requireAuth()` in server components
- [ ] Test login → JWT → session → tenant resolution flow
- [ ] Add registration page for new users

### A3. Restore Tenant Resolution
- [ ] Re-enable real tenant lookup in `context.ts` (currently returns mock)
- [ ] Test subdomain resolution (production mode)
- [ ] Test `x-tenant-slug` header resolution (dev mode)
- [ ] Test `tenant-slug` cookie fallback for browser
- [ ] Add tenant selector UI if user belongs to multiple tenants

### A4. Wire Up Server Actions
- [ ] **Clients**: `getClients()`, `createClient()`, `updateClient()`, `deleteClient()`
- [ ] **Products**: `getProducts()`, `createProduct()`, `updateProduct()`, `deleteProduct()`
- [ ] **Warehouse**: `getWarehouses()`, `createWarehouse()`, `createZone()`, `generateBulkLocations()`
- [ ] **Receiving**: `getShipments()`, `createShipment()`, `addShipmentLine()`, `receiveLine()`, `updateShipmentStatus()`
- [ ] **Inventory**: `getInventory()`, `getInventoryTransactions()`, `moveInventory()`, `createAdjustment()`, `approveAdjustment()`
- [ ] All pages fetch from DB instead of mock arrays
- [ ] All forms submit via server actions instead of `toast.success()`
- [ ] `revalidatePath()` working for cache busting after mutations

### A5. Audit & Sequences
- [ ] `logAudit()` called at end of every mutation server action
- [ ] `nextSequence("ASN")` generating `ASN-2026-0001` format numbers
- [ ] Audit log viewable in settings or admin page

---

## Phase B: Complete CRUD & Workflows (Core Functionality)

### B1. Edit Pages (Missing)
- [ ] Client edit page (`/clients/[id]/edit`)
- [ ] Product edit page (`/products/[id]/edit`)
- [ ] Warehouse edit / zone management
- [ ] Shipment edit (before arrival)
- [ ] Pre-populate forms with existing data from DB

### B2. Receiving Workflow — Full Loop
- [ ] Status transitions enforce valid flow (draft→expected→arrived→receiving→completed)
- [ ] "Mark Arrived" sets arrival date, sends notification
- [ ] Line-by-line receiving updates `received_qty` in real-time
- [ ] Receiving dialog shows bin selector (filtered by zone/availability)
- [ ] "Complete Receiving" creates inventory records + transactions
- [ ] Discrepancy auto-detection (received ≠ expected)
- [ ] Discrepancy resolution workflow (resolve, close)
- [ ] Inspection checklists (configure + execute)

### B3. Inventory Operations — Full Loop
- [ ] Putaway rules engine (fixed, zone, closest empty, consolidate)
- [ ] Suggested putaway after receiving (based on rules)
- [ ] Execute putaway → update inventory + transaction
- [ ] Bin-to-bin move → update both bins + transaction
- [ ] Adjustment creation with line items (system qty vs counted qty)
- [ ] Adjustment approval workflow (submit → approve/reject → apply)
- [ ] Cycle count plan creation (ABC, zone, full, random)
- [ ] Cycle count execution → generate adjustment
- [ ] Low stock alerts (product.min_stock vs inventory.on_hand)

### B4. Fulfillment Workflow — Full Loop
- [ ] Order creation (manual via UI)
- [ ] Order line management (add/remove products)
- [ ] Inventory allocation (reserve stock, decrement available)
- [ ] Auto-allocation on order creation (configurable)
- [ ] Pick task generation from allocated orders
- [ ] Pick task assignment (manual or auto-assign)
- [ ] Pick execution → update inventory (decrement on_hand + allocated)
- [ ] Packing workflow → create shipment
- [ ] Shipment creation with package dimensions/weight
- [ ] Outbound shipment status tracking
- [ ] Order status auto-progression through workflow

### B5. Document Management
- [ ] File upload to MinIO via pre-signed URLs
- [ ] Attach documents to shipments (BOL, packing list, photos)
- [ ] Document viewer in shipment detail
- [ ] Document download

---

## Phase C: Client Portal (Customer-Facing)

### C1. Portal Auth
- [ ] Separate auth flow for client users (not Armstrong staff)
- [ ] Client user registration (invited by Armstrong admin)
- [ ] Client user can only see their own client's data
- [ ] Scoped permissions (read-only by default)

### C2. Portal Pages
- [ ] `/portal/inventory` — Real-time stock visibility for their products
- [ ] `/portal/orders` — Place manual outbound orders
- [ ] `/portal/orders/[id]` — Order detail with tracking
- [ ] `/portal/shipments` — Inbound and outbound shipment tracking
- [ ] `/portal/billing` — View invoices (pulled from NetSuite or WMS billing)
- [ ] `/portal/reports` — Downloadable inventory/activity reports (CSV/PDF)

### C3. Portal UX
- [ ] Branded per-client (logo, colors from tenant settings)
- [ ] Email notifications (shipment received, order shipped, low stock)
- [ ] Mobile responsive

---

## Phase D: Integrations (Connecting Systems)

### D1. NetSuite ERP Bridge
- [ ] Define API contract (REST or SuiteTalk/SuiteScript)
- [ ] Sync customers from NetSuite → WMS clients
- [ ] Sync rate cards / contracts → billing configuration
- [ ] Push billable events from WMS → NetSuite (receiving, storage, handling, shipping)
- [ ] Invoice generation trigger
- [ ] Two-way product/SKU sync

### D2. DispatchPro TMS Bridge
- [ ] Define API contract
- [ ] Create LTL/FTL ship request from WMS → DispatchPro
- [ ] Receive tracking updates from DispatchPro → WMS
- [ ] Dock appointment scheduling (if yard management added)
- [ ] POD (proof of delivery) sync

### D3. Carrier Integrations (Parcel)
- [ ] UPS API — rate shopping, label generation, tracking
- [ ] FedEx API — rate shopping, label generation, tracking
- [ ] USPS API — rate shopping, label generation, tracking
- [ ] Rate comparison UI (cheapest/fastest for service level)
- [ ] Label PDF generation and print queue
- [ ] End-of-day manifest creation
- [ ] Tracking webhook receivers (delivery updates)
- [ ] Carrier account management page in settings

### D4. Marketplace Connectors
- [ ] Shopify — order import, inventory sync, tracking push
- [ ] Amazon Seller/FBA — order import, inventory sync, tracking
- [ ] Walmart — order import, inventory sync, tracking
- [ ] Generic webhook/API order endpoint for custom integrations
- [ ] Channel configuration UI (API keys, store URLs)
- [ ] Inventory quantity sync (WMS available → channel stock levels)
- [ ] Order status sync (WMS shipped → channel fulfilled)

### D5. EDI
- [ ] EDI 940 (Warehouse Shipping Order) — inbound order creation
- [ ] EDI 945 (Warehouse Shipping Advice) — shipment confirmation
- [ ] EDI 856 (ASN) — inbound shipment notification
- [ ] EDI 944 (Warehouse Stock Transfer Receipt) — receiving confirmation
- [ ] EDI parser + generator utilities
- [ ] Trading partner configuration

---

## Phase E: Operator App Polish (Warehouse Floor)

### E1. PWA Setup
- [ ] Service worker for offline capability
- [ ] Web app manifest (`manifest.json`)
- [ ] Install prompt on Android/iOS tablets
- [ ] Offline queue for scan events (sync when reconnected)

### E2. Scanner Integration
- [ ] Hardware barcode scanner support (keyboard wedge mode)
- [ ] Camera-based scanning fallback (for phones)
- [ ] Scan validation (beep on success, vibrate on error)
- [ ] Auto-advance between fields on successful scan

### E3. Operator UX
- [ ] Large touch targets (minimum 48px)
- [ ] High contrast mode for warehouse lighting
- [ ] Audio feedback (scan success, error, task complete)
- [ ] Offline indicator
- [ ] Session timeout handling
- [ ] Quick switch between tasks

---

## Phase F: Dashboard, Reporting & Analytics

### F1. Dashboard KPIs (Real Data)
- [ ] Pending receipts (live query)
- [ ] Items received today (live query)
- [ ] Total active SKUs (live query)
- [ ] Storage utilization (bins occupied / total)
- [ ] Low stock alerts count
- [ ] Orders awaiting fulfillment
- [ ] Pick tasks in progress
- [ ] Shipped today

### F2. Charts
- [ ] Receiving volume (30-day trend)
- [ ] Fulfillment throughput (orders/day)
- [ ] Zone utilization (bar chart per zone)
- [ ] Order status distribution (pie/donut)
- [ ] Inventory value by client

### F3. Reports
- [ ] Receiving summary (by date, client, carrier)
- [ ] Inventory valuation (current stock × value)
- [ ] Storage utilization (by zone, warehouse)
- [ ] Movement history (all transactions, filterable)
- [ ] Client activity report (per-client operations summary)
- [ ] Billing activity report (per-client billable events)
- [ ] CSV export for all reports
- [ ] PDF export for key reports
- [ ] Scheduled email reports

### F4. Global Search (Cmd+K)
- [ ] Search across shipments, orders, products, clients, bins
- [ ] Recent searches
- [ ] Quick actions (create shipment, create order, etc.)

### F5. Notifications
- [ ] In-app notification bell with unread count
- [ ] Notification types: shipment arrived, low stock, adjustment pending, order rush
- [ ] Mark as read / mark all read
- [ ] Notification preferences in settings

---

## Phase G: Settings & Administration

### G1. User Management
- [ ] Invite users (email invite flow)
- [ ] User list with role assignment
- [ ] Deactivate/reactivate users
- [ ] Password reset flow

### G2. Tenant Settings
- [ ] Company name, logo, address
- [ ] Operational modes toggle (freight / fulfillment / both)
- [ ] Default warehouse assignment
- [ ] Sequence number prefixes
- [ ] Timezone and date format

### G3. Billing Configuration
- [ ] Rate card management (per service, per unit type)
- [ ] Client-specific rate overrides
- [ ] Billing period settings (weekly / monthly)
- [ ] Storage snapshot scheduling

### G4. Superadmin (Platform)
- [ ] Tenant list with status, plan, usage
- [ ] Provision new tenants
- [ ] Suspend / activate tenants
- [ ] Cross-tenant usage dashboard

---

## Phase H: Hardening & Quality

### H1. Error Handling
- [ ] Global error boundary
- [ ] Server action error handling (try/catch → toast)
- [ ] Form validation error display
- [ ] 404 pages for invalid IDs
- [ ] Loading states (skeletons) for all data-fetching pages
- [ ] Empty states with action CTAs for all list pages
- [ ] Optimistic updates for mutations

### H2. Testing
- [ ] Unit tests for all server actions (with mocked Prisma)
- [ ] Unit tests for all Zod schemas
- [ ] Unit tests for RBAC (done)
- [ ] Unit tests for audit diffing (done)
- [ ] Integration tests for receiving workflow (DB required)
- [ ] Integration tests for fulfillment workflow (DB required)
- [ ] Integration tests for tenant isolation
- [ ] E2E tests for critical paths (login → receive → complete)
- [ ] E2E tests for RBAC enforcement
- [ ] Performance tests for inventory queries (large datasets)

### H3. Security
- [ ] RBAC enforcement on every server action (not just pages)
- [ ] Tenant isolation verification (no cross-tenant data leaks)
- [ ] Input sanitization on all server actions
- [ ] Rate limiting on auth endpoints
- [ ] CSRF protection (Next.js built-in)
- [ ] Secure headers (CSP, HSTS, etc.)
- [ ] Secrets management (no hardcoded keys)
- [ ] SQL injection prevention (Prisma parameterized queries)

### H4. Performance
- [ ] Cursor-based pagination for large tables (inventory, transactions)
- [ ] Database indexes on frequently queried columns
- [ ] Connection pool tuning
- [ ] Image/asset optimization
- [ ] Bundle size analysis

### H5. Responsive / Mobile
- [ ] All back-office pages responsive on tablet
- [ ] Operator app optimized for 7-10" tablets
- [ ] Client portal works on mobile phones
- [ ] Print stylesheets for reports and labels

---

## Priority Order

```
 MUST HAVE (blocks everything)     SHOULD HAVE (enables value)    NICE TO HAVE (polish)
 ─────────────────────────────     ───────────────────────────    ────────────────────────
 A1. Database setup                B2. Full receiving workflow    E1. PWA / offline
 A2. Restore auth                  B3. Full inventory workflow    E2. Scanner integration
 A3. Tenant resolution             B4. Full fulfillment workflow  E3. Operator UX polish
 A4. Wire up server actions        C1-C3. Client Portal           F2. Charts
 A5. Audit + sequences             D1. NetSuite bridge            F3. Reports
 B1. Edit pages                    D2. DispatchPro bridge         F4. Global search (Cmd+K)
 H1. Error handling                D3. Carrier integrations       F5. Notifications
                                   D4. Marketplace connectors     G3. Billing config
                                   F1. Dashboard KPIs (real)      G4. Superadmin
                                   G1. User management            H4. Performance
                                   G2. Tenant settings
                                   H2. Testing
                                   H3. Security
```

---

## Updated Priority List (2026-03-16)

```
✅ COMPLETED                          🔲 REMAINING
──────────────────────────────────    ──────────────────────────────────
✅ A1. Database (Docker+PG+Prisma)   🔲 B2. Full receiving workflow loop
✅ A2. Auth (login/mock toggle)      🔲 B3. Full inventory workflow loop
✅ A3. Tenant resolution             🔲 B4. Full fulfillment workflow loop
✅ A4. Server actions (mock+real)    🔲 D1. NetSuite bridge (real API)
✅ A5. Audit + sequences             🔲 D2. DispatchPro bridge
✅ B1. Edit pages                    🔲 D3. Carrier integrations (UPS/FedEx)
✅ B5. Document upload (MinIO)       🔲 D4. Marketplace connectors (Shopify)
✅ C1-C3. Client Portal (6 pages)   🔲 D5. EDI 940/945
✅ D stubs. Integration contracts    🔲 E1. PWA / offline
✅ E. Operator App (5 pages)         🔲 E2. Scanner integration
✅ F1. Dashboard KPIs + charts       🔲 G3. Billing config (rate cards)
✅ F2. Reports (5 tabs + export)     🔲 H2. Testing (unit + integration)
✅ F3. CSV/PDF export                🔲 H3. Security hardening
✅ F4. Global search (Cmd+K)         🔲 H4. Performance (pagination)
✅ F5. Notifications                 🔲 H5. Mobile responsive polish
✅ G1. User management + invite
✅ G2. Tenant settings
✅ G4. Superadmin platform
✅ H1. Error handling + skeletons
✅ Cycle count plans + create
✅ Adjustment creation form
✅ Shipping detail + timeline
✅ Order detail + timeline
✅ Warehouse detail + zone mgmt
```

### Next Up (Priority Order)
1. **B2. Receiving workflow** — Complete status flow with real DB mutations
2. **B4. Fulfillment workflow** — Allocation → pick → pack → ship with DB
3. **B3. Inventory workflow** — Putaway rules, adjustment approval
4. **G3. Billing config** — Rate cards per client
5. **H2. Testing** — Unit + integration tests for workflows
6. **D1-D4. Integrations** — Need API credentials

---

## Estimated Remaining Effort

| Phase | Effort | Status |
|-------|--------|--------|
| A. Database Foundation | ~~1-2 weeks~~ | ✅ Complete |
| B. Complete Workflows | 2-3 weeks | 🔲 Remaining |
| C. Client Portal | ~~1-2 weeks~~ | ✅ Complete |
| D. Integrations | 3-5 weeks | 🔲 Stubs done, real APIs remaining |
| E. Operator App Polish | 1 week | 🔲 PWA + scanner |
| F. Dashboard & Reporting | ~~1-2 weeks~~ | ✅ Complete |
| G. Settings & Admin | ~~1 week~~ | ✅ Complete (billing config remaining) |
| H. Hardening | 2-3 weeks | 🔲 Testing + security |

**Remaining to production: ~8-12 weeks** (down from 12-20)
