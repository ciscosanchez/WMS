# Ramola WMS — Full Roadmap to Production

*Last updated: 2026-03-21 (end of day)*

## Current State Summary

The WMS has **56 routes across 4 apps**, **292 tests** (unit + E2E), **0 lint errors**, and **11 of 12 security audit items fixed**. Infrastructure: Postgres 16 + Redis + BullMQ job queues + AES-256-GCM secrets at rest + shared DB pool. All pages DB-backed, no mock data in any operational or config page. Shopify integration tenant-scoped. GitHub Actions CI runs on every push.

### Status Vocabulary

- **Hardened** = DB-backed, transition guards, error handling, tested
- **Wired** = reads/writes real data, but limited validation
- **Demo** = UI exists with mock data or no backend wiring

### What's Built

| Area | Status | Details |
|------|--------|---------|
| UI Shell | Hardened | Sidebar nav, topbar, breadcrumbs, search (Cmd+K), notifications |
| Dashboard | Hardened | 5 KPI cards (real queries, low-stock fixed), 4 charts, real activity from inventory txns |
| Clients CRUD | Wired | List, create, edit, delete with DataTable |
| Products CRUD | Wired | List, create, edit, delete with UOM/tracking |
| Warehouse | Wired | Cards, detail page with zones/aisles, bulk generator, add zone |
| Receiving | Hardened | Shipment list, detail, receive dialog, transition guards enforced |
| Fulfillment Orders | Hardened | Order list, detail, transition guards, pick task gen blocks on failure |
| Picking | Wired | Pick task list with real KPIs from DB, status tracking |
| Shipping | Hardened | Rate shop + label gen fail-closed (no demo fallbacks) |
| Inventory Browser | Wired | Stock table with location/lot/availability |
| Movements Ledger | Wired | Transaction history table |
| Adjustments | Wired | List page, create form wired to DB with real products/bins |
| Cycle Counts | Wired | DB-backed (queries InventoryAdjustment type=cycle_count) |
| Putaway | Wired | Pending items from receiving txns, confirm writes inventory + ledger |
| Discrepancies | Wired | DB-backed (queries ReceivingDiscrepancy table) |
| Channels | Wired | Sales channel cards from SalesChannel DB, order counts |
| Reports | Wired | 5 tabs with charts + summary metrics, CSV export |
| Settings | Wired | General config loads/saves from tenant DB, operational modes, sequences, users, invite, billing rates, carriers, integrations, EDI |
| Operator App | Wired | Receive, pick, pack, move, count (5 mobile-optimized pages, barcode scanner) |
| Client Portal | Wired | Inventory, orders, shipments, billing, reports (6 pages) |
| Superadmin Platform | Wired | Dashboard, tenant management, billing from real tenant DB with MRR/ARR |
| Database | Hardened | Docker Postgres 16 on port 5433, Prisma pg adapter, seeded |
| Auth | Wired | Login page with mock/real toggle, SessionProvider restored |
| Prisma Schemas | Hardened | Public + tenant with fulfillment models, driver adapters |
| Server Actions | Wired | All CRUD with mock/real toggle per function |
| RBAC | Hardened | 4 roles, permission map, helpers |
| Integrations | Hardened | UPS/FedEx/USPS adapters, Shopify, Amazon, NetSuite, DispatchPro, EDI — all tenant-scoped |
| Carrier Rate Shop | Hardened | Multi-carrier rate comparison, tenant-scoped credentials (DB first, env var fallback) |
| Marketplace Connectors | Hardened | Shopify (tenant-scoped via SalesChannel.config), Amazon adapter |
| Email Notifications | Wired | Resend: shipment arrived, receiving complete, order shipped (internal + customer), low-stock alerts |
| In-App Notifications | Wired | DB-backed, notifyWarehouseTeam() sends to admin + manager users |
| Putaway Engine | Wired | 4 strategies (fixed, zone, closest_empty, consolidate), suggestions shown in putaway dialog |
| Putaway Rules | Wired | CRUD for putaway rules with real products/zones from DB |
| Workflow Guards | Hardened | Order + shipment transition maps, invalid jumps rejected |
| Audit Logging | Wired | Utility functions |
| Security | Hardened | CSP, rate limiting (Redis-backed), AES-256-GCM secrets, per-tenant API auth, SQL injection prevention |
| Secrets at Rest | Hardened | AES-256-GCM encryption for carrier credentials, SECRETS_KEY env var |
| User Invites | Hardened | Token-based password-set flow (no plaintext passwords in email) |
| Job Queue | Wired | BullMQ + Redis: notifications, integrations, email queues with retries + DLQ |
| Redis | Wired | ioredis client for rate limiting + BullMQ job queues |
| DB Pooling | Hardened | Single shared pg.Pool (max 20), LRU cache for PrismaClient instances |
| Tests | Wired | 292 unit + 35 E2E, 0 lint errors |

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
✅ A1. Database (Docker+PG+Prisma)   🔲 D1. NetSuite bridge (need Armstrong credentials)
✅ A2. Auth (login/mock toggle)      🔲 D2. DispatchPro bridge
✅ A3. Tenant resolution             🔲 D3. Carrier sandbox credentials (UPS/FedEx/USPS)
✅ A4. Server actions (mock+real)    🔲 D4. Marketplace connectors (Shopify)
✅ A5. Audit + sequences             🔲 D5. EDI 940/945
✅ B1. Edit pages                    🔲 E1. PWA / offline
✅ B2. Full receiving workflow loop   🔲 H4. Performance (pagination, indexing)
✅ B3. Full inventory workflow loop   🔲 H5. Mobile responsive polish
✅ B4. Full fulfillment workflow loop 🔲 Email notifications
✅ B5. Document upload (MinIO)
✅ C1-C3. Client Portal (6 pages)
✅ D stubs. Integration contracts
✅ E. Operator App (5 pages)
✅ F1. Dashboard KPIs + charts
✅ F2. Reports (5 tabs + export)
✅ F3. CSV/PDF export
✅ F4. Global search (Cmd+K)
✅ F5. Notifications
✅ G1. User management + invite
✅ G2. Tenant settings
✅ G3. Billing config (rate cards)
✅ G4. Superadmin platform
✅ H1. Error handling + skeletons
✅ H2. Testing (292 unit tests, 35 E2E)
✅ H3. Security hardening (audit, RBAC, fail-closed)
✅ Cycle count plans + create
✅ Adjustment creation form
✅ Shipping detail + timeline
✅ Order detail + timeline
✅ Warehouse detail + zone mgmt
```

### Next Up (Priority Order)
1. **D1. NetSuite bridge** — Need Armstrong credentials
2. **D3. Carrier sandbox credentials** — UPS/FedEx/USPS live API keys
3. **H4. Performance** — Pagination, DB indexing for large datasets
4. **H5. Mobile responsive polish** — Tablet/phone optimization
5. **E1. PWA / offline** — Service worker, offline queue

### Armstrong Feature Requests (2026-03-20)

All WMS items shipped and deployed to production:

| # | Feature | Status |
|---|---------|--------|
| 9 | Operator daily dashboard + manager board | ✅ Live (`/my-tasks`, `/operations`) |
| 3a | Scan-out verification + units-per-case | ✅ Live (pick screen, product schema) |
| 7 | Pick path optimization + movement analytics | ✅ Live (bin sort, Reports → Movement tab) |
| 3b | TMS rate comparison | 🔲 DispatchPro repo |
| 5 | Email→NetSuite quote automation | — Out of scope (NetSuite customization) |

See `docs/armstrong-feature-requests.md` for full details.

---

## Estimated Remaining Effort

| Phase | Effort | Status |
|-------|--------|--------|
| A. Database Foundation | ~~1-2 weeks~~ | ✅ Complete |
| B. Complete Workflows | ~~2-3 weeks~~ | ✅ Complete |
| C. Client Portal | ~~1-2 weeks~~ | ✅ Complete |
| D. Integrations | 3-5 weeks | 🔲 Stubs done, need credentials (NetSuite, carrier sandboxes) |
| E. Operator App Polish | 1 week | 🔲 PWA + scanner |
| F. Dashboard & Reporting | ~~1-2 weeks~~ | ✅ Complete |
| G. Settings & Admin | ~~1 week~~ | ✅ Complete |
| H. Hardening | 2-3 weeks | ✅ Testing + security complete. Performance remaining. |

**Remaining to production: ~3-5 weeks (integrations + polish)** (down from 12-20)
