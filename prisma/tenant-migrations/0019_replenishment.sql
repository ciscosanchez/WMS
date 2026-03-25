-- Migration: 0019_replenishment
-- Replenishment rules for auto-reorder / pick-face replenishment

CREATE TABLE IF NOT EXISTS "replenishment_rules" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "bin_id" TEXT NOT NULL,
  "min_qty" INTEGER NOT NULL,
  "max_qty" INTEGER NOT NULL,
  "reorder_point" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "replenishment_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "replenishment_rules_product_bin_key" UNIQUE ("product_id", "bin_id"),
  CONSTRAINT "replenishment_rules_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id"),
  CONSTRAINT "replenishment_rules_bin_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id")
);

CREATE INDEX IF NOT EXISTS "idx_replenishment_product" ON "replenishment_rules" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_replenishment_bin" ON "replenishment_rules" ("bin_id");
