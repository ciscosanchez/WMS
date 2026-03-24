-- Migration: 0015_lot_expiration
-- Add expiration date fields for FEFO picking support

ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "expiration_date" TIMESTAMPTZ;
ALTER TABLE "inbound_shipment_lines" ADD COLUMN IF NOT EXISTS "expiration_date" TIMESTAMPTZ;
ALTER TABLE "receiving_transactions" ADD COLUMN IF NOT EXISTS "expiration_date" TIMESTAMPTZ;

-- Index for FEFO picking queries (find earliest expiring stock first)
CREATE INDEX IF NOT EXISTS "idx_inventory_expiration" ON "inventory" ("product_id", "expiration_date") WHERE "expiration_date" IS NOT NULL;

-- Index for expiration alert queries
CREATE INDEX IF NOT EXISTS "idx_inventory_expiring_soon" ON "inventory" ("expiration_date") WHERE "expiration_date" IS NOT NULL AND "available" > 0;
