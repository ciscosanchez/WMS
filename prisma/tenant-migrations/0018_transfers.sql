-- Migration: 0018_transfers
-- Multi-warehouse transfer orders

CREATE TYPE "TransferOrderStatus" AS ENUM ('draft', 'approved', 'in_transit', 'received', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS "transfer_orders" (
  "id" TEXT NOT NULL,
  "transfer_number" TEXT NOT NULL,
  "from_warehouse_id" TEXT NOT NULL,
  "to_warehouse_id" TEXT NOT NULL,
  "status" "TransferOrderStatus" NOT NULL DEFAULT 'draft',
  "requested_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMPTZ,
  "shipped_at" TIMESTAMPTZ,
  "received_at" TIMESTAMPTZ,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "transfer_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transfer_orders_transfer_number_key" UNIQUE ("transfer_number"),
  CONSTRAINT "transfer_orders_from_warehouse_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id"),
  CONSTRAINT "transfer_orders_to_warehouse_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id")
);

CREATE INDEX IF NOT EXISTS "idx_transfer_orders_from" ON "transfer_orders" ("from_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_transfer_orders_to" ON "transfer_orders" ("to_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_transfer_orders_status" ON "transfer_orders" ("status");

CREATE TABLE IF NOT EXISTS "transfer_order_lines" (
  "id" TEXT NOT NULL,
  "transfer_order_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "received_qty" INTEGER NOT NULL DEFAULT 0,
  "lot_number" TEXT,
  "notes" TEXT,
  CONSTRAINT "transfer_order_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transfer_order_lines_transfer_fkey" FOREIGN KEY ("transfer_order_id") REFERENCES "transfer_orders"("id") ON DELETE CASCADE,
  CONSTRAINT "transfer_order_lines_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id")
);

CREATE INDEX IF NOT EXISTS "idx_transfer_order_lines_to" ON "transfer_order_lines" ("transfer_order_id");
