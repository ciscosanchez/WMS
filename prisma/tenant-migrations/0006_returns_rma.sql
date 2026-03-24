-- Migration: 0006_returns_rma
-- Adds return authorization, return lines, and return inspection models

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "RmaStatus" AS ENUM (
  'requested',
  'approved',
  'in_transit',
  'received',
  'inspecting',
  'dispositioned',
  'rma_completed',
  'rejected',
  'rma_cancelled'
);

CREATE TYPE "DispositionType" AS ENUM (
  'restock',
  'quarantine',
  'dispose',
  'repair'
);

ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'return_receive';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'return_dispose';
ALTER TYPE "BillingServiceType" ADD VALUE IF NOT EXISTS 'returns_processing';

-- ─── Return Authorizations ──────────────────────────────────────────────────

CREATE TABLE "return_authorizations" (
    "id"           TEXT          NOT NULL,
    "rma_number"   TEXT          NOT NULL,
    "client_id"    TEXT          NOT NULL,
    "order_id"     TEXT,
    "status"       "RmaStatus"   NOT NULL DEFAULT 'requested',
    "reason"       TEXT          NOT NULL,
    "notes"        TEXT,
    "requested_by" TEXT          NOT NULL,
    "approved_by"  TEXT,
    "approved_at"  TIMESTAMP(3),
    "received_at"  TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_authorizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "return_authorizations_rma_number_key" UNIQUE ("rma_number"),
    CONSTRAINT "return_authorizations_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "return_authorizations_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "return_authorizations_client_id_idx" ON "return_authorizations"("client_id");
CREATE INDEX "return_authorizations_status_idx"    ON "return_authorizations"("status");
CREATE INDEX "return_authorizations_created_at_idx" ON "return_authorizations"("created_at");

-- ─── Return Lines ───────────────────────────────────────────────────────────

CREATE TABLE "return_lines" (
    "id"                TEXT             NOT NULL,
    "rma_id"            TEXT             NOT NULL,
    "product_id"        TEXT             NOT NULL,
    "expected_qty"      INTEGER          NOT NULL,
    "received_qty"      INTEGER          NOT NULL DEFAULT 0,
    "disposition"       "DispositionType",
    "disposition_qty"   INTEGER          NOT NULL DEFAULT 0,
    "disposition_notes" TEXT,
    "disposition_by"    TEXT,
    "disposition_at"    TIMESTAMP(3),
    "uom"               TEXT             NOT NULL DEFAULT 'EA',
    "lot_number"        TEXT,
    "serial_number"     TEXT,
    "notes"             TEXT,

    CONSTRAINT "return_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "return_lines_rma_id_fkey"
        FOREIGN KEY ("rma_id") REFERENCES "return_authorizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "return_lines_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "return_lines_rma_id_idx" ON "return_lines"("rma_id");

-- ─── Return Inspections ─────────────────────────────────────────────────────

CREATE TABLE "return_inspections" (
    "id"           TEXT             NOT NULL,
    "rma_id"       TEXT             NOT NULL,
    "line_id"      TEXT             NOT NULL,
    "bin_id"       TEXT,
    "quantity"     INTEGER          NOT NULL,
    "condition"    "ItemCondition"  NOT NULL DEFAULT 'good',
    "disposition"  "DispositionType" NOT NULL,
    "inspected_by" TEXT             NOT NULL,
    "inspected_at" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"        TEXT,

    CONSTRAINT "return_inspections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "return_inspections_rma_id_fkey"
        FOREIGN KEY ("rma_id") REFERENCES "return_authorizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "return_inspections_line_id_fkey"
        FOREIGN KEY ("line_id") REFERENCES "return_lines"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "return_inspections_bin_id_fkey"
        FOREIGN KEY ("bin_id") REFERENCES "bins"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "return_inspections_rma_id_idx" ON "return_inspections"("rma_id");
