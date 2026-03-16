# Competitive Analysis

## Armstrong WMS vs. Market Alternatives

### Logiwa IO

| Dimension | Logiwa IO | Armstrong WMS |
|---|---|---|
| **Primary market** | E-commerce / DTC fulfillment 3PLs | Freight + DTC fulfillment 3PLs |
| **Domain focus** | B2C order fulfillment, marketplace integrations | Both freight (BOL, customs, containers) AND fulfillment |
| **Multi-tenancy** | Multi-client within shared platform | Schema-per-tenant (stronger data isolation) |
| **Architecture** | Cloud SaaS, headless/serverless | Self-hosted (Docker), Next.js + PostgreSQL |
| **Receiving** | Barcode scan, PO upload, putaway rules | Freight-oriented: BOL, container, compliance + PO receiving |
| **Inventory** | Real-time tracking, cycle counting, demand prediction | Client-owned inventory, customs fields, lot/serial tracking |
| **Integrations** | 200+ pre-built (Shopify, carriers, marketplaces) | Building targeted integrations |
| **Pricing** | $500-$10K+/month SaaS | Self-hosted, lower TCO |
| **AI/Automation** | AI-driven job optimization, ML analytics | Not in MVP scope |
| **Workflow builder** | No-code drag-and-drop | Not in MVP scope |

**Key takeaway:** Logiwa is e-commerce only. Armstrong covers both freight AND fulfillment in one platform — the gap neither Logiwa nor Magaya fills.

### Oracle NetSuite WMS

| Dimension | NetSuite WMS | Armstrong WMS |
|---|---|---|
| **Primary target** | Mid-large enterprises on NetSuite ERP | Freight/3PL operators |
| **Multi-tenancy** | Shared account, role-based (OneWorld) | Schema-per-tenant, DB-level isolation |
| **Freight domain** | Not native; needs customization | Native: HS codes, BOLs, customs |
| **Inventory model** | Company-owned inventory | Client-owned (cargo owners model) |
| **Pricing** | $2K-$5K+/mo + $25K-$100K implementation | Self-hosted, competitive |
| **ERP integration** | Native NetSuite | API bridge to NetSuite |
| **Maturity** | Mature, Oracle-backed | Early-stage |

**Key takeaway:** NetSuite WMS is strong for companies already on NetSuite ERP but not purpose-built for 3PL. Armstrong's advantage is native multi-tenant isolation and freight domain features. Risk is NetSuite ecosystem lock-in.

### Magaya

| Dimension | Magaya | Armstrong WMS |
|---|---|---|
| **Primary market** | Freight forwarders, NVOCC, customs brokers | Freight + fulfillment 3PLs |
| **Strengths** | Deep freight forwarding, customs/compliance, cargo tracking | Modern UI, dual-mode (freight + DTC), multi-tenant |
| **Weaknesses** | Legacy UI, no DTC/e-commerce fulfillment | Early stage, no customs module yet |
| **Pricing** | $$$$ (enterprise, implementation-heavy) | Self-hosted, lower cost |
| **Architecture** | Client-server / cloud (older tech) | Modern web (Next.js, React, PostgreSQL) |

**Key takeaway:** Magaya is the most direct competitor for the freight/3PL segment. Armstrong differentiates by adding fulfillment capabilities and offering a modern, lower-cost alternative. Many Magaya customers are frustrated with the UI and pricing.

### 3PL Warehouse Manager (Extensiv)

| Dimension | 3PL WM (Extensiv) | Armstrong WMS |
|---|---|---|
| **Primary market** | 3PL warehouses | Freight + fulfillment 3PLs |
| **Strengths** | Purpose-built for 3PL, billing module, integrations | Dual-mode, modern stack, self-hosted option |
| **Weaknesses** | No freight forwarding, aging platform | Early stage |
| **Pricing** | $500-$2K+/month | Self-hosted |
| **Client billing** | Built-in activity-based billing | Planned (WMS → NetSuite bridge) |

**Key takeaway:** 3PL Warehouse Manager is the closest 3PL-focused competitor. Their billing module is a key feature Armstrong needs to match.

---

## Armstrong's Competitive Position

```
                        FREIGHT/CUSTOMS DEPTH
                              ▲
                              │
                    Magaya ●  │
                              │
                              │  ● Armstrong WMS
                              │    (target position)
                              │
               ───────────────┼──────────────────► FULFILLMENT / DTC
                              │
             3PL WM (Extensiv)│●
                              │        ● Logiwa
                              │
                NetSuite WMS ●│
                              │
```

Armstrong's unique position: **the only platform that covers both freight-depth (Magaya territory) and fulfillment-breadth (Logiwa territory)** for 3PL operators who do both.

## Target Customer Profile

- 3PL operators with 1-10 warehouse facilities
- Handle both freight (containers, pallets, BOL-based receiving) and fulfillment (DTC, B2C orders)
- Currently using Magaya, legacy WMS, or spreadsheets
- Want modern UI, lower cost, and integrated fulfillment
- Already on or planning to adopt NetSuite for financials
- Need multi-client inventory segregation and activity-based billing
