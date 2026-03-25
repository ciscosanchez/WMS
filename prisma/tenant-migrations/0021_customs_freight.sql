-- Migration: 0021_customs_freight
-- Add customs entries, entry lines, and bonded inventory tables

-- Enum type for customs entry status
CREATE TYPE "CustomsEntryStatus" AS ENUM (
  'ce_draft',
  'ce_pending',
  'ce_filed',
  'ce_cleared',
  'ce_held',
  'ce_rejected'
);

-- Customs entries
CREATE TABLE IF NOT EXISTS "customs_entries" (
  "id"                TEXT                 NOT NULL PRIMARY KEY,
  "entry_number"      TEXT                 UNIQUE,
  "shipment_id"       TEXT,
  "entry_type"        TEXT                 NOT NULL,
  "status"            "CustomsEntryStatus" NOT NULL DEFAULT 'ce_draft',
  "port_of_entry"     TEXT,
  "carrier"           TEXT,
  "vessel_name"       TEXT,
  "voyage_number"     TEXT,
  "estimated_arrival" TIMESTAMPTZ,
  "filed_at"          TIMESTAMPTZ,
  "cleared_at"        TIMESTAMPTZ,
  "broker_name"       TEXT,
  "broker_ref"        TEXT,
  "total_duty"        DECIMAL(10,2),
  "notes"             TEXT,
  "created_at"        TIMESTAMPTZ          NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ          NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_customs_entries_status"      ON "customs_entries" ("status");
CREATE INDEX IF NOT EXISTS "idx_customs_entries_shipment_id" ON "customs_entries" ("shipment_id");

-- Customs entry lines
CREATE TABLE IF NOT EXISTS "customs_entry_lines" (
  "id"             TEXT         NOT NULL PRIMARY KEY,
  "entry_id"       TEXT         NOT NULL REFERENCES "customs_entries" ("id") ON DELETE CASCADE,
  "hs_code"        TEXT         NOT NULL,
  "description"    TEXT         NOT NULL,
  "country_origin" TEXT         NOT NULL,
  "quantity"       INTEGER      NOT NULL,
  "value"          DECIMAL(10,2) NOT NULL,
  "duty_rate"      DECIMAL(10,4),
  "duty_amount"    DECIMAL(10,2)
);

CREATE INDEX IF NOT EXISTS "idx_customs_entry_lines_entry_id" ON "customs_entry_lines" ("entry_id");

-- Bonded inventory
CREATE TABLE IF NOT EXISTS "bonded_inventory" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "product_id"   TEXT        NOT NULL,
  "bin_id"       TEXT,
  "entry_id"     TEXT,
  "quantity"     INTEGER     NOT NULL,
  "bond_number"  TEXT,
  "bond_type"    TEXT,
  "entry_date"   TIMESTAMPTZ NOT NULL,
  "release_date" TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bonded_inventory_product_id" ON "bonded_inventory" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_bonded_inventory_entry_id"   ON "bonded_inventory" ("entry_id");
