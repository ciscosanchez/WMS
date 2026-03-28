# RBAC & Personas

Ramola WMS uses a layered access model:

1. Stored identity and tenant membership in the public schema
2. Permission checks against a single RBAC map
3. Derived product personas for routing and UX
4. Portal client scoping for customer-facing access

This keeps the persisted model small while still supporting distinct product
experiences for platform admins, tenant admins, operators, and portal users.

## Source Of Truth

Core implementation files:

- [rbac.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/rbac.ts)
- [personas.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/personas.ts)
- [session.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/session.ts)
- [context.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/tenant/context.ts)
- [middleware.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/middleware.ts)

Use this document as the current product-level reference. The code files above
remain the implementation authority.

## Stored Access Model

### Public-Schema Fields

- `users.is_superadmin`
  - platform-level access
  - controls base-domain `/platform` behavior
- `tenant_users.role`
  - tenant-scoped role
  - one of: `admin`, `manager`, `warehouse_worker`, `viewer`
- `tenant_users.portal_client_id`
  - optional client binding for portal-scoped access
  - used to fail closed into a single client account in portal flows

### What Is Persisted Vs Derived

Persisted:

- platform superadmin flag
- tenant membership
- tenant role
- optional portal client binding
- optional per-membership permission overrides (`grants` + `denies`)

Derived:

- `tenant_admin`
- `tenant_manager`
- `operator`
- `portal_user`

Ramola intentionally does not persist extra enum roles for `operator` or
`portal_user` yet.

## Role Hierarchy

Current role levels from [rbac.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/rbac.ts):

- `admin` = 40
- `manager` = 30
- `warehouse_worker` = 20
- `viewer` = 10

Permission checks are fail closed:

- unknown permission keys require admin
- tenant membership is required unless the user is acting as superadmin

## Permission Model

Current permission families:

- `clients:*`
- `products:*`
- `receiving:*`
- `inventory:*`
- `orders:*`
- `warehouse:*`
- `shipping:*`
- `operator:*`
- `cross_dock:*`
- `returns:*`
- `yard-dock:*`
- `billing:*`
- `customs:*`
- `reports:read`
- `settings:*`
- `users:*`

### Effective Access By Stored Role

This table reflects the current role thresholds in `PERMISSION_LEVEL`.

| Permission family                                             | Viewer    | Warehouse Worker | Manager      | Admin        |
| ------------------------------------------------------------- | --------- | ---------------- | ------------ | ------------ |
| Read data (`*:read`, reports)                                 | Yes       | Yes              | Yes          | Yes          |
| Operator work                                                 | Read only | Read + write     | Read + write | Read + write |
| Receiving write                                               | No        | Yes              | Yes          | Yes          |
| Inventory write / count                                       | No        | Yes              | Yes          | Yes          |
| Shipping write                                                | No        | Yes              | Yes          | Yes          |
| Products / orders / warehouse write                           | No        | No               | Yes          | Yes          |
| Billing write                                                 | No        | No               | Yes          | Yes          |
| Settings read / users read                                    | No        | No               | Yes          | Yes          |
| Settings write / users write / billing approve / customs file | No        | No               | No           | Yes          |

Notes:

- `viewer` is intentionally broad on tenant reads, but not writes
- `warehouse_worker` is the execution role
- `manager` is the supervisory role
- `admin` is the tenant-governance role

## Enforcement Layers

### 1. Session And Membership

Primary helpers:

- [requireTenantAccess()](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/session.ts)
- [requirePermission()](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/session.ts)
- [requireTenantContext()](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/tenant/context.ts)
- [requirePortalContext()](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/tenant/context.ts)

Rules:

- server actions and server-side queries should rely on `requireTenantContext(permission?)`
- portal-only flows should use `requirePortalContext()`
- middleware is a routing and UX layer, not the final security boundary

### 2. Layout And Shell Boundaries

- `/platform/*` requires `isSuperadmin`
- portal shell requires `portal_client_id`
- tenant shell nav is permission-aware
- portal-bound users are redirected away from tenant-oriented screens

### 3. Data Scoping

Portal access is not just role-based. It is also client-scoped:

- portal actions resolve the bound client from `portal_client_id`
- portal exports are filtered by `portal_client_id`
- portal users do not get tenant-wide CSV exports anymore

Sensitive read/write examples now locked down:

- document-intelligence shipment updates require `receiving:write`
- document file preview URLs require `receiving:read`
- portal export routes scope inventory, orders, and billing to the bound client

## Product Personas

Defined in [personas.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/personas.ts).

These are product-facing identities derived from the stored model.

### Supported Personas

- `superadmin`
  - source: `users.is_superadmin`
  - default base-domain route: `/platform`

- `tenant_admin`
  - source: tenant role `admin`
  - default tenant route: `/dashboard`

- `tenant_manager`
  - source: tenant role `manager`
  - default tenant route: `/dashboard`

- `warehouse_worker`
  - source: tenant role `warehouse_worker`

- `operator`
  - source: derived from `warehouse_worker`
  - default tenant route: `/my-tasks`
  - primary shell: operator app

- `viewer`
  - source: tenant role `viewer`
  - default tenant route: `/dashboard`

- `portal_user`
  - source: tenant membership plus `portal_client_id`
  - today this is usually a `viewer` with client scoping
  - default tenant route: `/portal/inventory`
  - primary shell: portal app

Important current decision:

- `portal_user` and `operator` are first-class product personas
- they are not first-class persisted enum roles yet

## Routing Rules

The middleware and layouts enforce persona-specific entry behavior.

### Base Domain: `wms.ramola.app`

- superadmin -> `/platform`
- tenant users -> first tenant subdomain
- tenant root `/` respects the persona default path for that tenant

### Tenant Subdomain

- portal-bound users are redirected into `/portal/*`
- warehouse-worker/operator users default to `/my-tasks`
- admin, manager, and viewer users default to `/dashboard`

### Portal Shell

- requires `portal_client_id`
- redirects only on the intended portal-binding failure
- unexpected runtime failures should surface normally instead of looping

## Admin UX Implications

The current admin-facing interpretation is:

- role assignment still uses the four stored tenant roles
- persona badges in user management expose the derived product personas
- invite UI now supports three explicit access experiences:
  - standard team member
  - operator
  - portal user
- portal users can now be bound or unbound directly from the users table
- invite UI explains the current mappings:
  - `operator` = `warehouse_worker` + floor app access
  - `portal_user` = `viewer` + client binding

This means admins can manage the current model without needing new stored roles.

## Custom Permission Overrides

Ramola now supports user-specific exceptions on top of the base tenant role.

Stored on `tenant_users.permission_overrides`:

- `grants`
  - additive permissions not normally present in the base role
- `denies`
  - explicit removals from the base role

Rules:

- base role still provides the default bundle
- explicit deny wins over inherited role access
- explicit grant can elevate access beyond the base role
- unknown permission keys are ignored during normalization and still fail closed in enforcement

Example:

- a `viewer` can be granted `billing:read`
- a `manager` can be denied `orders:write`
- a `warehouse_worker` can be granted `reports:read` without becoming a full `manager`

### Effective Permission Resolution

The effective access model is:

1. start with permissions inherited from `tenant_users.role`
2. add `permission_overrides.grants`
3. subtract `permission_overrides.denies`

Implementation authority:

- [rbac.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/rbac.ts)
- [session.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/session.ts)
- [context.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/tenant/context.ts)

### Admin UX

Tenant admins can now open `Settings -> Users` and manage:

- base role
- portal client binding
- custom grants
- custom denies

The users table now shows:

- personas
- portal access
- `Custom Access` status when overrides exist

The custom-permissions dialog shows:

- inherited role access
- additive grants
- explicit denials
- effective permission count
- permission diff summary
- copy-from-user support for custom grants/denies

### Audit Logging

Role, portal-binding, and custom-permission changes now write tenant audit-log records with before/after values for:

- `role`
- `portalClientId`
- `permissionOverrides`

This keeps the four base roles intact while still handling real-world exceptions.

## Seed Persona Matrix

The Armstrong seed tenant is the reference persona matrix for local/demo use.

Defined in [armstrong-personas.ts](/Users/cisco.sanchez/Sales/armstrong/wms/scripts/seed-data/armstrong-personas.ts).

Seeded personas:

- `superadmin@ramola.io` -> platform superadmin
- `admin@armstrong.com` -> tenant admin
- `manager@armstrong.com` -> tenant manager
- `receiving@armstrong.com` -> warehouse worker
- `warehouse@armstrong.com` -> warehouse worker
- `viewer@armstrong.com` -> tenant viewer
- `portal@arteriors.com` -> portal viewer scoped to `ARTERIORS`

Protected by:

- [seed-persona-matrix.test.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/seed-persona-matrix.test.ts)

## Test Coverage

Key RBAC and persona coverage:

- [rbac-consistency.test.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/rbac-consistency.test.ts)
- [read-permission-contracts.test.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/read-permission-contracts.test.ts)
- [remaining-rbac-contracts.test.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/remaining-rbac-contracts.test.ts)
- [sidebar-rbac.test.tsx](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/sidebar-rbac.test.tsx)
- [portal-context.test.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/portal-context.test.ts)
- [portal-layout-boundary.test.tsx](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/portal-layout-boundary.test.tsx)
- [personas.test.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/personas.test.ts)
- [export-portal-scope.test.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/export-portal-scope.test.ts)
- [middleware-personas.test.ts](/Users/cisco.sanchez/Sales/armstrong/wms/tests/unit/middleware-personas.test.ts)

## Current Design Decisions

Intentional choices right now:

- prefer derived personas over persisted role explosion
- keep `portal_user` client-scoped rather than tenant-wide
- keep middleware persona routing as a UX accelerator, not the only security control
- require server-side permission checks and portal scoping on sensitive actions and exports

## Phase 3 Governance

RBAC now includes a governance layer on top of raw permission overrides:

- `Settings -> Users` includes an `Access Review` summary for tenant admins.
- Each user now shows risk flags for unusual combinations such as:
  - `viewer` + sensitive write permissions
  - portal-bound users with broad tenant write access
  - operator/manager shell mismatches caused by denials
- The custom-permissions dialog supports reusable presets such as:
  - `Billing Reviewer`
  - `Receiving Lead`
  - `Floor Supervisor`
  - `Support Read-Only`

These are still built on the same underlying model:

- base tenant role
- optional portal client binding
- additive permission grants
- explicit permission denies

No new persisted tenant roles were introduced for Phase 3.

## Phase 4 Controls

Phase 4 adds two stronger governance controls:

- Tenant admins can export an `Access Review` CSV from `Settings -> Users`
- The system now blocks unsafe override combinations instead of only flagging them

Current hard policy constraints:

- Portal-bound users cannot be granted:
  - `Users: Write`
  - `Settings: Write`
  - `Billing: Approve`
- `viewer` cannot be elevated to `Settings: Write`

These are intentionally narrow. The goal is to block only the combinations that are clearly unsafe without turning the RBAC system into a heavyweight policy engine.

## Phase 5 Tenant Governance

Phase 5 adds tenant-level RBAC reuse and review workflow support:

- tenant admins can save custom permission bundles as tenant-specific presets
- presets can be bulk-applied to multiple users from the users admin screen
- each tenant can track an access-review cadence
- admins can mark a review cycle complete and the next due date is calculated automatically

Implementation notes:

- tenant-specific preset and review metadata are stored in `Tenant.settings.rbac`
- global presets still exist in code as shared defaults
- tenant-saved presets are additive to those shared defaults in the UI

This keeps the role model stable while making RBAC practical for recurring review and repeat admin operations.

## Warehouse-Level Access Scoping

### Model

`tenant_users` has an optional `warehouse_access` JSON column. Each entry is
`{ warehouseId: string, role?: TenantRole }`.

Three semantic states:

- `null` (not set) — unrestricted; actor sees all warehouses. `admin` role always
  resolves to `null` regardless of the stored value.
- `[]` (empty array) — fully revoked; actor sees no warehouses.
- `[...]` (one or more entries) — restricted to the listed warehouse IDs.

### Key Functions

Defined in
[rbac.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/rbac.ts):

- `getAccessibleWarehouseIds(role, warehouseAccess)` — returns `null`
  (unrestricted) or `string[]`
- `getEffectiveWarehouseRole(tenantRole, warehouseAccess, warehouseId)` —
  returns the effective role at a specific warehouse, or `null` if no access

### Enforcement: Inbound (Receiving)

All actions in
[receiving/actions.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/modules/receiving/actions.ts)
call `assertShipmentWarehouseAccess(tenant, shipmentId, accessibleIds)`:

- no-op when `accessibleIds === null`
- throws "Access denied" when `shipment.warehouseId` is `null` (legacy/pre-migration rows — fail-closed for scoped actors)
- throws "Access denied" when `shipment.warehouseId` is not in `accessibleIds`

Actions that enforce this: `getShipment`, `createShipment`, `addShipmentLine`,
`updateShipmentStatus`, `receiveLine`, `getDiscrepancies`, `createDiscrepancy`,
`resolveDiscrepancy`.

### Enforcement: Outbound (Shipping)

Outbound `Shipment` has no direct `warehouseId` field. Warehouse scope is
resolved via the pick task chain:

```
Shipment → order.picks → lines → bin → shelf → rack → aisle → zone → warehouseId
```

Actions that enforce this:

- `getShipmentsReadyForRelease`, `getReleasedShipmentsToday` (read) — filter via
  Prisma relation chains
- `releaseShipment`, `markShipmentShipped`, `getLabelDownloadUrl` (write/read) —
  require at least one `PickTaskLine` in an accessible bin before proceeding;
  fail-closed: no pick lines found → deny

### Fail-Closed Rules

1. `null` warehouseId on an inbound shipment = denied for scoped actors
2. No accessible pick lines for an outbound order = denied for scoped actors
3. `admin` role is always unrestricted (`getAccessibleWarehouseIds` returns
   `null`)

### Implementation Authority

- [src/lib/auth/rbac.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/lib/auth/rbac.ts)
  — `getAccessibleWarehouseIds`, `getEffectiveWarehouseRole`
- [src/modules/receiving/actions.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/modules/receiving/actions.ts)
  — `assertShipmentWarehouseAccess`
- [src/modules/shipping/release-actions.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/modules/shipping/release-actions.ts)
  — outbound read scope
- [src/modules/shipping/ship-actions.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/modules/shipping/ship-actions.ts)
  — outbound write scope
- [src/modules/dashboard/manager-actions.ts](/Users/cisco.sanchez/Sales/armstrong/wms/src/modules/dashboard/manager-actions.ts)
  — manager board release gate scope
