# Armstrong Metafields Build Plan

Date: 2026-03-26

## Goal

Build the foundational metafields capability Armstrong now needs for receiving, LP lifecycle, inventory search, allocation, reporting, labels, and manifests.

This plan is derived from:

- `docs/Metafields Kick Off Call.pdf`
- [armstrong-wms-side-by-side-gap-analysis.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/armstrong-wms-side-by-side-gap-analysis.md)

## Product Outcome

After this work, Armstrong should be able to:

- receive many unique items under one generic SKU
- capture Armstrong-specific differentiators such as tag number, room reference, condition, and insurance value
- carry those values through LP and inventory lifecycle
- search and allocate by those values
- print or export those values in downstream documents and labels

## Proposed Scope

### Phase 1: Core Data Foundation

Build the generic data model first.

Required concepts:

- `MetafieldDefinition`
  - tenant-scoped
  - name
  - key
  - label
  - data type
  - validation rules
  - required / optional
  - active / inactive
  - allowed values for dropdowns

- `MetafieldValue`
  - definition reference
  - entity type
  - entity id
  - typed or normalized stored value
  - created / updated metadata

- supported attachment points
  - inbound shipment
  - inbound shipment line
  - LPN
  - inventory unit or inventory record
  - optionally outbound shipment / document surfaces later

### Phase 2: Admin Configuration

Add admin UX for field management:

- create / edit / archive field definitions
- choose field type
- choose where the field applies
- define validation rules
- define whether a field is required during receiving
- define whether dropdown values are freeform or managed

### Phase 3: Receiving Capture

Wire metafields into receiving workflows first.

Surfaces:

- desktop receiving
- operator/mobile receiving
- document-assisted receiving review
- blind-receive-compatible intake flow

Behavior:

- required fields enforced where configured
- dropdowns and validations enforced
- values captured at the right level
  - shipment
  - shipment line
  - LP

### Phase 4: LP and Inventory Lifecycle

This is the point where metafields become operational, not just stored.

Needed behavior:

- values follow LPs through putaway / move / consolidation / split
- inventory search supports metafield filters
- allocation can target or exclude based on metafield criteria
- pick / ship views can surface those values when relevant

### Phase 5: Reporting and Outputs

Add downstream usage surfaces:

- report columns
- CSV export fields
- portal visibility only if intended
- document merge fields
- manifests
- labels

### Phase 6: Hardening and Scale

Before calling it done:

- test high-volume Armstrong scenarios
- test receiving UX with 12+ fields
- test duplicate-value detection where required
- test dropdown performance with historical value growth
- test permission boundaries

## Recommended Technical Shape

### Data Model

Prefer a generic, typed metadata layer over Armstrong-only columns.

Reason:

- Armstrong is the immediate need
- but this is the kind of capability that should become reusable across tenants

Recommended direction:

- definitions table
- values table
- typed validation in app layer
- JSON support only where needed, not as the primary unmanaged storage model

### Attachment Strategy

Do not attach metafields only to shipments.

Armstrong's use case requires values to survive lifecycle transitions.

So the plan should explicitly define:

- what starts on receiving line
- what moves onto LP
- what is retained on inventory
- what survives split / merge events

### Search and Allocation

This cannot be deferred too late.

Armstrong's business case is not solved by simply collecting extra attributes at receipt.

The values have to become operational in:

- inventory search
- allocation logic
- downstream document visibility

## MVP Recommendation

If you want a realistic first shipping slice, do this:

1. definitions + values + admin CRUD
2. desktop and operator receiving capture
3. LP attachment
4. inventory search by metafield
5. CSV/report output

That is the smallest useful version that actually changes Armstrong operations.

## What Can Wait

These can follow after the foundation:

- sophisticated document builder
- advanced label template designer
- historical dropdown suggestion tuning
- highly complex duplicate-value heuristics
- customer-facing portal exposure of metafields

## Risks

1. Building this as Armstrong-only hardcoded fields
   - fast short-term
   - expensive long-term

2. Stopping at receiving capture
   - creates data collection with no operational payoff

3. Deferring LP / inventory propagation
   - breaks Armstrong's real-world use case

4. Underestimating search and allocation implications
   - this is where the business value actually shows up

## Suggested Delivery Sequence

### Sprint Block 1

- schema
- admin CRUD
- validation layer
- RBAC hooks

### Sprint Block 2

- desktop receiving capture
- operator receiving capture
- DocAI review form integration

### Sprint Block 3

- LP propagation
- inventory persistence
- search filters

### Sprint Block 4

- allocation criteria
- reports / CSV
- manifests / label integration

### Sprint Block 5

- performance testing
- UAT with Armstrong scenarios
- documentation and training

## Definition of Done

This should not be called done until Armstrong can:

- receive 1,000+ differentiated items under one SKU
- find those items by custom criteria
- allocate those items by custom criteria
- preserve those values through LP/inventory lifecycle
- output those values in at least one report and one downstream document surface

## Bottom Line

The product is broad enough already.

The next real product win is not "more features everywhere." It is one foundational capability done correctly.

That capability is metafields.
