-- Migration: 0010_vas_kitting
-- Adds VAS/Kitting models: kit definitions, kit components, and VAS tasks

CREATE TYPE "VasTaskStatus" AS ENUM ('vas_pending', 'vas_in_progress', 'vas_completed');

CREATE TABLE "kit_definitions" (
    "id"         TEXT        NOT NULL,
    "product_id" TEXT        NOT NULL,
    "name"       TEXT        NOT NULL,
    "is_active"  BOOLEAN     NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kit_definitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kit_definitions_product_id_key" UNIQUE ("product_id"),
    CONSTRAINT "kit_definitions_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "kit_components" (
    "id"         TEXT    NOT NULL,
    "kit_id"     TEXT    NOT NULL,
    "product_id" TEXT    NOT NULL,
    "quantity"   INTEGER NOT NULL,
    CONSTRAINT "kit_components_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kit_components_kit_id_fkey"
        FOREIGN KEY ("kit_id") REFERENCES "kit_definitions"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "kit_components_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "kit_components_kit_id_idx" ON "kit_components"("kit_id");

CREATE TABLE "vas_tasks" (
    "id"           TEXT            NOT NULL,
    "task_number"  TEXT            NOT NULL,
    "order_id"     TEXT,
    "type"         TEXT            NOT NULL DEFAULT 'assembly',
    "status"       "VasTaskStatus" NOT NULL DEFAULT 'vas_pending',
    "instructions" TEXT,
    "assigned_to"  TEXT,
    "started_at"   TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vas_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vas_tasks_task_number_key" UNIQUE ("task_number")
);

CREATE INDEX "vas_tasks_order_id_idx" ON "vas_tasks"("order_id");
CREATE INDEX "vas_tasks_status_idx" ON "vas_tasks"("status");
