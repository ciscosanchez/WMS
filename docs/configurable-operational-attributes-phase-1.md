# Configurable Operational Attributes Phase 1

Date: 2026-03-26

## Objective

Start the generic platform foundation for configurable operational attributes.

This is phase 1 of the broader architecture in:

- [configurable-operational-attributes-architecture.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/configurable-operational-attributes-architecture.md)

## What Phase 1 Includes

Phase 1 is intentionally foundational, not customer-specific UI.

Included:

- tenant schema additions for:
  - attribute definitions
  - attribute options
  - attribute values
- SQL tenant migration
- server-side schemas for definition CRUD
- server actions for definition CRUD
- audit logging hooks for definition changes

Not yet included:

- receiving UI rendering
- operator/mobile UI rendering
- LP propagation
- inventory search and allocation usage
- reports / labels / manifests integration
- tenant-facing settings screen

## New Core Objects

### OperationalAttributeDefinition

Defines a tenant-owned configurable field.

Key attributes:

- `entityScope`
- `key`
- `label`
- `dataType`
- `validationRules`
- `displayRules`
- `behaviorFlags`

### OperationalAttributeOption

Supports controlled-list fields such as dropdowns and single-select values.

### OperationalAttributeValue

Stores values against a polymorphic entity target using:

- `entityScope`
- `entityId`

This keeps the first version generic and reusable without hardwiring one tenant's vocabulary into the core schema.

## Supported Entity Scopes in Phase 1

- `inbound_shipment`
- `inbound_shipment_line`
- `lpn`
- `inventory_unit`
- `inventory_record`

These were chosen because they directly support the near-term receiving and inventory identity use case.

## Supported Data Types in Phase 1

- `text`
- `number`
- `currency`
- `date`
- `boolean`
- `single_select`
- `multi_select`
- `json`

## Design Notes

### Why polymorphic values instead of immediate hard foreign keys?

Because the product problem is cross-entity and tenant-configurable.

Hardwiring one attribute table per entity would:

- slow down reuse
- encourage Armstrong-specific implementation
- make later scope expansion more expensive

The tradeoff is weaker database-level referential enforcement on `entityId`, but that is acceptable in phase 1 while the platform contract is still stabilizing.

### Why keep behavior flags in JSON at first?

Because the product is still learning which behaviors truly matter across tenants.

This allows faster evolution of flags like:

- searchable
- allocatable
- portal visible
- label visible
- report visible

without repeated schema churn during the discovery period.

## Next Phase

Phase 2 should start using this foundation in real workflows:

1. receiving definition management UI
2. desktop receiving rendering
3. operator/mobile receiving rendering
4. value capture against shipment / shipment line / LPN

That is the point where this moves from architecture into usable product behavior.
