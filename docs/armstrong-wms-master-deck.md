# Armstrong WMS — Master Presentation
### From Receiving Through Fulfillment, Billing, and Client Visibility

> **Ramola** · Confidential · March 2026

---

## 1. The Opportunity

### Armstrong has a chance to unify its warehouse operations — and stop losing time to fragmented tools.

Today, the Armstrong warehouse runs across spreadsheets, paper BOLs, point solutions, and manual re-entry. Every handoff between systems introduces delay, error, and opacity.

The opportunity is to replace that with **one operating platform** that connects:

| From | To |
|------|----|
| Inbound freight identification | Real-time inventory |
| Inventory | Outbound fulfillment |
| Warehouse events | Clean billing in NetSuite |
| Warehouse floor | Customer self-service |

**The market gap Armstrong can fill:** existing tools are strong in only one direction. Freight-heavy platforms are legacy and operationally rigid. E-commerce platforms ignore freight complexity. Armstrong can bridge both — and build a more defensible business in the process.

---

## 2. The Armstrong Digital Ecosystem

### Each system has a clear job. The WMS is the warehouse execution layer.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ARMSTRONG DIGITAL ECOSYSTEM                      │
│                                                                      │
│  ┌───────────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │  NETSUITE ERP │  │ DISPATCH PRO│  │ ARMSTRONG WMS│  │  CRM /  │ │
│  │               │  │    (TMS)    │  │  (This proj) │  │ WEBSITE │ │
│  │  Financials   │  │  Load mgmt  │  │  Receiving   │  │ Leads   │ │
│  │  Billing/AR   │  │  Dispatch   │  │  Inventory   │  │ Quoting │ │
│  │  Contracts    │  │  Tracking   │  │  Fulfillment │  │         │ │
│  └──────┬────────┘  └──────┬──────┘  └──────┬───────┘  └────┬────┘ │
│         │                  │                 │               │      │
│  ┌──────┴──────────────────┴─────────────────┴───────────────┴────┐ │
│  │                   INTEGRATION LAYER (APIs / Events)             │ │
│  └──────┬───────────────────┬────────────────┬────────────────────┘ │
│         │                   │                │                      │
│  ┌──────┴───────┐  ┌────────┴────────┐  ┌───┴──────────────────┐   │
│  │  OPERATOR    │  │  CLIENT PORTAL  │  │  MARKETPLACE / EDI / │   │
│  │  MOBILE APP  │  │                 │  │  CARRIER INTEGRATIONS│   │
│  │  RF scanning │  │  Inventory view │  │                      │   │
│  │  Pick / pack │  │  Order status   │  │  Shopify / Amazon    │   │
│  │  Receiving   │  │  Billing / docs │  │  EDI 940/945         │   │
│  │  Cycle count │  │  Reports        │  │  UPS / FedEx / USPS  │   │
│  └──────────────┘  └─────────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Integration flows

```
WMS ──── billable events ───────► NetSuite    (receiving, storage, handling charges)
WMS ◄─── customer/rate data ───── NetSuite    (client records, contracts, rate cards)
WMS ──── ship requests ─────────► DispatchPro (LTL/FTL loads)
WMS ◄─── tracking/POD ─────────── DispatchPro (delivery confirmation)
WMS ◄─── orders ───────────────── Marketplaces (Shopify, Amazon, EDI 940)
WMS ──── tracking / inventory ──► Marketplaces (stock sync, EDI 945)
WMS ──── label requests ────────► Carrier APIs (UPS, FedEx, USPS)
WMS ──── real-time data ────────► Client Portal
Operator App ◄──────────────────► WMS (same DB, real-time via server actions)
```

### One codebase, four user experiences

```
src/app/
├── (tenant)/      ← WMS back-office  (managers, admins)
├── (operator)/    ← Mobile-first warehouse floor UI  (PWA)
├── (portal)/      ← Client-facing self-service portal
└── (platform)/    ← Superadmin / Ramola internal
```

Benefits: one database, one deployment, one set of business logic. Shared auth — the same user can hold both WMS admin and operator roles.

---

## 3. Dual-Mode Platform

### One platform. Both freight-heavy receiving and modern fulfillment.

Most systems are built for one world or the other. Armstrong needs both.

```
                       ┌─────────────────────────┐
                       │       SHARED CORE        │
                       │                          │
                       │  Inventory  ·  Products  │
                       │  Warehouse  ·  Clients   │
                       │  Audit Log  ·  Sequences │
                       └─────────┬────────────────┘
                                 │
               ┌─────────────────┴──────────────────┐
               │                                     │
      ┌────────┴──────────┐              ┌───────────┴─────────┐
      │   FREIGHT / 3PL   │              │  DTC / FULFILLMENT  │
      │                   │              │                     │
      │  Inbound ASNs     │              │  Orders             │
      │  BOL Processing   │              │  Sales Channels     │
      │  Container Recv   │              │  Pick Tasks         │
      │  Customs / HS     │              │  Packing            │
      │  Discrepancies    │              │  Outbound Shipments │
      │  Inspections      │              │  Carrier Rate Shop  │
      └───────────────────┘              └─────────────────────┘
```

A single tenant can run both simultaneously — receiving containers from overseas while shipping DTC orders from the same warehouse.

---

## 4. Full Lifecycle: Identification to Cash

### Every service Armstrong provides maps to a tracked, billable event.

```
  IDENTIFY       RECEIVE        STORE          FULFILL          BILL
  ────────       ───────        ─────          ───────          ────

CRM/Website ──► Lead/Quote
                   │
NetSuite ◄──── Customer ──────────────── Rate Card ──────────────────► Invoice
                   │                         │                             ▲
                   ▼                         ▼                             │
WMS ◄──────── Client ◄──── ASN ────► Inventory ────► Orders ────► Billable Events
                               ▲         │    ▲          │               │
                               │         │    │          ▼               │
DispatchPro ◄── Dock Appt ────┘   Counts │  Picks ───► Ship ────────────┘
                                         │
Operator App ◄────────────── Receive ────┘  Pick / Pack

Client Portal ◄──── View Inventory ─────── Place Orders ─── View Invoices
```

### Billable events by phase

| Phase | Events | Example Rate |
|-------|---------|-------------|
| **Receiving** | Pallet unloaded, carton handled, special handling | $8.50/pallet |
| **Storage** | Pallet positions/day, climate-controlled premium | $12/pallet/mo |
| **Fulfillment** | Pick & pack per order, per unit, kitting, rush | $3.50/order + $0.50/line |
| **Shipping** | Carrier cost + markup, same-day premium | Cost + 15% |

All events flow from WMS → NetSuite for invoice generation on the client's billing cycle (weekly or monthly).

---

## 5. Inbound: The Receiving Flow

### Freight reality starts at the dock. ASN-driven, discrepancy-aware, audit-complete.

#### Status workflow

```
  ┌───────┐    ┌──────────┐    ┌─────────┐    ┌───────────┐    ┌────────────┐    ┌───────────┐
  │ DRAFT │───►│ EXPECTED │───►│ ARRIVED │───►│ RECEIVING │───►│ INSPECTION │───►│ COMPLETED │
  └───────┘    └──────────┘    └─────────┘    └───────────┘    └────────────┘    └───────────┘
                                                                                       │
                                                                                       ▼
                                                                             Inventory Created
                                                                             Ledger Updated
```

Any status can transition to `CANCELLED`.

#### Step-by-step

| Step | Who | What |
|------|-----|------|
| 1. Create ASN | Manager | Register shipment: client, carrier, BOL, PO, expected date |
| 2. Add line items | Manager | Add expected products, quantities, UOM |
| 3. Mark Expected | Manager | Confirm and notify warehouse |
| 4. Mark Arrived | Worker / Manager | Record physical dock arrival |
| 5. Receive items | Warehouse worker | Quantity, condition, bin, lot/serial |
| 6. Log discrepancies | Worker / Manager | Shortage, overage, damage — tracked to resolution |
| 7. Inspect (optional) | Worker | Pass/fail checklist, measurements, observations |
| 8. Complete | Manager | Finalize → create inventory records + transactions |

#### Discrepancy tracking

```
Types:  shortage · overage · damage
Status: open → investigating → resolved → closed
```

Every action creates an immutable `audit_log` entry. Receiving report can be generated for each completed shipment.

---

## 6. AI-Powered Document Intelligence

### The biggest bottleneck in receiving isn't the dock — it's the paper.

Every day, staff manually key data from BOLs, packing lists, and invoices. This is:

- **Slow** — 10–15 minutes per BOL, dozens per day
- **Error-prone** — transposition errors, missed fields, wrong PO linkage
- **A bottleneck** — receiving can't start until the ASN is keyed, trucks wait

#### The solution: Scan → Extract → Verify → Post

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐
│   CAPTURE    │───►│     EXTRACT      │───►│      VERIFY      │───►│     POST     │
│              │    │                  │    │                  │    │              │
│ Phone camera │    │ Claude Vision AI │    │ Side-by-side UI  │    │ Create ASN   │
│ Scanner      │    │ Structured JSON  │    │ Low-confidence   │    │ Add lines    │
│ Email attach │    │ + confidence     │    │ fields flagged   │    │ Attach doc   │
│ Fax / PDF    │    │ scores per field │    │ Tab/Enter to     │    │ Audit trail  │
│ EDI          │    │                  │    │ confirm          │    │              │
└─────────────┘    └──────────────────┘    └──────────────────┘    └──────────────┘
```

#### Human review UI — "Smart Receiving"

```
┌──────────────────────────────────────────────────────────────────┐
│  Smart Receiving — BOL-2026-04821                      ✕ Close   │
│                                                                   │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐ │
│  │                         │  │ Extracted Data                 │ │
│  │  [Original BOL Image]   │  │                                │ │
│  │                         │  │ BOL #:     BOL-2026-04821 ✓98% │ │
│  │  ← Page 1 of 2 →        │  │ Carrier:   XPO Logistics  ✓95% │ │
│  │                         │  │ PRO #:     3849271056     ✓92% │ │
│  │  [Zoom]  [Rotate]       │  │ Client:    ACME Corp      ✓97% │ │
│  │                         │  │ PO #:      PO-2026-1234   ✓90% │ │
│  │                         │  │ Pieces:    24 pallets     ✓85% │ │
│  │                         │  │ Weight:    18,450 LB      ⚠72% │ │
│  │                         │  │ Seal #:    [unclear]      ✗35% │ │
│  │                         │  │                                │ │
│  │                         │  │ Line Items:                    │ │
│  │                         │  │ 1. Widget-001 × 500      ✓91% │ │
│  │                         │  │ 2. Gadget-001 × 200      ✓89% │ │
│  │                         │  │ 3. [unclear]  × 100      ⚠45% │ │
│  │                         │  │                                │ │
│  └─────────────────────────┘  │ ⚠ 2 fields need review        │ │
│                                └────────────────────────────────┘ │
│  [Skip]           [Save Draft]              [Create ASN →]        │
└──────────────────────────────────────────────────────────────────┘

Legend:  ✓ High confidence (>80%)   ⚠ Needs review (40–80%)   ✗ Low (<40%)
```

#### Before vs. after

| | Manual | With Document Intelligence |
|-|--------|--------------------------|
| Time per BOL | 10–15 min | 1–2 min (review only) |
| Error rate | 3–5% | <1% (AI + human verify) |
| BOLs/day (1 person) | 30–40 | 200+ |
| Cost per document | ~$3–5 (labor) | ~$0.10–0.30 (API) |
| Dock-to-receiving | 15–25 min | 2–5 min |

**At 100 BOLs/day:** $80K–$140K/year in savings per facility.

#### Capture methods

| Method | Use case |
|--------|----------|
| Phone camera | Operator at dock photographs BOL from driver |
| Scanner | Office staff scans multi-page BOL/packing list |
| Email attachment | Client emails BOL/PO — auto-processed to review queue |
| WMS upload | Drag-and-drop from back-office |
| EDI | Structured data, no OCR needed — creates ASN directly |

---

## 7. Outbound: The Fulfillment Flow

### One platform. Multiple channels. Every order from ingestion to delivered.

#### Order status workflow

```
  ┌─────────┐    ┌──────────────────────┐    ┌───────────┐    ┌─────────┐
  │ PENDING │───►│ AWAITING_FULFILLMENT │───►│ ALLOCATED │───►│ PICKING │
  └─────────┘    └──────────────────────┘    └───────────┘    └────┬────┘
                                                                    │
  ┌───────────┐    ┌────────┐    ┌─────────┐    ┌─────────┐        │
  │ DELIVERED │◄───│SHIPPED │◄───│  PACKED │◄───│ PACKING │◄───────┘
  └───────────┘    └────────┘    └─────────┘    └─────────┘   via PICKED

  Exceptions:  → CANCELLED  |  → ON_HOLD  |  → BACKORDERED
```

#### Order intake sources

```
┌──────────┐
│  Shopify │──┐
└──────────┘  │   ┌──────────────────┐     ┌────────────────┐
┌──────────┐  ├──►│  Armstrong WMS   │────►│ orders table   │
│  Amazon  │──┤   │  Order Intake    │     │ order_lines    │
└──────────┘  │   └──────────────────┘     └────────────────┘
┌──────────┐  │
│  Walmart │──┤
└──────────┘  │
┌──────────┐  │
│  EDI 940 │──┘
│  Manual  │
└──────────┘
```

#### Pick methods

| Method | Best for |
|--------|---------|
| Single Order | Low volume, simple operations |
| Batch Picking | Multiple orders combined into one walk |
| Wave Picking | Time-boxed batches by zone / carrier / priority |
| Zone Picking | Each picker owns a zone, consolidated at packing |

#### Shipping decision tree

```
PARCEL (DTC):
  Rate shop UPS / FedEx / USPS → auto-select → generate label → push tracking to channel

LTL / FTL (B2B):
  Create BOL → route to DispatchPro → carrier booking → tracking via DispatchPro

WHITE GLOVE:
  Route to DispatchPro → driver assigned → POD captured on delivery
```

#### Fulfillment KPIs

| Metric | Description |
|--------|-------------|
| Orders pending | Not yet allocated |
| Pick tasks in progress | Active picking work |
| Average pick time | Task creation → completion |
| Packing throughput | Orders packed per hour |
| Ship-by compliance | % shipped before ship-by date |
| Carrier cost/order | Average shipping spend per order |

---

## 8. User Experiences

### Different users work in the same platform through role-specific interfaces.

#### Four distinct experiences

| Experience | Users | Key actions |
|------------|-------|-------------|
| **WMS Back-Office** | Warehouse managers, admins | Full CRUD on clients, products, receiving, inventory, orders, reports, settings |
| **Operator App** (mobile/PWA) | Warehouse floor workers | Receive, pick, pack, move inventory, cycle count — barcode scanner optimized |
| **Client Portal** | Cargo owners / customers | Real-time inventory visibility, order placement, shipment tracking, invoices, reports |
| **Platform Admin** | Ramola (Cisco) | Tenant management, provisioning, cross-tenant billing dashboard |

#### Operator App — floor execution

```
Operator actions available on a tablet or scanner device:

  /receive  → Scan BOL barcode → pull up ASN → receive line by line
  /pick     → Receive pick task → optimized walk route → scan bin → scan product → confirm qty
  /pack     → Scan order at packing station → verify items → select box → weigh → apply label
  /move     → Bin-to-bin transfers
  /count    → Cycle count execution → generate variance for approval
```

#### Client Portal — customer self-service

```
  /portal/inventory   → Real-time stock by product, location, lot, status
  /portal/orders      → Place and track outbound orders
  /portal/shipments   → Inbound + outbound tracking
  /portal/billing     → Invoices with line-item detail, activity breakdown
  /portal/reports     → Download CSV/PDF inventory and activity reports
```

---

## 9. Architecture

### Built for multi-client warehouse operations with strong data isolation.

#### System overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       Armstrong WMS                              │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Next.js  │  │  Prisma  │  │ NextAuth │  │   MinIO/S3   │   │
│  │ App Router│  │   ORM    │  │   v5     │  │   Storage    │   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └──────┬───────┘   │
│        │              │              │               │           │
│  ┌─────┴──────────────┴──────────────┴───────────────┴─────┐   │
│  │              Middleware: Tenant Resolution · Auth · RBAC  │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────┴──────────────────────────────┐   │
│  │                     PostgreSQL 16                         │   │
│  │                                                           │   │
│  │  ┌──────────┐  ┌────────────────┐  ┌────────────────┐   │   │
│  │  │  public   │  │ tenant_acme    │  │ tenant_demo    │   │   │
│  │  │  schema   │  │    schema      │  │    schema      │   │   │
│  │  └──────────┘  └────────────────┘  └────────────────┘   │   │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### Multi-tenancy: schema-per-tenant

| Approach | Isolation | Complexity | Cost |
|----------|-----------|------------|------|
| Shared tables (row-level) | Low | Low | Lowest |
| **Schema-per-tenant** ✅ | **High** | Medium | Medium |
| Database-per-tenant | Highest | High | Highest |

Each client's data lives in a separate PostgreSQL schema (`tenant_armstrong`). Cross-tenant data leaks are structurally impossible.

#### RBAC model

```
User ──M:N──► TenantUser(role) ──M:1──► Tenant

Roles:  admin · manager · warehouse_worker · viewer

Permission check:
  requirePermission(tenantSlug, "inventory:write")
    → resolve tenant access
    → check role against permission map
    → throw if insufficient
```

#### Immutable transaction ledger

Every inventory change creates an `inventory_transaction` record. Current state can always be rebuilt from the ledger.

```
Type       │ From Bin │ To Bin  │ Qty  │ Reference
───────────┼──────────┼─────────┼──────┼──────────────────
receive    │ —        │ A-01    │  100 │ ASN-2026-0001
putaway    │ STAGING  │ B-05    │   50 │ —
move       │ B-05     │ C-01    │   25 │ —
pick       │ C-01     │ —       │   10 │ ORD-2026-0042
adjust     │ —        │ A-01    │   -2 │ ADJ-2026-0003
```

#### Key tech decisions

| Decision | Rationale |
|----------|-----------|
| Server Components first | Minimize client JS, data at the edge |
| Server Actions for mutations | Type-safe, no API routes needed, auto-revalidation |
| URL state for filters | Shareable views, works with SSR |
| Cursor pagination | O(1) vs O(n) for large inventory tables |
| Pre-signed URL uploads | Client uploads directly to MinIO — server never buffers files |
| JsBarcode (Code128) | Industry standard for warehouse bin labels |

---

## 10. Competitive Position

### Armstrong's target: the space neither Logiwa nor Magaya fills.

```
                      FREIGHT / CUSTOMS DEPTH
                              ▲
                              │
                    Magaya ●  │
                              │
                              │   ● Armstrong WMS
                              │     (target position)
                              │
           ───────────────────┼────────────────────► FULFILLMENT / DTC
                              │
         3PL WM (Extensiv) ●  │
                              │         ● Logiwa
                              │
              NetSuite WMS ●  │
                              │
```

#### Head-to-head

| Competitor | Strength | Weakness | Armstrong advantage |
|------------|----------|----------|---------------------|
| **Logiwa** | E-commerce fulfillment | Not built for freight receiving | Freight-depth + fulfillment in one |
| **Magaya** | Deep freight/customs | Legacy UI, no DTC fulfillment | Modern stack + fulfillment layer |
| **NetSuite WMS** | ERP-native | Not purpose-built for 3PL multi-client | Native multi-tenant + freight domain |
| **Extensiv (3PL WM)** | 3PL-focused billing | No freight forwarding, aging platform | Dual-mode + self-hosted option |

#### Target customer profile

- 3PL operators with 1–10 warehouse facilities
- Handle both freight (containers, pallets, BOL-based) and fulfillment (DTC/B2C)
- Currently on Magaya, legacy WMS, or spreadsheets
- Want modern UI, lower cost, and integrated fulfillment
- On or planning NetSuite for financials
- Need multi-client inventory segregation and activity-based billing

---

## 11. Phased Roadmap

### A practical sequence that stacks value incrementally.

#### What's built today (as of March 2026)

The platform has **56 routes across 4 apps**, **140 tests** (124 unit + 16 E2E), a **live Shopify integration**, and runs on real PostgreSQL in Docker.

| Area | Status |
|------|--------|
| WMS UI Shell (sidebar, breadcrumbs, search Cmd+K, notifications) | ✅ Done |
| Dashboard — KPI cards, charts, activity feed | ✅ Done |
| Clients, Products, Warehouse CRUD | ✅ Done |
| Receiving — shipment list, detail, receive dialog, document upload | ✅ Done |
| Fulfillment — order list, detail, timeline, create form | ✅ Done |
| Picking — task list, KPIs, assignment | ✅ Done |
| Shipping — outbound table, detail, tracking timeline, label reprint | ✅ Done |
| Inventory — stock browser, movement ledger, adjustments, cycle counts | ✅ Done |
| Reports — 5 tabs, charts, CSV/PDF export | ✅ Done |
| Settings — operational modes, sequences, users, carriers, integrations, EDI config | ✅ Done |
| Operator App — receive, pick, pack, move, count (mobile, barcode scanner) | ✅ Done |
| Client Portal — inventory, orders, shipments, billing, reports | ✅ Done |
| Superadmin Platform — tenant management, billing overview | ✅ Done |
| Auth — NextAuth v5, JWT, RBAC (4 roles) | ✅ Done |
| Integration stubs — Shopify (LIVE), Amazon, UPS, FedEx, USPS, NetSuite, DispatchPro | ✅ Done |
| CI/CD — GitHub Actions: typecheck → lint → test → build | ✅ Done |
| Dockerfile — multi-stage, standalone output | ✅ Done |

#### Remaining phases

| Phase | Focus | Status |
|-------|-------|--------|
| **B** | Complete workflow loops (receiving, fulfillment, inventory with real DB mutations) | 🔲 Next |
| **D** | Wire real integrations — UPS/FedEx/USPS labels, Shopify orders, NetSuite billing bridge | 🔲 Needs API credentials |
| **E** | Operator App polish — PWA, offline queue, scanner integration | 🔲 Remaining |
| **G** | Billing config — rate cards per client | 🔲 Remaining |
| **H** | Hardening — integration tests, security audit, performance pagination | 🔲 Remaining |

**Estimated remaining to production: ~8–12 weeks**

#### Build sequence

```
Phase 1  Core WMS foundation, receiving, inventory, warehouse controls
Phase 2  Operator mobile workflows and discrepancy-driven receiving
Phase 3  Fulfillment, carrier integrations, outbound tracking
Phase 4  Client portal, billing-event export, NetSuite operational integration
Phase 5  Document intelligence, marketplace connectors, deeper automation
```

---

## 12. What This Unlocks for Armstrong

### This is not just software replacement. It's a better operating model.

| Today | With Armstrong WMS |
|-------|-------------------|
| Manual BOL keying: 15–25 min per shipment | AI-assisted review: 1–2 min per shipment |
| Inventory accuracy dependent on paper | Real-time tracked by client, bin, lot, serial |
| Billing reconciled from spreadsheets | Every warehouse event → automatic billable record |
| Customers call for status updates | Self-service portal with real-time visibility |
| Separate tools for freight and fulfillment | One platform, one data model, one source of truth |
| Data entry staff for documents | Reviewer of exceptions — output 5× more |

**Strategic outcomes:**
- Faster receiving with fewer manual bottlenecks
- Better inventory accuracy and traceability across all clients
- Scalable fulfillment without adding disconnected tools
- Stronger customer experience through self-service
- Cleaner handoff of warehouse billable events into NetSuite
- Better readiness for growth across facilities, customers, and service lines

---

## 13. Next Priorities

### Near-term (next 4–6 weeks)

1. **Complete receiving workflow** — full status loop with real DB mutations, discrepancy auto-detection, inspection checklists
2. **Complete fulfillment workflow** — allocation → pick → pack → ship with real DB, inventory decrements
3. **Complete inventory workflow** — putaway rules engine, adjustment approval, cycle count to variance
4. **Billing config** — rate cards per client, per service line

### Integration queue (need API credentials)

| Integration | What's needed |
|-------------|--------------|
| Shopify | Replace mock returns with real REST API calls |
| UPS | developer.ups.com credentials |
| FedEx | developer.fedex.com credentials |
| USPS | usps.com/business/web-tools registration |
| NetSuite | Sandbox credentials for billing bridge (SuiteTalk/SuiteScript) |
| DispatchPro | API docs for TMS integration |

### Armstrong onboarding data

- [ ] Import product catalog (CSV → `tenant_armstrong.products`)
- [ ] Import warehouse layout (zones, aisles, racks, shelves, bins)
- [ ] Import client list
- [ ] NetSuite sandbox for billing integration testing

---

## Appendix: Source Documents

| Document | Content |
|----------|---------|
| `architecture.md` | System architecture, multi-tenancy, auth, data model, tech decisions |
| `ecosystem.md` | Full digital ecosystem map, 6 applications, integration flows |
| `competitive-analysis.md` | Head-to-head vs. Logiwa, Magaya, NetSuite WMS, Extensiv |
| `flow-receiving.md` | ASN status workflow, step-by-step receiving, sequence diagram |
| `flow-fulfillment.md` | Order intake, allocation, pick/pack/ship, KPIs |
| `flow-identification-to-cash.md` | Full lifecycle from lead to invoice, billable events per phase |
| `document-intelligence.md` | AI OCR pipeline, BOL extraction, ROI analysis |
| `wms-roadmap.md` | What's built, remaining phases, priority order |
| `next-steps.md` | Production setup, integration wiring, Armstrong onboarding |
| `armstrong-overview-presentation.md` | Original leadership overview deck |
