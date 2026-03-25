# Data Model

## Public Schema (shared across all tenants)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   tenants    │     │    users     │     │   sessions   │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │     │ id           │     │ id           │
│ name         │     │ email        │     │ session_token│
│ slug         │◄────┤ password_hash│     │ user_id ────►│
│ db_schema    │     │ name         │     │ expires      │
│ status       │     │ is_superadmin│     └──────────────┘
│ plan         │     └──────┬───────┘
│ settings     │            │
└──────┬───────┘     ┌──────┴───────┐
       │             │ tenant_users │
       └─────────────┤              │
                     │ tenant_id    │
                     │ user_id      │
                     │ role (RBAC)  │
                     └──────────────┘
```

## Tenant Schema (replicated per tenant)

### Core Entities

```
┌──────────────┐         ┌──────────────────┐
│   clients    │────────►│     products     │
├──────────────┤    1:M  ├──────────────────┤
│ code (unique)│         │ sku (unique/client│
│ name         │         │ client_id         │
│ contact_*    │         │ hs_code           │
│ address_*    │         │ dimensions        │
│ tax_id       │         │ track_lot         │
└──────────────┘         │ track_serial      │
                         │ min/max_stock     │
                         └────────┬─────────┘
                                  │
                         ┌────────┴─────────┐
                         │ uom_conversions  │
                         │ from_uom, to_uom │
                         │ factor           │
                         └──────────────────┘
```

### Warehouse Layout

```
┌────────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ warehouses │───►│ zones  │───►│ aisles │───►│ racks  │───►│ shelves│───►│  bins  │
└────────────┘1:M └────────┘1:M └────────┘1:M └────────┘1:M └────────┘1:M └────────┘
                  type:                                                     type:
                  storage                                                   standard
                  staging                                                   bulk
                  dock                                                      pick
                  quarantine
                                                                           status:
                                                                           available
                                                                           full
                                                                           reserved
                                                                           blocked
```

### Receiving Module (Freight/3PL)

```
┌───────────────────┐       ┌────────────────────────┐
│ inbound_shipments │──────►│ inbound_shipment_lines │
├───────────────────┤  1:M  ├────────────────────────┤
│ shipment_number   │       │ product_id              │
│ client_id         │       │ expected_qty            │
│ carrier           │       │ received_qty            │
│ tracking_number   │       │ lot_number              │
│ bol_number        │       └────────────┬───────────┘
│ status            │                    │
│ expected_date     │       ┌────────────┴───────────┐
└────────┬──────────┘       │ receiving_transactions │
         │                  ├────────────────────────┤
         │                  │ quantity                │
         │                  │ condition (good/damaged)│
         │                  │ bin_id                  │
         │                  │ lot/serial_number       │
         │                  │ received_by             │
         │                  └────────────────────────┘
         │
         ├─────►┌────────────────────────┐
         │      │ receiving_discrepancies│
         │      │ type: shortage/overage │
         │      │ status: open/resolved  │
         │      └────────────────────────┘
         │
         └─────►┌──────────┐
                │ documents│
                │ BOLs     │
                │ photos   │
                └──────────┘

Status workflow:
  draft → expected → arrived → receiving → inspection → completed
                                                      → cancelled
```

### Fulfillment Module (DTC/E-Commerce)

```
┌────────────────┐      ┌──────────┐       ┌─────────────┐
│ sales_channels │─────►│  orders  │──────►│ order_lines │
├────────────────┤ 1:M  ├──────────┤  1:M  ├─────────────┤
│ type: shopify  │      │ order_#  │       │ product_id   │
│   amazon       │      │ client_id│       │ quantity     │
│   walmart      │      │ status   │       │ picked_qty   │
│   manual       │      │ priority │       │ packed_qty   │
│   api          │      │ ship_to_*│       └─────────────┘
│ config (JSON)  │      │ ship_by  │
└────────────────┘      └────┬─────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────┴───────┐  ┌──┴──────┐  ┌───┴──────────┐
     │   pick_tasks   │  │shipments│  │shipment_items│
     ├────────────────┤  ├─────────┤  └──────────────┘
     │ method: single │  │ carrier │
     │   batch/wave   │  │ service │
     │   zone         │  │ tracking│
     │ assigned_to    │  │ label   │
     │ status         │  │ cost    │
     └───────┬────────┘  └─────────┘
             │
     ┌───────┴────────┐
     │pick_task_lines │
     │ product_id     │
     │ bin_id         │
     │ quantity       │
     │ picked_qty     │
     └────────────────┘

Order status workflow:
  pending → awaiting_fulfillment → allocated → picking → picked
         → packing → packed → shipped → delivered
         → cancelled / on_hold / backordered
```

### Inventory (Shared)

```
┌──────────────┐          ┌────────────────────────┐
│  inventory   │          │ inventory_transactions │
├──────────────┤          ├────────────────────────┤
│ product_id   │          │ type (receive/putaway/ │
│ bin_id       │          │   move/adjust/pick)    │
│ lot_number   │          │ product_id             │
│ serial_number│          │ from_bin_id            │
│ on_hand      │          │ to_bin_id              │
│ allocated    │          │ quantity               │
│ available    │◄─────────│ reference_type/id      │
│ (computed)   │ rebuilt  │ performed_by           │
└──────────────┘ from     │ performed_at           │
                 ledger   └────────────────────────┘

┌─────────────────────┐     ┌──────────────────┐
│inventory_adjustments│────►│ adjustment_lines │
├─────────────────────┤1:M  ├──────────────────┤
│ adjustment_number   │     │ product_id       │
│ type (adj/count)    │     │ bin_id           │
│ status              │     │ system_qty       │
│ reason              │     │ counted_qty      │
│ approved_by         │     │ variance         │
└─────────────────────┘     └──────────────────┘

┌──────────────────┐
│ cycle_count_plans│
│ method: abc/zone │
│ frequency        │
│ config           │
└──────────────────┘
```

### Infrastructure

```
┌────────────┐  ┌───────────────┐  ┌───────────────────┐  ┌──────────────────┐
│ audit_log  │  │ notifications │  │ sequence_counters │  │ carrier_accounts │
├────────────┤  ├───────────────┤  ├───────────────────┤  ├──────────────────┤
│ user_id    │  │ user_id       │  │ prefix (ASN/ORD)  │  │ carrier          │
│ action     │  │ title/message │  │ year              │  │ account_number   │
│ entity_*   │  │ type/is_read  │  │ current           │  │ credentials      │
│ changes    │  │ link          │  │                   │  │ is_active        │
└────────────┘  └───────────────┘  └───────────────────┘  └──────────────────┘
```

### Billing Module

```
┌──────────────┐      ┌──────────────────┐      ┌───────────┐
│  rate_cards  │─────►│ billing_events   │─────►│ invoices  │
├──────────────┤ 1:M  ├──────────────────┤  M:1 ├───────────┤
│ client_id    │      │ client_id        │      │ client_id │
│ service_type │      │ service_type     │      │ period    │
│ unit_rate    │      │ qty              │      │ total     │
│ min_qty      │      │ amount           │      │ status    │
│ is_active    │      │ reference_type/id│      │ due_date  │
└──────────────┘      │ occurred_at      │      └───────────┘
                      │ invoice_id       │
                      └──────────────────┘
```

### Product Packaging (added 2026-03-20)

Products now include:

- `units_per_case` (int, optional) — how many units per carton/case
- `case_barcode` (string, optional) — barcode for case-level scanning

These fields support the scan-out verification feature (#3a) where operators need clarity on whether pick quantities are individual units or full cartons.

### Integration Credentials

Marketplace credentials are stored in `SalesChannel.config` (JSON field per tenant):

```json
{
  "shopDomain": "store.myshopify.com",
  "accessToken": "shpat_...",
  "apiVersion": "2026-01",
  "clientCode": "Ramola"
}
```

Carrier and ERP credentials are stored in `Tenant.settings` (JSON field in public schema):

```json
{
  "ups": { "accountNumber": "...", "clientId": "...", "clientSecret": "..." },
  "netsuite": { "accountId": "...", "consumerKey": "...", ... }
}
```

This replaces the single-tenant pattern of global env vars, enabling multi-tenant credential management.

---

## Complete Tenant Schema Model List (76 models)

### Core

Client, Product, UomConversion, Warehouse, Zone, Aisle, Rack, Shelf, Bin

### Receiving

InboundShipment, InboundShipmentLine, ReceivingTransaction, ReceivingDiscrepancy, Document, DocumentProcessingJob, InspectionChecklist, InspectionChecklistItem, InspectionResult

### Inventory

Inventory, InventoryTransaction, InventoryAdjustment, AdjustmentLine, PutawayRule, CycleCountPlan

### Fulfillment

SalesChannel, Order, OrderLine, PickTask, PickTaskLine, Shipment, ShipmentItem, CarrierAccount

### Billing

RateCard, RateCardLine, BillingEvent, Invoice, InvoiceLine, BillingDispute

### Yard & Dock

DockDoor, YardSpot, DockAppointment, YardVisit

### Labor

OperatorShift, TaskTimeLog, LaborRate

### Returns

ReturnAuthorization, ReturnLine, ReturnInspection

### Cartonization

CartonType, PackPlan, PackPlanLine

### Slotting

SlottingConfig, SlottingRun, SlottingRecommendation

### Interleaving

InterleavedRoute, InterleavedStep

### VAS / Kitting

KitDefinition, KitComponent, VasTask

### Cross-Dock

CrossDockRule, CrossDockPlan

### LPN / Container

Lpn, LpnContent

### Compliance

ComplianceCheck, HazmatFlag

### Customs

CustomsEntry, CustomsEntryLine, BondedInventory

### Automation

AutomationDevice, DeviceTask

### Replenishment

ReplenishmentRule

### Transfers

TransferOrder, TransferOrderLine

### Workflow

WorkflowRule

### Infrastructure

AuditLog, Notification, SequenceCounter
