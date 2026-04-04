# Ramola WMS — Competitive Position Assessment

_Last updated: 2026-03-27_

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

**Strongest differentiator**: unified freight + fulfillment in one platform with modern tenant isolation, configurable operational attributes, and stronger governance than most mid-market peers.

**Competitive neighborhood**: between Deposco and Extensiv on mid-market breadth, with a clearer path upward into enterprise-style governance and workflow depth than most 3PL-native tools. Still behind Manhattan, SAP, Oracle, and Blue Yonder on optimization science and automation execution.

---

## Validated Strengths (confirmed in codebase)

| Capability                              | Evidence                                                                          | Competitor Comparison                      |
| --------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------ |
| **Dual-mode (freight + fulfillment)**   | BOL receiving + DTC pick/pack/ship in same tenant model                           | Rare at mid-market                         |
| **Multi-tenant isolation + governance** | Schema-per-tenant, portal scoping, 37 permissions, user overrides, review tooling | Ahead of most 3PL-midmarket peers          |
| **Modern stack**                        | Next.js 15, Prisma, BullMQ, TypeScript, CI/CD to Hetzner                          | Most competitors are legacy .NET/Java      |
| **Operator + portal personas**          | Distinct shells, routing defaults, permission-aware nav                           | Better UX separation than typical peers    |
| **Operational attributes platform**     | Definition engine + receiving/LPN/order capture + propagation + reporting/export  | Strong configurability story for midmarket |
| **Yard & Dock**                         | Appointments, Gantt calendar, yard map, driver check-in                           | Matches higher-tier concepts               |
| **Labor Management**                    | Shift tracking, task time logging, UPH, cost-per-unit billing                     | Competitive with 3PL-focused tools         |
| **Returns/RMA**                         | Full lifecycle with inspection + disposition + inventory re-entry                 | Table stakes, well-implemented             |
| **Cartonization + GS1/SSCC**            | FFD bin-packing, carton catalog, GS1-128 / SSCC workflows                         | More complete than many mid-market peers   |
| **LPN/container tracking**              | Pallet-level receive, move, consume, inventory propagation                        | Closed a prior enterprise gap              |
| **Workflow rules + replenishment**      | Configurable if/then workflow engine, threshold replenishment                     | Strong operational maturity signal         |
| **128 routes, 85 Prisma models**        | Real implementation breadth, not just marketing claims                            | Substantial codebase                       |

---

## Actual Gaps (validated against the current codebase)

### Tier 1: Highest-Leverage Remaining Gaps

| #   | Gap                                                                                                        | Behind Who                     | Impact                                  | Effort     |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------- | ---------- |
| 1   | **Optimization engine maturity** — wave planning, labor standards, balancing, predictive prioritization    | Manhattan, Blue Yonder, Oracle | Biggest enterprise-capability gap       | 4-8 weeks  |
| 2   | **Automation execution** — PLC/WCS command loop, mission dispatch, telemetry, heartbeat supervision        | SAP EWM, Manhattan, Korber     | Blocks automation-led warehouses        | 8-12 weeks |
| 3   | **Marketplace/ecosystem breadth** — 6 major adapters shipped, still far from platform ecosystems           | Logiwa, Extensiv, ShipHero     | Limits long-tail onboarding flexibility | Ongoing    |
| 4   | **Distributed order orchestration** — transfers exist, but no true multi-site order routing / DOM strategy | Oracle, Manhattan, Blue Yonder | Matters for multi-node growth customers | 6-8 weeks  |

### Tier 2: Competitive Differentiators Still To Build Out

| #   | Gap                                                                                            | Behind Who                | Impact                                       | Effort            |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------- | ----------------- |
| 5   | **Customs/freight operational depth** — stronger base exists, but still behind Magaya depth    | Magaya                    | Important for freight-forwarding positioning | 4-8 weeks         |
| 6   | **ERP / finance ecosystem** — limited packaged ERP/accounting connectors                       | SAP, Oracle, Infor        | Slows enterprise IT adoption                 | 2-4 weeks/adapter |
| 7   | **Voice-directed and device-specialized execution**                                            | Manhattan, Korber         | Matters in grocery/cold-chain/high-volume    | 3-6 weeks         |
| 8   | **Customer-facing analytic packaging** — reports are present, but packaged dashboards can grow | Extensiv, Deposco, Oracle | Helps 3PL differentiation and sales          | 2-4 weeks         |

### Tier 3: Maturity And Packaging Gaps

| #   | Gap                                                                                     | Behind Who                     | Impact                              | Effort    |
| --- | --------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------- | --------- |
| 9   | **Workflow optimization and simulation** — rules exist, but not full simulation tooling | Manhattan, Blue Yonder, Oracle | Limits consultative optimization    | 4-6 weeks |
| 10  | **Enterprise packaging and certifications** — buyer confidence artifacts, audit packs   | Larger enterprise vendors      | Slows larger-procurement acceptance | Ongoing   |

### Tier 4: Nice-to-Have

| #   | Gap                                         | Notes                                        |
| --- | ------------------------------------------- | -------------------------------------------- |
| 11  | **Digital twin / 3D visualization**         | Useful for enterprise demos and optimization |
| 12  | **Native SCIM / deeper IdP governance**     | Enterprise identity automation               |
| 13  | **Demand forecasting**                      | Safety stock and predictive replenishment    |
| 14  | **Broader last-mile carrier orchestration** | More TMS-like planning depth                 |
| 15  | **Domain-specific vertical packs**          | Food/pharma/furniture/art prebuilt configs   |

---

## Updated Scorecard

| Dimension                  | Score  | Change       | Notes                                                                  |
| -------------------------- | ------ | ------------ | ---------------------------------------------------------------------- |
| **Vision completeness**    | 9/10   | —            | Platform direction is coherent and extensible                          |
| **Execution completeness** | 8.5/10 | ↑ materially | More gaps have moved from roadmap to shipped capability                |
| **Freight depth**          | 6.5/10 | ↑            | Customs/compliance base exists, still behind freight-specialists       |
| **Fulfillment breadth**    | 8.5/10 | ↑            | Order, pick, pack, LPN, returns, GS1, exports, reporting               |
| **3PL billing maturity**   | 7/10   | ↑            | Workbench and governance story improved, still room for polish         |
| **Multi-tenant maturity**  | 9/10   | ↑            | Isolation, personas, overrides, access review, governance presets      |
| **Integration readiness**  | 7/10   | ↑            | Six major channel adapters, still not broad ecosystem depth            |
| **Configurability**        | 8.5/10 | new          | Operational attributes + workflow rules are now meaningful strengths   |
| **Optimization/AI**        | 5/10   | ↑            | Good heuristics and reporting, still no predictive/ML layer            |
| **Production hardness**    | 9/10   | ↑            | GitHub Actions green, auto-deploy working, test/lint/format/build pass |

---

## Recommended Build Order (highest leverage first)

1. **Optimization engine** — wave planning, labor standards, workload balancing, orchestrated release logic
2. **Automation / WCS execution** — command loop, telemetry, mission dispatch, heartbeat supervision
3. **Distributed multi-site orchestration** — cross-facility order routing and visibility, not just transfers
4. **Marketplace / ERP breadth** — keep extending adapters where onboarding friction is highest
5. **Freight-depth packaging** — broker workflows, customs filing, bonded workflows
6. **Voice / specialized device workflows** — if targeting grocery, cold chain, or very high-volume operations
7. **Enterprise packaging** — audit, security, procurement, and ROI artifacts for larger deals

---

## Codebase Metrics (March 2026)

| Metric                | Count / Status                                                    |
| --------------------- | ----------------------------------------------------------------- |
| Route handlers/pages  | 128                                                               |
| Prisma models         | 85                                                                |
| Module files          | 78 under `src/modules`                                            |
| Test files            | 73                                                                |
| Tenant SQL migrations | 23 (`0001`-`0023`)                                                |
| BullMQ workers        | 5 (notifications, integrations, email, slotting, reports)         |
| RBAC permissions      | 37                                                                |
| Marketplace adapters  | 6 (Shopify, Amazon, Walmart, WooCommerce, BigCommerce, eBay)      |
| i18n languages        | 2 (en/es)                                                         |
| TypeScript            | 0 errors                                                          |
| ESLint / Prettier     | green                                                             |
| CI/CD                 | GitHub Actions validate + deploy to Hetzner fully green on `main` |
