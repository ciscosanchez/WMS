-- Migration: 0012_compliance
-- Adds compliance & customs tables for HS code validation, hazmat flags, and compliance checks

CREATE TYPE "ComplianceStatus" AS ENUM ('comp_pending', 'comp_cleared', 'comp_flagged', 'comp_blocked');

CREATE TABLE "compliance_checks" (
    "id"          TEXT               NOT NULL,
    "entity_type" TEXT               NOT NULL,
    "entity_id"   TEXT               NOT NULL,
    "check_type"  TEXT               NOT NULL,
    "status"      "ComplianceStatus" NOT NULL DEFAULT 'comp_pending',
    "details"     TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at"  TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hazmat_flags" (
    "id"            TEXT    NOT NULL,
    "product_id"    TEXT    NOT NULL,
    "un_number"     TEXT,
    "haz_class"     TEXT,
    "packing_group" TEXT,
    "proper_name"   TEXT,
    "is_restricted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "hazmat_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hazmat_flags_product_id_key" ON "hazmat_flags"("product_id");
CREATE INDEX "compliance_checks_entity_type_entity_id_idx" ON "compliance_checks"("entity_type", "entity_id");
CREATE INDEX "compliance_checks_status_idx" ON "compliance_checks"("status");

ALTER TABLE "hazmat_flags" ADD CONSTRAINT "hazmat_flags_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
