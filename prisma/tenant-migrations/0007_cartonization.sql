-- Migration: 0007_cartonization
-- Adds carton types, pack plans, and manifest/LTL fields on shipments

ALTER TYPE "BillingServiceType" ADD VALUE IF NOT EXISTS 'shipping_carton';

-- ─── Carton Types ───────────────────────────────────────────────────────────

CREATE TABLE "carton_types" (
    "id"          TEXT           NOT NULL,
    "name"        TEXT           NOT NULL,
    "code"        TEXT           NOT NULL,
    "length"      DECIMAL(10,2)  NOT NULL,
    "width"       DECIMAL(10,2)  NOT NULL,
    "height"      DECIMAL(10,2)  NOT NULL,
    "dim_unit"    TEXT           NOT NULL DEFAULT 'in',
    "max_weight"  DECIMAL(10,4)  NOT NULL,
    "weight_unit" TEXT           NOT NULL DEFAULT 'lb',
    "tare_weight" DECIMAL(10,4)  NOT NULL DEFAULT 0,
    "cost"        DECIMAL(10,2),
    "is_active"   BOOLEAN        NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carton_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "carton_types_code_key" UNIQUE ("code")
);

-- ─── Pack Plans ─────────────────────────────────────────────────────────────

CREATE TABLE "pack_plans" (
    "id"             TEXT          NOT NULL,
    "shipment_id"    TEXT          NOT NULL,
    "carton_type_id" TEXT          NOT NULL,
    "carton_seq"     INTEGER       NOT NULL,
    "total_weight"   DECIMAL(10,4) NOT NULL,
    "created_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pack_plans_shipment_id_fkey"
        FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pack_plans_carton_type_id_fkey"
        FOREIGN KEY ("carton_type_id") REFERENCES "carton_types"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "pack_plans_shipment_id_idx" ON "pack_plans"("shipment_id");

-- ─── Pack Plan Lines ────────────────────────────────────────────────────────

CREATE TABLE "pack_plan_lines" (
    "id"            TEXT    NOT NULL,
    "pack_plan_id"  TEXT    NOT NULL,
    "product_id"    TEXT    NOT NULL,
    "quantity"      INTEGER NOT NULL,
    "lot_number"    TEXT,
    "serial_number" TEXT,

    CONSTRAINT "pack_plan_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pack_plan_lines_pack_plan_id_fkey"
        FOREIGN KEY ("pack_plan_id") REFERENCES "pack_plans"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pack_plan_lines_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "pack_plan_lines_pack_plan_id_idx" ON "pack_plan_lines"("pack_plan_id");

-- ─── Shipment LTL / Manifest Fields ────────────────────────────────────────

ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "manifest_url" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "freight_class" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "bol_number" TEXT;
