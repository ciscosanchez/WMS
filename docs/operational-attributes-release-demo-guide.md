# Operational Attributes Release & Demo Guide

## Purpose

This document is the practical walkthrough for the March 2026 WMS release work across:

- RBAC and persona hardening
- tenant routing and persona defaults
- generic configurable operational attributes
- receiving, LPN, inventory, order, export, report, and document-surface support

Use this for:

- internal QA smoke tests
- customer demos
- sales/product walkthroughs
- release verification after deploy

## What Shipped

### RBAC and Personas

- superadmin, tenant admin, manager, warehouse worker, viewer, operator, and portal user behaviors are now cleaner and better enforced
- portal users are routed into the portal shell instead of drifting through tenant UI
- operator users land in task-oriented workflow paths
- tenant navigation is permission-aware
- core tenant modules now use explicit read/write permission checks instead of broad tenant membership

See:

- [docs/rbac.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/rbac.md)
- [src/lib/auth/personas.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/personas.ts)

### Operational Attributes

The WMS now supports a generic tenant-configurable operational-attributes engine.

Current supported scopes:

- `inbound_shipment`
- `inbound_shipment_line`
- `lpn`
- `inventory_unit`
- `inventory_record`
- `order_line`

Current supported capabilities:

- tenant-managed attribute definitions
- searchable attributes
- allocatable attributes
- shipment header capture
- shipment line capture
- LPN capture
- propagation into inventory records
- order-line capture and allocation matching
- inventory filtering and row visibility
- CSV exports
- reporting coverage
- document-surface mapping for labels, manifests, and packing lists

See:

- [docs/configurable-operational-attributes-architecture.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/configurable-operational-attributes-architecture.md)
- [docs/configurable-operational-attributes-phase-1.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/configurable-operational-attributes-phase-1.md)

## Recommended Demo Story

Use this sequence.

1. Show tenant admin setup of reusable attribute definitions.
2. Show receiving capture at shipment and line level.
3. Show LPN creation with matching metadata.
4. Show inventory search/filter using propagated attributes.
5. Show order-line requirements and allocation matching.
6. Show exports and reporting.
7. Show document-surface mapping.

This tells the right product story:

- generic platform, not Armstrong-only customization
- configurable by tenant
- operationally useful across receiving, inventory, orders, and reporting

## Demo Preparation

Before demoing, confirm:

- tenant migrations are applied
- at least one tenant admin exists
- the tenant has a few attribute definitions configured
- the tenant has at least one client, product, receiving workflow, and inventory records

Recommended sample definitions:

1. `room_ref`
   - scope: `inbound_shipment_line`
   - type: `text`
   - searchable: `true`
   - allocatable: `true`

2. `tag_number`
   - scope: `lpn`
   - type: `text`
   - searchable: `true`

3. `insurance_value`
   - scope: `inventory_record`
   - type: `currency`
   - searchable: `true`

4. `delivery_window`
   - scope: `order_line`
   - type: `date`
   - allocatable: `true`

## Demo Walkthrough

### 1. Define Attributes

Path:

- `Settings -> Operational Attributes`

What to show:

- scopes are generic and reusable
- admins can define types and behavior flags
- the same engine supports search, allocation, exports, and documents

What success looks like:

- definitions save cleanly
- flags like `searchable`, `allocatable`, and document-surface visibility are visible and editable

### 2. Capture Shipment Header Attributes

Path:

- `Receiving -> New`

What to show:

- inbound shipment form renders configured `inbound_shipment` attributes
- values persist alongside the new shipment

What success looks like:

- shipment creates successfully
- configured header-level attributes are accepted and saved

### 3. Capture Shipment Line Attributes

Path:

- `Receiving -> New -> Add Line`

What to show:

- line dialog renders configured `inbound_shipment_line` attributes
- users capture business-specific detail without custom code changes

What success looks like:

- line saves successfully
- line-level values remain attached to the shipment line

### 4. Create an LPN with Attributes

Path:

- `Inventory -> LPN -> New`

What to show:

- LPN-level attributes render from configuration
- this is where operational identity becomes durable

What success looks like:

- LPN saves successfully
- configured values persist with the LPN

### 5. Show Inventory Propagation and Filtering

Path:

- `Inventory`

What to show:

- propagated attributes appear on inventory rows
- filters can target operational attributes
- this is not just metadata capture; it affects retrieval and visibility

What success looks like:

- attribute badges are visible in the stock table
- filtering by configured keys/values returns expected inventory

### 6. Show Order-Line Allocation Matching

Path:

- `Orders -> New`
- then open the order detail page

What to show:

- order lines can capture `order_line` attributes
- allocation logic now uses matching attribute keys against `inventory_record` values
- order detail surfaces the configured attributes

What success looks like:

- order-line attributes save
- order detail shows those values
- matching inventory is preferred during pick-task generation

### 7. Show Exports and Reports

Paths:

- export inventory CSV
- export orders CSV
- `Reports -> Attributes`

What to show:

- CSV exports append dynamic attribute columns
- reporting shows definition coverage and usage by scope

What success looks like:

- export headers include configured dynamic fields
- reports show active definitions, searchable counts, allocatable counts, and usage data

### 8. Show Document Surfaces

Path:

- `Shipping -> Labels`

What to show:

- attributes can be configured for label, manifest, and packing-list visibility
- this is a reusable output layer, not a one-off label hack

What success looks like:

- configured definitions appear under the correct document surfaces

## Persona Demo Guide

Use these personas to show the access model:

- `superadmin`
  - base domain
  - lands on `/platform`
- `tenant_admin`
  - tenant admin shell
  - manages settings, users, and attributes
- `tenant_manager`
  - operational visibility with elevated access
- `operator`
  - lands on `/my-tasks`
  - does not need full admin UI
- `portal_user`
  - lands on `/portal/inventory`
  - stays scoped to client-specific portal behavior

## Suggested Smoke-Test Checklist

After deploy, validate these:

1. Tenant admin can open `Settings -> Operational Attributes`.
2. A new attribute definition can be created.
3. A receiving shipment accepts header-level attributes.
4. A receiving line accepts line-level attributes.
5. A new LPN accepts attributes.
6. Inventory rows show propagated values.
7. Inventory filters work on an attribute key/value.
8. An order line accepts attributes and shows them on order detail.
9. Inventory export includes dynamic attribute columns.
10. Orders export includes dynamic attribute columns.
11. Reports `Attributes` tab loads successfully.
12. Shipping labels page shows document-surface mappings.

## What This Is Not

This is not an Armstrong-only custom module.

The correct product framing is:

- tenant-configurable operational attributes
- configurable inventory identity
- generic receiving and allocation metadata platform

Armstrong is the first strong design-partner use case, not the product boundary.

## Related Docs

- [docs/rbac.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/rbac.md)
- [docs/configurable-operational-attributes-architecture.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/configurable-operational-attributes-architecture.md)
- [docs/configurable-operational-attributes-phase-1.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/configurable-operational-attributes-phase-1.md)
- [docs/armstrong-wms-side-by-side-gap-analysis.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/armstrong-wms-side-by-side-gap-analysis.md)
- [docs/armstrong-wms-executive-brief.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/armstrong-wms-executive-brief.md)
- [docs/armstrong-metafields-build-plan.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/armstrong-metafields-build-plan.md)
