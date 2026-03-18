-- CreateEnum
CREATE TYPE "BinType" AS ENUM ('standard', 'bulk', 'pick');

-- CreateEnum
CREATE TYPE "BinStatus" AS ENUM ('available', 'full', 'reserved', 'blocked');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('draft', 'expected', 'arrived', 'receiving', 'inspection', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('good', 'damaged', 'quarantine');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('pending', 'passed', 'failed', 'waived');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('shortage', 'overage', 'damage');

-- CreateEnum
CREATE TYPE "DiscrepancyStatus" AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('receive', 'putaway', 'move', 'adjust', 'count', 'allocate', 'deallocate');

-- CreateEnum
CREATE TYPE "PutawayStrategy" AS ENUM ('fixed', 'zone', 'closest_empty', 'consolidate');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'completed');

-- CreateEnum
CREATE TYPE "CycleCountFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "CycleCountMethod" AS ENUM ('abc', 'zone', 'full', 'random');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'awaiting_fulfillment', 'allocated', 'picking', 'picked', 'packing', 'packed', 'shipped', 'delivered', 'cancelled', 'on_hold', 'backordered');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('standard', 'expedited', 'rush', 'same_day');

-- CreateEnum
CREATE TYPE "PickMethod" AS ENUM ('single_order', 'batch', 'wave', 'zone');

-- CreateEnum
CREATE TYPE "PickTaskStatus" AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'short_picked');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "zip_code" TEXT,
    "tax_id" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hs_code" TEXT,
    "barcode" TEXT,
    "weight" DECIMAL(10,4),
    "weight_unit" TEXT DEFAULT 'lb',
    "length" DECIMAL(10,2),
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "dim_unit" TEXT DEFAULT 'in',
    "base_uom" TEXT NOT NULL DEFAULT 'EA',
    "track_lot" BOOLEAN NOT NULL DEFAULT false,
    "track_serial" BOOLEAN NOT NULL DEFAULT false,
    "min_stock" INTEGER,
    "max_stock" INTEGER,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uom_conversions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "from_uom" TEXT NOT NULL,
    "to_uom" TEXT NOT NULL,
    "factor" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "uom_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'storage',

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aisles" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "aisles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racks" (
    "id" TEXT NOT NULL,
    "aisle_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelves" (
    "id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bins" (
    "id" TEXT NOT NULL,
    "shelf_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "type" "BinType" NOT NULL DEFAULT 'standard',
    "status" "BinStatus" NOT NULL DEFAULT 'available',
    "capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_shipments" (
    "id" TEXT NOT NULL,
    "shipment_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "carrier" TEXT,
    "tracking_number" TEXT,
    "bol_number" TEXT,
    "po_number" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'draft',
    "expected_date" TIMESTAMP(3),
    "arrived_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_shipment_lines" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "received_qty" INTEGER NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL DEFAULT 'EA',
    "lot_number" TEXT,
    "serial_number" TEXT,
    "notes" TEXT,

    CONSTRAINT "inbound_shipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_transactions" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "bin_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "condition" "ItemCondition" NOT NULL DEFAULT 'good',
    "inspection_status" "InspectionStatus" NOT NULL DEFAULT 'pending',
    "lot_number" TEXT,
    "serial_number" TEXT,
    "received_by" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "receiving_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checklists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "inspection_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'pass_fail',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inspection_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_results" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "inspected_by" TEXT NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_discrepancies" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "type" "DiscrepancyType" NOT NULL,
    "status" "DiscrepancyStatus" NOT NULL DEFAULT 'open',
    "description" TEXT NOT NULL,
    "product_id" TEXT,
    "expected_qty" INTEGER,
    "actual_qty" INTEGER,
    "resolution" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "lot_number" TEXT,
    "serial_number" TEXT,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "allocated" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL DEFAULT 'EA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "product_id" TEXT NOT NULL,
    "from_bin_id" TEXT,
    "to_bin_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "lot_number" TEXT,
    "serial_number" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "reason" TEXT,
    "performed_by" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "putaway_rules" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "bin_id" TEXT,
    "zone_code" TEXT,
    "strategy" "PutawayStrategy" NOT NULL DEFAULT 'closest_empty',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "putaway_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "adjustment_number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'adjustment',
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'draft',
    "reason" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment_lines" (
    "id" TEXT NOT NULL,
    "adjustment_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "lot_number" TEXT,
    "serial_number" TEXT,
    "system_qty" INTEGER NOT NULL,
    "counted_qty" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_count_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "CycleCountMethod" NOT NULL,
    "frequency" "CycleCountFrequency" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_count_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "external_id" TEXT,
    "channel_id" TEXT,
    "client_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "priority" "OrderPriority" NOT NULL DEFAULT 'standard',
    "ship_to_name" TEXT NOT NULL,
    "ship_to_address1" TEXT NOT NULL,
    "ship_to_address2" TEXT,
    "ship_to_city" TEXT NOT NULL,
    "ship_to_state" TEXT,
    "ship_to_zip" TEXT NOT NULL,
    "ship_to_country" TEXT NOT NULL DEFAULT 'US',
    "ship_to_phone" TEXT,
    "ship_to_email" TEXT,
    "requested_carrier" TEXT,
    "requested_service" TEXT,
    "shipping_method" TEXT,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ship_by_date" TIMESTAMP(3),
    "shipped_date" TIMESTAMP(3),
    "delivered_date" TIMESTAMP(3),
    "cancelled_date" TIMESTAMP(3),
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "total_weight" DECIMAL(10,4),
    "notes" TEXT,
    "tags" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "picked_qty" INTEGER NOT NULL DEFAULT 0,
    "packed_qty" INTEGER NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL DEFAULT 'EA',
    "unit_price" DECIMAL(10,2),
    "lot_number" TEXT,
    "serial_number" TEXT,
    "notes" TEXT,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_tasks" (
    "id" TEXT NOT NULL,
    "task_number" TEXT NOT NULL,
    "order_id" TEXT,
    "method" "PickMethod" NOT NULL DEFAULT 'single_order',
    "status" "PickTaskStatus" NOT NULL DEFAULT 'pending',
    "assigned_to" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pick_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_task_lines" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "picked_qty" INTEGER NOT NULL DEFAULT 0,
    "lot_number" TEXT,
    "serial_number" TEXT,

    CONSTRAINT "pick_task_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "shipment_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "carrier" TEXT,
    "service" TEXT,
    "tracking_number" TEXT,
    "label_url" TEXT,
    "package_weight" DECIMAL(10,4),
    "package_length" DECIMAL(10,2),
    "package_width" DECIMAL(10,2),
    "package_height" DECIMAL(10,2),
    "shipping_cost" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lot_number" TEXT,
    "serial_number" TEXT,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "account_number" TEXT,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrier_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_counters" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequence_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_processing_jobs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT,
    "source_type" TEXT NOT NULL,
    "document_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "extracted_data" JSONB,
    "confidence" DOUBLE PRECISION,
    "ai_model" TEXT,
    "ai_cost" DOUBLE PRECISION,
    "reviewed_data" JSONB,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "result_type" TEXT,
    "result_id" TEXT,
    "request_id" TEXT,
    "tenant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "document_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_client_id_sku_key" ON "products"("client_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "uom_conversions_product_id_from_uom_to_uom_key" ON "uom_conversions"("product_id", "from_uom", "to_uom");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "zones_warehouse_id_code_key" ON "zones"("warehouse_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "aisles_zone_id_code_key" ON "aisles"("zone_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "racks_aisle_id_code_key" ON "racks"("aisle_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "shelves_rack_id_code_key" ON "shelves"("rack_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bins_barcode_key" ON "bins"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "bins_shelf_id_code_key" ON "bins"("shelf_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_shipments_shipment_number_key" ON "inbound_shipments"("shipment_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_product_id_bin_id_lot_number_serial_number_key" ON "inventory"("product_id", "bin_id", "lot_number", "serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustments_adjustment_number_key" ON "inventory_adjustments"("adjustment_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_client_id_idx" ON "orders"("client_id");

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");

-- CreateIndex
CREATE UNIQUE INDEX "pick_tasks_task_number_key" ON "pick_tasks"("task_number");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipment_number_key" ON "shipments"("shipment_number");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_counters_prefix_year_key" ON "sequence_counters"("prefix", "year");

-- CreateIndex
CREATE INDEX "document_processing_jobs_status_idx" ON "document_processing_jobs"("status");

-- CreateIndex
CREATE INDEX "document_processing_jobs_document_type_idx" ON "document_processing_jobs"("document_type");

-- CreateIndex
CREATE INDEX "document_processing_jobs_tenant_id_idx" ON "document_processing_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "document_processing_jobs_created_at_idx" ON "document_processing_jobs"("created_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aisles" ADD CONSTRAINT "aisles_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_aisle_id_fkey" FOREIGN KEY ("aisle_id") REFERENCES "aisles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_shelf_id_fkey" FOREIGN KEY ("shelf_id") REFERENCES "shelves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_shipments" ADD CONSTRAINT "inbound_shipments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_shipment_lines" ADD CONSTRAINT "inbound_shipment_lines_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "inbound_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_shipment_lines" ADD CONSTRAINT "inbound_shipment_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transactions" ADD CONSTRAINT "receiving_transactions_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "inbound_shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transactions" ADD CONSTRAINT "receiving_transactions_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "inbound_shipment_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transactions" ADD CONSTRAINT "receiving_transactions_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "inspection_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "inspection_checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inspection_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "inbound_shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "inbound_shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_from_bin_id_fkey" FOREIGN KEY ("from_bin_id") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_to_bin_id_fkey" FOREIGN KEY ("to_bin_id") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_rules" ADD CONSTRAINT "putaway_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_rules" ADD CONSTRAINT "putaway_rules_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "inventory_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "sales_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "pick_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
