-- Add warehouse_id to inbound_shipments for warehouse-scoped filtering.
-- Nullable to preserve backward compatibility with existing records.
-- Existing rows stay null; new shipments must set this via the application.

ALTER TABLE "inbound_shipments"
  ADD COLUMN "warehouse_id" TEXT;

ALTER TABLE "inbound_shipments"
  ADD CONSTRAINT "inbound_shipments_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "inbound_shipments_warehouse_id_idx"
  ON "inbound_shipments"("warehouse_id");
