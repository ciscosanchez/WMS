# Identification to Cash — Full User Flow

## Overview

This document maps the complete Ramola service lifecycle from first customer contact through revenue collection. Each phase identifies which system owns the workflow and what data flows between systems.

---

## Phase 1: Identify & Sell

**Owner: Sales CRM (NetSuite CRM or HubSpot) + goarmstrong.com**

```
Prospect finds Ramola
  │  (website, referral, trade show, RFP)
  ▼
Lead captured in CRM
  │
  ▼
Qualification & Needs Assessment
  │  • Warehousing volume (pallets, sq ft)
  │  • Fulfillment volume (orders/day)
  │  • Service requirements (kitting, labeling, temp-controlled)
  │  • Inbound/outbound transportation needs
  │  • Integration requirements (EDI, marketplace, ERP)
  ▼
Generate Quote / Proposal
  │  Rate card:
  │  • Receiving: $X per pallet unloaded
  │  • Storage: $X per pallet/month or $X per sq ft/month
  │  • Handling: $X per order + $X per line + $X per unit picked
  │  • Value-add: $X per kitting job, $X per label
  │  • Shipping: carrier cost + X% markup or flat fee
  │  • Minimums: monthly minimum billing
  ▼
Contract Signed
  │
  ▼
Customer Onboarded
```

### System Actions

- **CRM**: Lead → Opportunity → Quote → Won → Customer record
- **NetSuite**: Customer record created, rate card/contract terms stored, billing schedule established
- **WMS**: Client created in tenant, warehouse space allocated, products/SKUs loaded

### Gap: Self-Service Quoting

Ramola currently requires manual consultation for quoting. A future self-service quoting calculator on the website (input volume, services → instant estimate) would accelerate the sales cycle.

---

## Phase 2: Receive & Store

**Owner: Ramola WMS (Receiving) + DispatchPro + Operator App**

```
Customer's freight is inbound
  │  (container from port, pallets from manufacturer, parcels from supplier)
  │
  ▼
┌─ DISPATCH PRO ──────────────────────────────┐
│  Carrier scheduled for delivery              │
│  Dock appointment booked (Yard Management)   │
│  Driver dispatched → real-time tracking      │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ ARMSTRONG WMS ──────────────────────────────┐
│  ASN created (from PO, EDI 940, or manual)   │
│  Truck arrives → checked in at gate          │
│  Assigned to dock door                        │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ OPERATOR MOBILE APP ────────────────────────┐
│  1. Scan BOL barcode → pull up ASN            │
│  2. Verify trailer seal number                │
│  3. Unload & receive line by line:            │
│     • Scan product barcode                    │
│     • Enter/confirm quantity                  │
│     • Select condition (good/damaged/hold)    │
│     • Photo damaged items                     │
│     • Enter lot/serial if tracked             │
│  4. Scan bin barcode → putaway to location    │
│  5. Sign off on receiving                     │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ POST-RECEIVING ─────────────────────────────┐
│  WMS: Inventory records created               │
│  WMS: Discrepancies flagged (short/over/dmg)  │
│  WMS: Receiving report generated              │
│  WMS → NetSuite: Receiving charges posted     │
│    • Per pallet unloaded                      │
│    • Per carton handled                       │
│    • Special handling fees                    │
│  Client Portal: Receiving confirmation sent   │
└──────────────────────────────────────────────┘
```

### Billable Events Generated

| Event               | Rate Basis     | Example                          |
| ------------------- | -------------- | -------------------------------- |
| Pallet unloaded     | Per pallet     | $8.50/pallet × 24 pallets = $204 |
| Carton handled      | Per carton     | $0.45/carton × 120 cartons = $54 |
| Special handling    | Per occurrence | Temp check, photo inspection     |
| Sorting/segregation | Per hour       | $35/hr × 2 hrs = $70             |

---

## Phase 3: Store & Manage

**Owner: Ramola WMS (Inventory) + Client Portal**

```
┌─ DAILY WAREHOUSE OPERATIONS ─────────────────┐
│                                                │
│  Storage billing accrues daily                 │
│  │  Per pallet position occupied               │
│  │  Per sq ft of floor space used              │
│  │  Per cubic ft (for irregular items)         │
│  │  Tiered by zone (ambient/cold/hazmat)       │
│                                                │
│  Cycle counting (per plan)                     │
│  │  ABC analysis → count high-value more often │
│  │  Adjustments → approval workflow            │
│  │  Shrinkage reporting                        │
│                                                │
│  Replenishment moves                           │
│  │  Bulk → pick face                           │
│  │  Cross-dock if applicable                   │
│                                                │
│  Inventory alerts                              │
│  │  Low stock → notify client                  │
│  │  Expiration approaching (lot tracking)      │
│  │  Damaged hold → client resolution needed    │
│                                                │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ CLIENT PORTAL ──────────────────────────────┐
│  Real-time inventory visibility               │
│  │  By product, location, lot, status          │
│  │  Historical snapshots                       │
│  Download inventory reports (CSV/PDF)          │
│  Place manual outbound orders                  │
│  View receiving confirmations                  │
│  Track inbound shipments                       │
└──────────────────────────────────────────────┘
```

### Billable Events Generated

| Event              | Rate Basis         | Example                            |
| ------------------ | ------------------ | ---------------------------------- |
| Pallet storage     | Per pallet/month   | $12/pallet × 200 pallets × 30 days |
| Floor space        | Per sq ft/month    | $0.85/sq ft × 5,000 sq ft          |
| Climate-controlled | Premium per pallet | $18/pallet (vs $12 ambient)        |

---

## Phase 4: Fulfill & Ship

**Owner: Ramola WMS (Fulfillment) + Operator App + Carrier APIs + DispatchPro**

```
Orders arrive from multiple sources simultaneously:

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Client Portal│ Shopify/AMZ  │  EDI 940     │  API/Manual  │
│ (manual)     │ (marketplace)│ (enterprise) │  (B2B)       │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘
       └──────────────┴──────────────┴──────────────┘
                             │
                             ▼
┌─ ARMSTRONG WMS (Order Management) ────────────┐
│  1. Order ingested & validated                 │
│  2. Inventory allocated (FIFO, FEFO, or LIFO) │
│  3. Orders batched by carrier/priority/zone    │
│  4. Pick tasks generated                       │
│     • Single order (low volume)                │
│     • Batch pick (multiple orders, one walk)   │
│     • Wave pick (time-boxed batches)           │
│     • Zone pick (picker per zone)              │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ OPERATOR MOBILE APP (Picking) ──────────────┐
│  1. Receive pick task on device               │
│  2. Optimized walk route displayed            │
│  3. For each line:                            │
│     • Navigate to bin (scan to confirm)       │
│     • Scan product barcode                    │
│     • Confirm quantity                        │
│     • Handle short pick (flag, skip, sub)     │
│  4. Deliver to packing station                │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ OPERATOR MOBILE APP (Packing) ──────────────┐
│  1. Scan order at packing station             │
│  2. Verify all items present                  │
│  3. Select/auto-suggest box size              │
│  4. Value-add services:                       │
│     • Kitting / bundling                      │
│     • Custom labeling / inserts               │
│     • Gift wrapping                           │
│  5. Weigh package → record dimensions         │
│  6. Apply packing slip                        │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ SHIPPING DECISION ──────────────────────────┐
│                                               │
│  PARCEL (DTC / e-commerce):                   │
│  ├── Rate shop: UPS vs FedEx vs USPS          │
│  ├── Auto-select cheapest for service level   │
│  ├── Generate label → print                   │
│  ├── Tracking # → push to marketplace/client  │
│  └── Manifest → end-of-day carrier pickup     │
│                                               │
│  LTL / FTL (B2B / wholesale):                 │
│  ├── Create BOL                               │
│  ├── Route to DispatchPro for carrier booking  │
│  ├── Schedule pickup                           │
│  └── Tracking via DispatchPro                  │
│                                               │
│  LAST-MILE (white glove):                     │
│  ├── Route to DispatchPro                     │
│  ├── Driver assigned, route optimized         │
│  └── POD captured on delivery                 │
│                                               │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ POST-SHIPMENT ──────────────────────────────┐
│  WMS: Order status → shipped                  │
│  WMS → Marketplace: Tracking number pushed    │
│  WMS → Client Portal: Shipment visible        │
│  Carrier: Delivery confirmation / POD          │
│  WMS: Order status → delivered                 │
│  WMS → NetSuite: Fulfillment charges posted    │
└──────────────────────────────────────────────┘
```

### Billable Events Generated

| Event            | Rate Basis             | Example                  |
| ---------------- | ---------------------- | ------------------------ |
| Pick & pack      | Per order + per line   | $3.50/order + $0.50/line |
| Per unit picked  | Per unit (high volume) | $0.15/unit × 500 units   |
| Kitting/assembly | Per kit                | $2.00/kit                |
| Custom labeling  | Per label              | $0.25/label              |
| Shipping         | Carrier cost + markup  | Cost + 15% or flat rate  |
| Rush/same-day    | Premium multiplier     | 1.5× standard handling   |

---

## Phase 5: Bill & Collect

**Owner: NetSuite ERP + WMS Billing Engine + Client Portal**

```
┌─ WMS BILLING ENGINE ─────────────────────────┐
│  Continuously captures billable events:        │
│                                                │
│  Receiving events (Phase 2)                    │
│  ├── Pallets unloaded                          │
│  ├── Cartons handled                           │
│  └── Special handling                          │
│                                                │
│  Storage events (Phase 3)                      │
│  ├── Daily pallet/sq ft snapshots              │
│  └── Zone-based rates applied                  │
│                                                │
│  Fulfillment events (Phase 4)                  │
│  ├── Orders picked & packed                    │
│  ├── Lines / units handled                     │
│  ├── Value-add services performed              │
│  └── Shipping charges                          │
│                                                │
│  Apply rate card from contract                 │
│  Calculate totals per billing period           │
│  Push to NetSuite                              │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ NETSUITE ERP ───────────────────────────────┐
│  Invoice generated per billing cycle           │
│  │  Weekly (high-volume fulfillment clients)   │
│  │  Monthly (storage-heavy clients)            │
│  │  Per-transaction (pass-through shipping)     │
│                                                │
│  Invoice line items:                           │
│  │  Receiving charges:          $328.00        │
│  │  Storage (200 pallets):    $2,400.00        │
│  │  Pick & pack (450 orders): $2,175.00        │
│  │  Shipping:                 $3,892.50        │
│  │  Value-add services:         $125.00        │
│  │  ─────────────────────────────────          │
│  │  Total:                    $8,920.50        │
│                                                │
│  Payment collected                             │
│  │  ACH / wire / credit card / check           │
│  │  Net 30 terms (configurable)                │
│                                                │
│  Revenue recognized                            │
│  P&L reports by:                               │
│  │  Client                                     │
│  │  Warehouse / facility                       │
│  │  Service line                               │
│  │  Time period                                │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌─ CLIENT PORTAL ──────────────────────────────┐
│  View invoices with line-item detail           │
│  Download billing reports (CSV/PDF)            │
│  Activity-based billing breakdown              │
│  Pay online (Stripe/ACH integration)           │
│  Dispute resolution workflow                   │
└──────────────────────────────────────────────┘
```

---

## Data Flow Summary

```
                    IDENTIFY          RECEIVE          STORE           FULFILL          BILL
                    ────────          ───────          ─────           ───────          ────
CRM/Website ──────► Lead/Quote
                        │
NetSuite ◄──────────── Customer ──────────────── Rate Card ──────────────────────► Invoice
                        │                           │                                 ▲
                        ▼                           ▼                                 │
WMS ◄─────────────── Client ◄──── ASN ────► Inventory ────► Orders ────► Billable Events
                                    ▲           │    ▲          │              │
                                    │           │    │          ▼              │
DispatchPro ◄───── Dock Appt ──────┘    Counts  │    Picks ──► Ship ──────────┘
                                        Alerts  │    Packs      │
                                          │     │      │        │
Operator App ◄────────────────── Receive ─┘  Count  Pick/Pack   │
                                                                │
Client Portal ◄──────────────── View Inventory ── Place Orders ─┤
                                View Reports       Track Orders  │
                                                   View Invoices ┘
```

---

## Gaps & Priorities

### High Priority (Blocks Revenue)

1. **WMS → NetSuite Billing Bridge** — Without this, billable events aren't invoiced
2. **Client Portal** — Customers need self-service visibility (competitive requirement)
3. **Operator Mobile App** — Warehouse workers need floor-optimized scanning UI

### Medium Priority (Enables Growth)

4. **Marketplace Connectors** — Shopify/Amazon unlock e-commerce fulfillment revenue
5. **Carrier Integrations** — UPS/FedEx/USPS label generation for parcel fulfillment
6. **Yard Management** — Dock scheduling for high-volume facilities

### Lower Priority (Optimization)

7. **Self-Service Quoting** — Website calculator to accelerate sales cycle
8. **Advanced Analytics** — Warehouse productivity, SLA compliance, cost analysis
9. **EDI 940/945** — Enterprise customer integration standard
10. **Returns Processing** — Reverse logistics workflow
