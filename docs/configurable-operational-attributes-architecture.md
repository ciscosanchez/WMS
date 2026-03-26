# Configurable Operational Attributes Architecture

Date: 2026-03-26

## Purpose

Define a generic product architecture for tenant-configurable operational attributes.

This is the reusable platform version of what Armstrong is currently surfacing through the metafields discussion. Armstrong should be treated as the first serious design partner, not as the hardcoded product definition.

## Problem Statement

Many warehouse customers need to track business-specific attributes that are not well represented by fixed columns alone.

Examples:

- furniture / FF&E: tag number, room reference, condition, insurance value
- retail compliance: retailer PO qualifiers, compliance flags, carton attributes
- cold chain: temperature range, hold reason, expiry class
- regulated goods: hazmat qualifiers, handling codes, inspection state

The platform should support these needs without creating tenant-specific forks of:

- receiving
- inventory
- LPN lifecycle
- allocation
- reporting
- labels
- manifests

## Product Framing

This feature should be framed as:

- tenant-configurable operational attributes
- custom inventory identity framework
- configurable receiving and allocation attributes

Avoid framing it as:

- Armstrong custom fields
- Armstrong metafields module
- one-off tenant-specific receiving logic

## Core Product Principles

1. Generic engine, tenant-specific configuration
   - the platform owns the engine
   - each tenant owns its field set

2. Behavior matters more than storage
   - this is not just “extra fields”
   - attributes need operational meaning

3. Scope must be explicit
   - not every attribute belongs on every entity

4. Lifecycle propagation must be designed up front
   - attributes collected at receiving often need to survive downstream movement

5. UI rendering should be schema-driven where practical
   - config should decide what appears in receiving, search, reports, and labels

## Recommended Conceptual Model

### 1. Attribute Definition

A tenant-scoped definition of a reusable field.

Suggested shape:

- `id`
- `tenant_id`
- `entity_scope`
- `key`
- `label`
- `description`
- `data_type`
- `is_required`
- `is_active`
- `validation_rules`
- `display_rules`
- `behavior_flags`
- `sort_order`

### 2. Attribute Option

Used for enum / dropdown / controlled-list fields.

Suggested shape:

- `id`
- `definition_id`
- `value`
- `label`
- `sort_order`
- `is_active`

### 3. Attribute Value

Stores the actual value attached to a concrete record.

Suggested shape:

- `id`
- `definition_id`
- `entity_scope`
- `entity_id`
- normalized value columns and/or typed payload
- `created_by`
- `updated_by`
- timestamps

### 4. Attribute Behavior Flags

This is what makes the feature operational.

Suggested flags:

- `required_on_receive`
- `searchable`
- `filterable`
- `allocatable`
- `show_in_inventory`
- `show_in_portal`
- `show_in_reports`
- `show_on_label`
- `show_on_manifest`
- `allow_historical_suggestions`

## Recommended Entity Scopes

Start with a small but deliberate scope model.

Suggested first scopes:

- `inbound_shipment`
- `inbound_shipment_line`
- `lpn`
- `inventory_unit`
- `inventory_record`

Likely later scopes:

- `order`
- `order_line`
- `shipment`
- `client`
- `product`

Important:

The first release should not pretend every scope is supported equally. It is better to define a clear supported matrix than to overgeneralize too early.

## Data Modeling Guidance

### Do Not

- add Armstrong-only columns directly to core tables
- overload one JSON blob with no typing or validation
- bind behavior only to UI forms without persistence semantics

### Do

- create a generic definition layer
- create a generic value layer
- validate in app logic
- normalize enough to support search and filtering
- preserve an audit trail for changes

## Lifecycle Propagation Model

This is the most important design question.

The system should explicitly define:

- where an attribute is first captured
- what downstream entity becomes the system of record
- what happens during split / merge / consolidation / transfer
- what happens when inventory is allocated or shipped

Example:

- a receiving-line attribute may be captured during intake
- once the goods are assigned to an LPN, some attributes should propagate to the LPN
- once inventory is materialized, certain attributes should remain queryable at the inventory-unit level

Without this propagation model, the feature becomes data capture with no operational durability.

## Search and Allocation

This feature should not stop at configuration and capture.

To be broadly useful, the platform must support:

- inventory search by configurable attributes
- filtering in receiving and inventory views
- optional allocation rules using attributes as criteria
- optional workflow triggers using attributes as conditions

This is what turns the feature into a reusable WMS differentiator rather than a form-builder.

## Surface Areas

### Admin / Settings

- create, edit, archive definitions
- manage dropdown options
- configure behavior flags
- preview where the field appears

### Receiving

- render required and optional fields based on scope
- support desktop and operator/mobile flows
- support blind-receive-compatible intake
- support document-assisted review where relevant

### Inventory

- show configured attributes in stock browser
- filter and search by flagged attributes
- preserve values through LP/inventory lifecycle

### Outputs

- CSV exports
- reports
- manifests
- labels
- portal, only where explicitly enabled

## Reusability Pattern

The right reusable pattern is:

- core engine
- scope support matrix
- field behavior flags
- tenant field packs

Example field packs:

- FF&E / white-glove storage pack
- retail compliance pack
- cold-chain pack
- high-value serialized inventory pack

Armstrong would simply be the first FF&E-oriented field pack and workflow partner.

## Suggested Delivery Strategy

### Platform MVP

Build the generic platform with:

1. definition model
2. value model
3. admin CRUD
4. receiving rendering
5. inventory search integration
6. CSV/report output

### First Tenant Implementation

Use Armstrong as the first real tenant implementation to validate:

- field types
- lifecycle propagation
- allocation semantics
- output needs

### Generalization Checkpoint

Before phase 2 expansion, force a product review:

- what was Armstrong-specific vocabulary only
- what stayed generic cleanly
- what should become a reusable field-pack template

## Risks If Built Incorrectly

1. Armstrong-specific naming leaks into core schema and APIs
2. Attributes are collected but not operationally queryable
3. LP/inventory propagation is undefined
4. Reporting/labels are deferred so the system feels incomplete
5. Every new customer request creates another ad hoc variation

## Recommended Internal Positioning

Use this language internally:

"We are building a configurable operational attributes platform for tenant-specific inventory identity, receiving, and allocation workflows. Armstrong is the first design-partner use case."

That keeps the product direction clean and commercially reusable.

## Relationship to Armstrong Docs

Armstrong-specific planning remains valid, but it should sit underneath this platform framing:

- [armstrong-wms-side-by-side-gap-analysis.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/armstrong-wms-side-by-side-gap-analysis.md)
- [armstrong-wms-executive-brief.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/armstrong-wms-executive-brief.md)
- [armstrong-metafields-build-plan.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/armstrong-metafields-build-plan.md)

## Bottom Line

The correct path is not to build “Armstrong custom fields.”

The correct path is to build a generic configurable operational attributes framework, then use Armstrong as the first serious tenant implementation on top of it.
