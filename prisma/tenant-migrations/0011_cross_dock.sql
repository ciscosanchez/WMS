-- Migration: 0011_cross_dock
-- Adds cross-dock orchestration tables for routing inbound shipments directly to outbound

CREATE TYPE "CrossDockStatus" AS ENUM ('cd_identified', 'cd_approved', 'cd_in_progress', 'cd_completed', 'cd_cancelled');

CREATE TABLE "cross_dock_rules" (
    "id"         TEXT        NOT NULL,
    "client_id"  TEXT,
    "product_id" TEXT,
    "is_active"  BOOLEAN     NOT NULL DEFAULT true,
    "priority"   INTEGER     NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_dock_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cross_dock_plans" (
    "id"                   TEXT              NOT NULL,
    "inbound_shipment_id"  TEXT              NOT NULL,
    "outbound_order_id"    TEXT              NOT NULL,
    "status"               "CrossDockStatus" NOT NULL DEFAULT 'cd_identified',
    "product_id"           TEXT              NOT NULL,
    "quantity"             INTEGER           NOT NULL,
    "source_dock_door_id"  TEXT,
    "target_dock_door_id"  TEXT,
    "completed_at"         TIMESTAMP(3),
    "created_at"           TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_dock_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cross_dock_plans_inbound_shipment_id_idx" ON "cross_dock_plans"("inbound_shipment_id");
CREATE INDEX "cross_dock_plans_outbound_order_id_idx" ON "cross_dock_plans"("outbound_order_id");
CREATE INDEX "cross_dock_plans_status_idx" ON "cross_dock_plans"("status");
