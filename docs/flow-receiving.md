# Receiving Flow (Freight/3PL)

## Overview

The receiving flow handles inbound freight shipments from carriers. It follows an ASN (Advance Shipment Notice) model where expected shipments are registered before arrival, then processed through a multi-step receiving workflow.

## Status Workflow

```
  ┌───────┐     ┌──────────┐     ┌─────────┐     ┌───────────┐     ┌────────────┐     ┌───────────┐
  │ DRAFT │────►│ EXPECTED │────►│ ARRIVED │────►│ RECEIVING │────►│ INSPECTION │────►│ COMPLETED │
  └───────┘     └──────────┘     └─────────┘     └───────────┘     └────────────┘     └───────────┘
                                                                                              │
                                                                                              ▼
                                                                                    Inventory Created
                                                                                    Transactions Logged
```

Any status can transition to `CANCELLED`.

## Step-by-Step Flow

### 1. Create ASN (Draft)

**Who**: Manager, Admin
**What**: Register expected shipment with client, carrier, BOL, tracking, PO number, expected date

```
POST /receiving/new
  → createShipment(data)
  → nextSequence("ASN") → "ASN-2026-0001"
  → status: draft
```

The warehouse selected at creation time determines which scoped operators and managers can subsequently view and process the shipment.

### 2. Add Line Items

**Who**: Manager, Admin
**What**: Add expected products and quantities to the shipment

```
Each line:
  - Product (SKU)
  - Expected quantity
  - UOM
  - Lot number (if applicable)
```

### 3. Mark Expected

**Who**: Manager, Admin
**What**: Confirm the shipment is expected and notify the warehouse

### 4. Mark Arrived

**Who**: Warehouse worker, Manager
**What**: Record physical arrival at the dock

```
→ updateShipmentStatus(id, "arrived")
→ Sets arrived_date = now()
```

### 5. Receive Line Items

**Who**: Warehouse worker
**What**: Process each line item, recording actual quantities, conditions, and bin locations

```
For each receiving event:
  - Select line item
  - Enter quantity received
  - Select condition: good | damaged | quarantine
  - Assign bin location (optional — can stage first)
  - Enter lot/serial number (if tracked)
  - Add notes

→ receiveLine(shipmentId, data)
→ Creates receiving_transaction
→ Increments line.received_qty
→ Auto-transitions shipment to "receiving" status
```

### 6. Log Discrepancies

**Who**: Warehouse worker, Manager
**What**: Report shortages, overages, or damage

```
Discrepancy types:
  - Shortage: received < expected
  - Overage: received > expected
  - Damage: items in poor condition

→ createDiscrepancy(data)
→ Status: open → investigating → resolved → closed
```

### 7. Inspection (Optional)

**Who**: Warehouse worker
**What**: Run quality checks against configurable checklists

```
Inspection checklists:
  - Pass/fail items
  - Numeric measurements
  - Text observations

→ Each result linked to checklist + item
```

### 8. Complete Receiving

**Who**: Manager, Admin
**What**: Finalize the shipment, create inventory records

```
→ updateShipmentStatus(id, "completed")
→ Sets completed_date = now()

→ finalizeReceiving():
    For each receiving_transaction with a bin:
      1. Upsert inventory record (product + bin + lot + serial)
      2. Increment on_hand, recalculate available
      3. Create inventory_transaction (type: "receive")
```

## Sequence Diagram

```
Warehouse Worker              System                    Database
      │                         │                          │
      │  Create ASN             │                          │
      ├────────────────────────►│  Generate ASN-2026-XXXX  │
      │                         ├─────────────────────────►│
      │                         │                          │
      │  Add line items         │                          │
      ├────────────────────────►│  Create shipment_lines   │
      │                         ├─────────────────────────►│
      │                         │                          │
      │  Mark arrived           │                          │
      ├────────────────────────►│  Set arrived_date        │
      │                         ├─────────────────────────►│
      │                         │                          │
      │  Receive items (×N)     │                          │
      ├────────────────────────►│  Create recv_transaction │
      │                         │  Update line.received_qty│
      │                         ├─────────────────────────►│
      │                         │                          │
      │  Report discrepancy     │                          │
      ├────────────────────────►│  Create discrepancy      │
      │                         ├─────────────────────────►│
      │                         │                          │
      │  Complete receiving     │                          │
      ├────────────────────────►│  For each transaction:   │
      │                         │    Upsert inventory      │
      │                         │    Create inv_transaction│
      │                         │    Update bin status     │
      │                         ├─────────────────────────►│
      │                         │                          │
      │  ✓ Done                 │                          │
      │◄────────────────────────┤                          │
```

## Audit Trail

Every action in the receiving flow creates an `audit_log` entry:

- Create shipment
- Add/remove line items
- Status changes (expected, arrived, receiving, completed)
- Each receiving transaction
- Discrepancy creation and resolution
- Document uploads

## Warehouse Access Enforcement

All receiving actions are warehouse-scoped. Every server action in `src/modules/receiving/actions.ts` calls `assertShipmentWarehouseAccess` before touching data.

Rules:

- Admins and users with no `warehouse_access` override are unrestricted — they see all shipments.
- Scoped actors (users with explicit `warehouse_access` assignments) may only access shipments whose `warehouseId` is in their assignment list.
- Shipments with a `null` `warehouseId` (legacy/pre-migration rows) are **denied** for scoped actors (fail-closed).

Affected actions:

- `getShipments` — WHERE filter: `warehouseId IN (accessible)`
- `getShipment` — asserts access before returning detail
- `createShipment` — verifies `data.warehouseId` is accessible before creating
- `addShipmentLine`, `updateShipmentStatus`, `receiveLine` — assert access by shipment ID
- `getDiscrepancies` — WHERE filter via `shipment.warehouseId`
- `createDiscrepancy`, `resolveDiscrepancy` — assert access via the shipment on the discrepancy record

See [docs/rbac.md](rbac.md) for the full warehouse-scoping model.
