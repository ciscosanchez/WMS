-- Migration: 0017_lpn_tracking
-- Add LPN (License Plate Number) / Container tracking tables

-- Enum for LPN lifecycle status
CREATE TYPE "LpnStatus" AS ENUM ('lpn_active', 'lpn_in_transit', 'lpn_consumed');

-- LPN / pallet header
CREATE TABLE "lpns" (
  "id"           TEXT         NOT NULL,
  "lpn_number"   TEXT         NOT NULL,
  "bin_id"       TEXT,
  "status"       "LpnStatus" NOT NULL DEFAULT 'lpn_active',
  "pallet_type"  TEXT,
  "total_weight" DECIMAL(10,4),
  "notes"        TEXT,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "lpns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lpns_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "lpns_lpn_number_key" ON "lpns" ("lpn_number");
CREATE INDEX "idx_lpns_bin_id" ON "lpns" ("bin_id");
CREATE INDEX "idx_lpns_status" ON "lpns" ("status");

-- LPN contents (items on the pallet)
CREATE TABLE "lpn_contents" (
  "id"            TEXT    NOT NULL,
  "lpn_id"        TEXT    NOT NULL,
  "product_id"    TEXT    NOT NULL,
  "quantity"      INTEGER NOT NULL,
  "lot_number"    TEXT,
  "serial_number" TEXT,

  CONSTRAINT "lpn_contents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lpn_contents_lpn_id_fkey" FOREIGN KEY ("lpn_id") REFERENCES "lpns"("id") ON DELETE CASCADE,
  CONSTRAINT "lpn_contents_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_lpn_contents_lpn_id" ON "lpn_contents" ("lpn_id");
