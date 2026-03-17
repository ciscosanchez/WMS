/*
  Warnings:

  - You are about to drop the `adjustment_lines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aisles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bins` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carrier_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cycle_count_plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `document_processing_jobs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inbound_shipment_lines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inbound_shipments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inspection_checklist_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inspection_checklists` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inspection_results` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventory_adjustments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventory_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_lines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pick_task_lines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pick_tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `putaway_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `racks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `receiving_discrepancies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `receiving_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sales_channels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sequence_counters` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shelves` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipment_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `uom_conversions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `warehouses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `zones` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'provisioning');

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('starter', 'professional', 'enterprise');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('admin', 'manager', 'warehouse_worker', 'viewer');

-- DropForeignKey
ALTER TABLE "adjustment_lines" DROP CONSTRAINT "adjustment_lines_adjustment_id_fkey";

-- DropForeignKey
ALTER TABLE "aisles" DROP CONSTRAINT "aisles_zone_id_fkey";

-- DropForeignKey
ALTER TABLE "bins" DROP CONSTRAINT "bins_shelf_id_fkey";

-- DropForeignKey
ALTER TABLE "document_processing_jobs" DROP CONSTRAINT "document_processing_jobs_document_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "inbound_shipment_lines" DROP CONSTRAINT "inbound_shipment_lines_product_id_fkey";

-- DropForeignKey
ALTER TABLE "inbound_shipment_lines" DROP CONSTRAINT "inbound_shipment_lines_shipment_id_fkey";

-- DropForeignKey
ALTER TABLE "inbound_shipments" DROP CONSTRAINT "inbound_shipments_client_id_fkey";

-- DropForeignKey
ALTER TABLE "inspection_checklist_items" DROP CONSTRAINT "inspection_checklist_items_checklist_id_fkey";

-- DropForeignKey
ALTER TABLE "inspection_results" DROP CONSTRAINT "inspection_results_checklist_id_fkey";

-- DropForeignKey
ALTER TABLE "inspection_results" DROP CONSTRAINT "inspection_results_item_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_bin_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_product_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_transactions" DROP CONSTRAINT "inventory_transactions_from_bin_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_transactions" DROP CONSTRAINT "inventory_transactions_product_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_transactions" DROP CONSTRAINT "inventory_transactions_to_bin_id_fkey";

-- DropForeignKey
ALTER TABLE "order_lines" DROP CONSTRAINT "order_lines_order_id_fkey";

-- DropForeignKey
ALTER TABLE "order_lines" DROP CONSTRAINT "order_lines_product_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_channel_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_client_id_fkey";

-- DropForeignKey
ALTER TABLE "pick_task_lines" DROP CONSTRAINT "pick_task_lines_bin_id_fkey";

-- DropForeignKey
ALTER TABLE "pick_task_lines" DROP CONSTRAINT "pick_task_lines_product_id_fkey";

-- DropForeignKey
ALTER TABLE "pick_task_lines" DROP CONSTRAINT "pick_task_lines_task_id_fkey";

-- DropForeignKey
ALTER TABLE "pick_tasks" DROP CONSTRAINT "pick_tasks_order_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_client_id_fkey";

-- DropForeignKey
ALTER TABLE "putaway_rules" DROP CONSTRAINT "putaway_rules_bin_id_fkey";

-- DropForeignKey
ALTER TABLE "putaway_rules" DROP CONSTRAINT "putaway_rules_product_id_fkey";

-- DropForeignKey
ALTER TABLE "racks" DROP CONSTRAINT "racks_aisle_id_fkey";

-- DropForeignKey
ALTER TABLE "receiving_discrepancies" DROP CONSTRAINT "receiving_discrepancies_shipment_id_fkey";

-- DropForeignKey
ALTER TABLE "receiving_transactions" DROP CONSTRAINT "receiving_transactions_bin_id_fkey";

-- DropForeignKey
ALTER TABLE "receiving_transactions" DROP CONSTRAINT "receiving_transactions_line_id_fkey";

-- DropForeignKey
ALTER TABLE "receiving_transactions" DROP CONSTRAINT "receiving_transactions_shipment_id_fkey";

-- DropForeignKey
ALTER TABLE "shelves" DROP CONSTRAINT "shelves_rack_id_fkey";

-- DropForeignKey
ALTER TABLE "shipment_items" DROP CONSTRAINT "shipment_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "shipment_items" DROP CONSTRAINT "shipment_items_shipment_id_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_order_id_fkey";

-- DropForeignKey
ALTER TABLE "uom_conversions" DROP CONSTRAINT "uom_conversions_product_id_fkey";

-- DropForeignKey
ALTER TABLE "zones" DROP CONSTRAINT "zones_warehouse_id_fkey";

-- DropTable
DROP TABLE "adjustment_lines";

-- DropTable
DROP TABLE "aisles";

-- DropTable
DROP TABLE "audit_log";

-- DropTable
DROP TABLE "bins";

-- DropTable
DROP TABLE "carrier_accounts";

-- DropTable
DROP TABLE "clients";

-- DropTable
DROP TABLE "cycle_count_plans";

-- DropTable
DROP TABLE "document_processing_jobs";

-- DropTable
DROP TABLE "documents";

-- DropTable
DROP TABLE "inbound_shipment_lines";

-- DropTable
DROP TABLE "inbound_shipments";

-- DropTable
DROP TABLE "inspection_checklist_items";

-- DropTable
DROP TABLE "inspection_checklists";

-- DropTable
DROP TABLE "inspection_results";

-- DropTable
DROP TABLE "inventory";

-- DropTable
DROP TABLE "inventory_adjustments";

-- DropTable
DROP TABLE "inventory_transactions";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "order_lines";

-- DropTable
DROP TABLE "orders";

-- DropTable
DROP TABLE "pick_task_lines";

-- DropTable
DROP TABLE "pick_tasks";

-- DropTable
DROP TABLE "products";

-- DropTable
DROP TABLE "putaway_rules";

-- DropTable
DROP TABLE "racks";

-- DropTable
DROP TABLE "receiving_discrepancies";

-- DropTable
DROP TABLE "receiving_transactions";

-- DropTable
DROP TABLE "sales_channels";

-- DropTable
DROP TABLE "sequence_counters";

-- DropTable
DROP TABLE "shelves";

-- DropTable
DROP TABLE "shipment_items";

-- DropTable
DROP TABLE "shipments";

-- DropTable
DROP TABLE "uom_conversions";

-- DropTable
DROP TABLE "warehouses";

-- DropTable
DROP TABLE "zones";

-- DropEnum
DROP TYPE "AdjustmentStatus";

-- DropEnum
DROP TYPE "BinStatus";

-- DropEnum
DROP TYPE "BinType";

-- DropEnum
DROP TYPE "CycleCountFrequency";

-- DropEnum
DROP TYPE "CycleCountMethod";

-- DropEnum
DROP TYPE "DiscrepancyStatus";

-- DropEnum
DROP TYPE "DiscrepancyType";

-- DropEnum
DROP TYPE "InspectionStatus";

-- DropEnum
DROP TYPE "ItemCondition";

-- DropEnum
DROP TYPE "OrderPriority";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "PickMethod";

-- DropEnum
DROP TYPE "PickTaskStatus";

-- DropEnum
DROP TYPE "PutawayStrategy";

-- DropEnum
DROP TYPE "ShipmentStatus";

-- DropEnum
DROP TYPE "TransactionType";

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "db_schema" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'provisioning',
    "plan" "TenantPlan" NOT NULL DEFAULT 'starter',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_superadmin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'viewer',

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_db_schema_key" ON "tenants"("db_schema");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenant_id_user_id_key" ON "tenant_users"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
