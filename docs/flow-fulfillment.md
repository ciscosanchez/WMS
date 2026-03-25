# Fulfillment Flow (DTC/E-Commerce)

## Overview

The fulfillment flow handles outbound orders from sales channels (Shopify, Amazon, Walmart, manual, API). Orders are received, inventory is allocated, pick tasks are generated, items are packed, and shipments go out with carrier labels and tracking.

## Order Status Workflow

```
  ┌─────────┐     ┌──────────────────────┐     ┌───────────┐     ┌─────────┐
  │ PENDING │────►│ AWAITING_FULFILLMENT │────►│ ALLOCATED │────►│ PICKING │
  └─────────┘     └──────────────────────┘     └───────────┘     └─────┬───┘
                                                                       │
  ┌───────────┐     ┌────────┐     ┌─────────┐     ┌────────┐        │
  │ DELIVERED │◄────│SHIPPED │◄────│ PACKED  │◄────│PACKING │◄───────┘
  └───────────┘     └────────┘     └─────────┘     └────────┘   via PICKED

  Exceptions:  → CANCELLED  |  → ON_HOLD  |  → BACKORDERED
```

## Step-by-Step Flow

### 1. Order Ingestion

Orders enter the system from multiple sources:

```
┌──────────┐
│  Shopify │──┐
└──────────┘  │
┌──────────┐  │    ┌─────────────┐     ┌────────────┐
│  Amazon  │──┼───►│ Ramola   │────►│   orders   │
└──────────┘  │    │ Order Sync  │     │ order_lines │
┌──────────┐  │    └─────────────┘     └────────────┘
│ Walmart  │──┤
└──────────┘  │
┌──────────┐  │
│ Manual/  │──┘
│ API      │
└──────────┘
```

Each order includes:

- Order number + external marketplace ID
- Client (cargo owner)
- Ship-to address
- Line items (product, qty, price)
- Priority: standard | expedited | rush | same_day
- Ship-by date

### 2. Inventory Allocation

**Who**: System (automatic) or Manager (manual)
**What**: Reserve inventory for the order

```
For each order line:
  1. Find available inventory (product + available > 0)
  2. Prefer bins closest to packing area
  3. Respect FIFO by lot date if lot-tracked
  4. Decrement inventory.available, increment inventory.allocated
  5. Create inventory_transaction (type: "allocate")

If insufficient stock → status: BACKORDERED
If all lines allocated → status: ALLOCATED
```

### 3. Pick Task Generation

**Who**: System or Manager
**What**: Create optimized pick tasks

```
Pick Methods:
┌─────────────────┬──────────────────────────────────────────┐
│ Single Order    │ One task per order. Simple, low volume.  │
│ Batch Picking   │ Multiple orders combined into one walk.  │
│ Wave Picking    │ Time-boxed batches grouped by zone/      │
│                 │ carrier/priority. High volume.           │
│ Zone Picking    │ Each picker owns a zone. Lines split     │
│                 │ across zones, consolidated at packing.   │
└─────────────────┴──────────────────────────────────────────┘

→ generatePickTask(orderId, method)
→ nextSequence("PICK") → "PICK-2026-0012"
→ Creates pick_task + pick_task_lines
→ Each line: product, bin, quantity to pick
→ Order status → PICKING
```

### 4. Pick Execution

**Who**: Warehouse worker (mobile device or scanner)
**What**: Walk the warehouse, pick items from bins

```
For each pick_task_line:
  1. Navigate to bin (barcode scan)
  2. Scan product barcode
  3. Confirm quantity picked
  4. If short: mark as short_picked, flag for resolution

→ Update pick_task_line.picked_qty
→ Decrement inventory (on_hand, allocated)
→ Create inventory_transaction (type: "pick")
→ When all lines picked → task status: COMPLETED
→ Order status → PICKED
```

### 5. Packing

**Who**: Warehouse worker at packing station
**What**: Pack items into shipping boxes

```
1. Scan order/pick task
2. Verify all items present
3. Select or auto-suggest box size (based on dimensions)
4. Record package weight and dimensions
5. Capture any value-added services (labeling, kitting)

→ Order status → PACKING → PACKED
```

### 6. Shipping

**Who**: Warehouse worker or System
**What**: Generate shipping labels, record tracking

```
Rate Shopping:
  1. Get package dimensions + weight
  2. Query configured carriers (UPS, FedEx, USPS, etc.)
  3. Compare rates for requested service level
  4. Select cheapest or fastest option
  5. Generate label + tracking number

→ Create shipment record
→ Create shipment_items
→ Store label URL (MinIO/S3)
→ Order status → SHIPPED
→ Push tracking to sales channel
```

### 7. Delivery Confirmation

**Who**: System (carrier webhook) or Manual
**What**: Mark order as delivered

```
→ Order status → DELIVERED
→ Notify client
```

## Sequence Diagram

```
Channel          System              Warehouse Worker        Carrier
   │                │                      │                    │
   │  New order     │                      │                    │
   ├───────────────►│                      │                    │
   │                │  Allocate inventory   │                    │
   │                ├─────────────────────►│                    │
   │                │                      │                    │
   │                │  Generate pick task   │                    │
   │                ├─────────────────────►│                    │
   │                │                      │  Pick items        │
   │                │                      ├───── (scan/pick)   │
   │                │                      │                    │
   │                │  Pick complete        │                    │
   │                │◄─────────────────────┤                    │
   │                │                      │  Pack order        │
   │                │                      ├───── (verify/box)  │
   │                │                      │                    │
   │                │  Rate shop           │                    │
   │                ├──────────────────────┼───────────────────►│
   │                │  Label + tracking    │                    │
   │                │◄─────────────────────┼────────────────────┤
   │                │                      │                    │
   │  Tracking #    │                      │  Ship package      │
   │◄───────────────┤                      ├───────────────────►│
   │                │                      │                    │
   │                │  Delivery confirmed  │                    │
   │                │◄─────────────────────┼────────────────────┤
   │  Delivered     │                      │                    │
   │◄───────────────┤                      │                    │
```

## KPIs

| Metric                 | Description                             |
| ---------------------- | --------------------------------------- |
| Orders pending         | Orders not yet allocated                |
| Pick tasks in progress | Active picking work                     |
| Average pick time      | Time from task creation to completion   |
| Packing throughput     | Orders packed per hour                  |
| Ship-by compliance     | % of orders shipped before ship-by date |
| Short picks            | Pick tasks with insufficient inventory  |
| Carrier cost/order     | Average shipping cost per order         |
