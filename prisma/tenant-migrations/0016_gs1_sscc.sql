-- Migration: 0016_gs1_sscc
-- Add SSCC field to shipments for GS1 compliance label support

ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "sscc" TEXT;

-- Index for SSCC lookups
CREATE UNIQUE INDEX IF NOT EXISTS "idx_shipments_sscc" ON "shipments" ("sscc") WHERE "sscc" IS NOT NULL;
