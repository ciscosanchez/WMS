# Ramola WMS — Competitive Position Assessment

_Last updated: 2026-03-24_

## Magic Quadrant: WMS Market Positioning

```
                  ENTERPRISE CAPABILITY (optimization, automation, scale)
                              ▲
                              │
            Manhattan ●       │       ● SAP EWM
           (leader)           │         (leader)
                              │
          Blue Yonder ●       │    ● Oracle WMS Cloud
                              │
                   Korber ●   │  ● Infor WMS
                              │
               ───────────────┼──────────────────► 3PL / MID-MARKET FIT
                              │
                  Deposco ●   │   ● Ramola WMS
                              │     (you are here)
              Magaya ●        │        ● Extensiv
              (freight)       │          (3PL billing)
                              │
                              │  ● Logiwa    ● ShipHero
                              │  (DTC/eco)     (simple)
                              │
```

## Where Ramola Sits

**Strongest differentiator**: unified freight + fulfillment in one platform with modern stack and real tenant isolation. No other mid-market WMS covers both.

**Competitive neighborhood**: between Deposco (similar breadth, better optimization) and Extensiv (better billing ops, weaker tech). Ahead of Magaya on tech, behind on customs depth. Ahead of Logiwa on freight, behind on ecosystem breadth.

---

## Validated Strengths (confirmed in codebase)

| Capability                            | Evidence                                                          | Competitor Comparison                 |
| ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| **Dual-mode (freight + fulfillment)** | BOL receiving + DTC pick/pack/ship in same schema                 | No mid-market competitor does both    |
| **Multi-tenant isolation**            | Schema-per-tenant, AES-256-GCM secrets, 30+ RBAC permissions      | Ahead of Extensiv, Logiwa, Magaya     |
| **Modern stack**                      | Next.js 15, Prisma, BullMQ, TypeScript, 382 tests                 | Most competitors are legacy .NET/Java |
| **Operator PWA**                      | Offline-first, barcode scanning, high-contrast, clock-in/out      | Most charge extra for mobile          |
| **Yard & Dock**                       | Appointments, Gantt calendar, yard map, driver check-in           | Matches Manhattan-tier feature        |
| **Labor Management**                  | Shift tracking, task time logging, UPH, cost-per-unit billing     | Matches Extensiv-tier                 |
| **Returns/RMA**                       | Full lifecycle with inspection + disposition + inventory re-entry | Table stakes, well-implemented        |
| **Cartonization**                     | FFD bin-packing algorithm with carton catalog                     | Matches Oracle/Infor-tier             |
| **Slotting**                          | ABC velocity + multi-factor scoring + BullMQ async jobs           | Good foundation                       |
| **Task Interleaving**                 | Combined pick/putaway routes by bin proximity                     | Manhattan/SAP-tier concept            |
| **89 routes, 67 schema models**       | Real implementation, not stubs                                    | Substantial codebase                  |

---

## Actual Gaps (validated by external audit + competitive research)

### Tier 1: Revenue Blockers

| #   | Gap                                                                                                                                        | Behind Who                             | Impact                                                       | Effort    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------ | --------- |
| 1   | **Billing operations workbench** — charge adjustments, billing review/approval, dispute handling, exportable invoice PDFs, client delivery | Extensiv                               | Disqualifier for 3PL sales                                   | 3-4 weeks |
| 2   | **Lot/expiration/FEFO** — no expiration date field, no FEFO/FIFO enforcement in picking, no recall workflow                                | Manhattan, SAP, Oracle, Infor, Deposco | Disqualifier for food/pharma/cosmetics 3PLs (40%+ of market) | 2-3 weeks |
| 3   | **Multi-warehouse / multi-site** — no transfer orders, no cross-facility visibility, no order routing                                      | Oracle, Manhattan, ShipHero, Logiwa    | Disqualifier for growth-stage 3PLs                           | 6-8 weeks |

### Tier 2: Competitive Differentiators

| #   | Gap                                                                                                      | Behind Who                        | Impact                             | Effort            |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------- | ----------------- |
| 4   | **Customs/freight depth** — no ISF, ACE, broker workflows, customs filing, bonded inventory              | Magaya                            | Blocks freight-forward positioning | 6-8 weeks         |
| 5   | **Marketplace breadth** — only Shopify + Amazon; missing Walmart, WooCommerce, BigCommerce, eBay, TikTok | Logiwa (240+), Extensiv, ShipHero | Limits 3PL client onboarding       | 1-2 weeks/channel |
| 6   | **LPN/container tracking** — no pallet-level receive/move/pick                                           | SAP, Manhattan, Oracle, Infor     | Blocks B2B/wholesale warehouse ops | 3-4 weeks         |
| 7   | **GS1/SSCC compliance labels** — no GS1-128 generation, no retailer label templates                      | SAP, Manhattan, Oracle            | Blocks retail compliance 3PLs      | 2-3 weeks         |

### Tier 3: Enterprise Maturity

| #   | Gap                                                                                                                                         | Behind Who                     | Impact                               | Effort     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------ | ---------- |
| 8   | **Optimization engine** — no wave engine, labor standards, workload balancing, rules-driven orchestration; productivity trend data is empty | Manhattan, Blue Yonder, Oracle | Limits throughput optimization value | 4-8 weeks  |
| 9   | **Automation execution** — device registry exists but no command/telemetry loop, PLC/WCS protocol, mission dispatch, heartbeat supervision  | SAP EWM, Manhattan, Korber     | Blocks automation-forward warehouses | 8-12 weeks |
| 10  | **Report export & scheduling** — no PDF/CSV/Excel export, no scheduled reports, no custom dashboards                                        | All competitors                | Expected table-stakes feature        | 2-3 weeks  |

### Tier 4: Nice-to-Have

| #   | Gap                                         | Notes                                                  |
| --- | ------------------------------------------- | ------------------------------------------------------ |
| 11  | **Voice-directed picking**                  | Vocollect/Honeywell integration for cold chain/grocery |
| 12  | **Configurable workflow/rules engine**      | User-defined if/then rules without code                |
| 13  | **Distributed order management**            | Intelligent order routing across warehouses            |
| 14  | **Demand forecasting / auto-replenishment** | Safety stock, reorder points, pick-face replenishment  |
| 15  | **ERP integrations**                        | SAP, QuickBooks, Sage, Dynamics beyond NetSuite        |

---

## Updated Scorecard

| Dimension                  | Score  | Change   | Notes                                                               |
| -------------------------- | ------ | -------- | ------------------------------------------------------------------- |
| **Vision completeness**    | 9/10   | —        | Architecture covers enterprise-grade WMS                            |
| **Execution completeness** | 7.5/10 | ↑ from 7 | 11 advanced modules built, 382 tests, CI green                      |
| **Freight depth**          | 5/10   | ↓ honest | Schema + compliance checks exist, but no operational customs module |
| **Fulfillment breadth**    | 8/10   | —        | Full order-pick-pack-ship + cartonization + returns                 |
| **3PL billing maturity**   | 5/10   | new      | Rate cards + event ledger + invoices exist, but no ops workbench    |
| **Multi-tenant maturity**  | 8/10   | ↑ from 7 | Schema isolation, portal scoping, RBAC hardened, 30+ permissions    |
| **Integration readiness**  | 6/10   | —        | Adapters built, need more channels + live credentials               |
| **Optimization/AI**        | 4/10   | new      | Good heuristics (slotting, interleaving), no ML/predictive layer    |
| **Production hardness**    | 8.5/10 | ↑ from 8 | All audit findings fixed, CI/CD pipeline green, 382 tests           |

---

## Recommended Build Order (highest leverage first)

1. **Billing ops workbench** — charge adjustments, review/approval, PDF export, client delivery (3-4 weeks)
2. **Lot/expiration/FEFO** — `expirationDate` field, FEFO pick enforcement, expiration alerts (2-3 weeks)
3. **Report export engine** — CSV/Excel/PDF export + scheduled reports via BullMQ (2-3 weeks)
4. **LPN/container tracking** — pallet-level receiving and movement (3-4 weeks)
5. **Marketplace connectors** — Walmart, WooCommerce, BigCommerce (1-2 weeks each)
6. **GS1/SSCC compliance** — barcode generation + retailer label templates (2-3 weeks)
7. **Multi-warehouse** — transfer orders, cross-facility visibility (6-8 weeks)
8. **Customs/freight module** — ISF, broker workflows, bonded inventory (6-8 weeks)
9. **Optimization engine** — wave planning, labor standards, productivity trends (4-8 weeks)
10. **Automation WCS** — command/telemetry, PLC integration, mission dispatch (8-12 weeks)

---

## Codebase Metrics (March 2026)

| Metric                | Count                                                     |
| --------------------- | --------------------------------------------------------- |
| Route pages           | 100+                                                      |
| Prisma models         | 73                                                        |
| Server action modules | 35+ files                                                 |
| Tests                 | 504 (37 suites)                                           |
| SQL migrations        | 20 (0001-0020)                                            |
| BullMQ workers        | 5 (notifications, integrations, email, slotting, reports) |
| RBAC permissions      | 37                                                        |
| Marketplace adapters  | 5 (Shopify, Amazon, Walmart, WooCommerce, BigCommerce)    |
| i18n languages        | 2 (en/es)                                                 |
| TypeScript errors     | 0                                                         |
| Lint errors           | 0                                                         |
| Lines of code         | ~65K                                                      |
