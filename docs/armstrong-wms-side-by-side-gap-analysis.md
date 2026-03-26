# Armstrong WMS Side-by-Side Gap Analysis

Date: 2026-03-26

## Source Documents Reviewed

- `docs/WMS-Presentation Nov2024 v2.pptx`
- `docs/Metafields Kick Off Call.pdf`

## Executive Summary

The current Ramola WMS is materially stronger than the original November 2024 Armstrong selection criteria in several areas:

- multi-tenant architecture and platform admin
- customer portal
- operator workflows
- 3PL billing
- rate shopping and carrier integrations
- EDI / marketplace / API integration surface
- yard & dock, labor, returns, and compliance modules

The single biggest gap against Armstrong's newer stated needs is **generic metafields infrastructure**.

Armstrong's March 2026 metafields plan is not asking for another isolated receiving feature. It is asking for a foundational data model that supports:

- configurable field definitions
- value capture at receiving
- propagation through LP / inventory lifecycle
- search and allocation by those fields
- reporting, documents, labels, and manifests using those fields

That foundational layer is **not present** in the current WMS codebase. There are fixed fields, documents, photos, LPs, audit logging, and report/export surfaces, but not a reusable metafield system.

## 1. Side-by-Side Against the November 2024 WMS Presentation

| Armstrong Need from 2024 Deck | Current WMS Status | Assessment |
| --- | --- | --- |
| Multiple units of measure at the item level | `Product.baseUom`, `unitsPerCase`, and `UomConversion` exist in the tenant schema | `Yes` |
| Customer portal for inventory / ASNs / visibility | Dedicated portal app exists with inventory, orders, shipments, billing, and reports pages | `Yes` |
| Rate shopping / multiple carrier options | Carrier accounts, UPS/FedEx/USPS adapters, and rate-shopping flow exist | `Yes` |
| E-commerce / EDI / API integrations | Shopify, Amazon, EDI parsing/generation, and integration settings exist | `Yes` |
| Reporting for leadership and customers | Tenant analytics/reports plus CSV exports and portal reports exist | `Yes` |
| Ability to receive against ASN | Inbound shipment / ASN creation and receiving workflows exist | `Yes` |
| Cycle counting | Inventory adjustments / cycle count flows exist | `Yes` |
| Different pick workflows | Operator app, picking, replenishment, interleaving, and workflow rules exist | `Partial to Yes` |
| Blind receipts / shipments showing up unannounced | Receiving exists, document-driven intake exists, but a first-class blind-receive workflow is not clearly modeled as a configurable operator flow | `Partial` |
| Agency-specific notifications / rules | Workflow rules and notifications exist, but explicit per-agency order notification behavior is not clearly surfaced as a dedicated feature | `Partial` |

### What This Means

If the comparison is strictly against the 2024 vendor deck, Ramola WMS is already in a good position. It appears to satisfy or exceed most of the reasons Armstrong wanted to leave Magaya.

The system is especially strong where the old deck cared about:

- portal visibility
- carrier flexibility
- integration surface
- warehouse execution breadth
- scalability away from spreadsheet-driven workflows

## 2. Side-by-Side Against the March 2026 Metafields Kickoff

| Metafields Requirement | Current WMS Status | Assessment |
| --- | --- | --- |
| `MetafieldDefinition` CRUD | No generic metafield definition model or admin CRUD was found in schema or app modules | `Missing` |
| `MetafieldValue` capture on receiving | Receiving captures fixed shipment/line/transaction fields; DocAI can extract fixed structured data, but there is no generic field capture layer | `Missing` |
| Mobile receiving capture for 12+ custom fields | Operator and receiving apps exist, but not generic configurable field capture | `Missing` |
| Desktop receiving/config views for custom fields | Admin/settings and receiving pages exist, but not a generic custom-field config/view system | `Missing` |
| LP association model for metafields | LPN support exists, but there is no generic metafield-to-LPN lifecycle model | `Missing` |
| Search / filter by metafield | Inventory search exists, but not by configurable metafield values | `Missing` |
| Manual allocation by metafield criteria | Allocation exists, but not against configurable metafield criteria | `Missing` |
| Role-based permissions for field management | RBAC is present and strong enough to support this once metafields exist | `Ready once built` |
| Reports with metafield columns | Report/export surface exists, but not generic metafield columns | `Missing` |
| Document builder merge fields using metafields | No generic document builder / merge-field system was found | `Missing` |
| Custom label templates using metafields | GS1 and retailer label helpers exist, but not a generic label-template system fed by custom metafields | `Partial` |
| PDF manifests using metafield data | Shipment manifests / master PDF pieces exist, but not driven by generic metafields | `Partial` |
| Dropdown population from historical values | No generic metafield population logic was found | `Missing` |
| Duplicate-value detection and warnings | No generic metafield duplicate detection layer was found | `Missing` |
| Audit logging for field changes | Cross-system audit log exists and is reusable for this | `Ready once built` |
| Scale for 5K+ items under one SKU with unique differentiators | Current schema can store lot/serial/document data, but not the generic differentiators Armstrong described | `Not yet` |

### What This Means

The current WMS has many of the supporting primitives needed for the metafields program:

- RBAC
- receiving workflows
- operator mobile UI
- LPN support
- inventory and allocation engines
- reporting/export surfaces
- document handling
- audit logging

But it does **not** yet have the actual core metaphields layer that Armstrong described as foundational.

This is the most important product gap relative to the current business ask.

## 3. Areas Where Ramola WMS Already Exceeds the Original Ask

Compared with the original selection criteria, the current product already has several capabilities that are stronger than what Armstrong was asking for in 2024:

- Multi-tenant platform administration
  - central `/platform` experience for tenant lifecycle and superadmin operations
- Strong RBAC and persona routing
  - superadmin, admin, manager, operator, viewer, and portal personas
- Built-in 3PL billing
  - rate cards, billing events, invoices, disputes, portal billing visibility
- Yard & dock operations
  - appointments, dock schedule, yard map, check-in
- Labor management
  - shifts, labor dashboards, cost reporting
- Returns / RMA handling
  - inspection and disposition flows
- GS1 / SSCC helpers
  - SSCC generation, GS1 barcode helpers, retailer label templates
- Document intelligence
  - document upload, OCR/AI extraction, review flow, shipment creation from extracted data
- Compliance / customs / cross-dock breadth
  - broader operational surface than the original 2024 comparison focused on

So the product is not "behind" in a general sense. It is **ahead broadly, but missing one foundational custom-attribute layer that now matters a lot for Armstrong's use case**.

## 4. Areas Where the Current WMS Is Less Than What Armstrong Now Needs

These are the gaps that matter most:

1. No generic metafield schema
   - no `definitions`
   - no `values`
   - no typed validation model
   - no lifecycle association strategy

2. No configurable receiving capture layer for Armstrong-specific item identity
   - tag number
   - room reference
   - condition
   - insurance value
   - other Armstrong-specific differentiators

3. No inventory / allocation semantics tied to those custom attributes
   - Armstrong's need is not just storage of extra fields
   - they need those fields to drive search, allocation, and operational handling

4. No generic reporting / label / document merge framework for those values
   - exports exist
   - PDFs exist
   - labels exist
   - but they are not driven by configurable custom fields

5. No demonstrated large-scale workflow around "many unique items under one SKU"
   - the current system can represent inventory and documents
   - it does not yet prove the exact Armstrong scenario the kickoff deck describes

## 5. Recommended Product Interpretation

The right reading of these two documents together is:

- The November 2024 deck explains **why Armstrong needed a modern WMS**
- The March 2026 metafields deck explains **what must be built now for Armstrong's real operating model to work**

Those are different questions.

Ramola WMS already answers the first question well.

Ramola WMS does **not yet** fully answer the second question.

## 6. Recommended Build Order

If this product is being prioritized around Armstrong, the correct next sequence is:

1. Build the generic metafield foundation
   - definitions
   - typed values
   - validation
   - scope and attachment model

2. Wire metafields into receiving first
   - mobile
   - desktop
   - blind-receive-compatible flows

3. Extend them into LP and inventory lifecycle
   - receiving
   - putaway
   - search
   - allocation
   - shipment / manifest outputs

4. Add reporting / labels / document merge support

5. Then performance-test against Armstrong's "5K+ items under one SKU" scenario

## Bottom Line

If the question is, "Does Ramola WMS compare well to what Armstrong originally wanted from a replacement WMS?" the answer is **yes**.

If the question is, "Does Ramola WMS already deliver the metafields foundation Armstrong now says is required for their receiving and allocation model?" the answer is **no, not yet**.

That gap is not cosmetic. It is architectural, and it should be treated as a top-tier roadmap item.
