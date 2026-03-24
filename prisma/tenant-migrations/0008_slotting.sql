-- Migration: 0008_slotting
-- Adds slotting optimization: config, analysis runs, and recommendations

CREATE TYPE "SlottingRunStatus" AS ENUM (
  'slotting_pending',
  'slotting_running',
  'slotting_completed',
  'slotting_failed'
);

CREATE TYPE "SlottingRecStatus" AS ENUM (
  'rec_pending',
  'rec_accepted',
  'rec_rejected',
  'rec_moved'
);

-- ─── Slotting Config ────────────────────────────────────────────────────────

CREATE TABLE "slotting_configs" (
    "id"              TEXT          NOT NULL,
    "warehouse_id"    TEXT          NOT NULL,
    "abc_a_threshold" INTEGER       NOT NULL DEFAULT 80,
    "abc_b_threshold" INTEGER       NOT NULL DEFAULT 95,
    "lookback_days"   INTEGER       NOT NULL DEFAULT 90,
    "weight_penalty"  DECIMAL(10,2) NOT NULL DEFAULT 1,
    "zone_prefs"      JSONB         NOT NULL DEFAULT '{}',
    "created_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slotting_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "slotting_configs_warehouse_id_key" UNIQUE ("warehouse_id")
);

-- ─── Slotting Runs ──────────────────────────────────────────────────────────

CREATE TABLE "slotting_runs" (
    "id"                   TEXT                NOT NULL,
    "warehouse_id"         TEXT                NOT NULL,
    "status"               "SlottingRunStatus" NOT NULL DEFAULT 'slotting_pending',
    "triggered_by"         TEXT                NOT NULL,
    "product_count"        INTEGER             NOT NULL DEFAULT 0,
    "recommendation_count" INTEGER             NOT NULL DEFAULT 0,
    "started_at"           TIMESTAMP(3),
    "completed_at"         TIMESTAMP(3),
    "error"                TEXT,
    "created_at"           TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slotting_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "slotting_runs_warehouse_id_idx" ON "slotting_runs"("warehouse_id");
CREATE INDEX "slotting_runs_status_idx"       ON "slotting_runs"("status");

-- ─── Slotting Recommendations ───────────────────────────────────────────────

CREATE TABLE "slotting_recommendations" (
    "id"                 TEXT               NOT NULL,
    "run_id"             TEXT               NOT NULL,
    "product_id"         TEXT               NOT NULL,
    "current_bin_id"     TEXT               NOT NULL,
    "recommended_bin_id" TEXT               NOT NULL,
    "abc_class"          TEXT               NOT NULL,
    "pick_frequency"     INTEGER            NOT NULL DEFAULT 0,
    "velocity_score"     DECIMAL(10,2)      NOT NULL DEFAULT 0,
    "weight_score"       DECIMAL(10,2)      NOT NULL DEFAULT 0,
    "ergonomic_score"    DECIMAL(10,2)      NOT NULL DEFAULT 0,
    "total_score"        DECIMAL(10,2)      NOT NULL DEFAULT 0,
    "status"             "SlottingRecStatus" NOT NULL DEFAULT 'rec_pending',
    "move_task_id"       TEXT,

    CONSTRAINT "slotting_recommendations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "slotting_recommendations_run_id_fkey"
        FOREIGN KEY ("run_id") REFERENCES "slotting_runs"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "slotting_recommendations_run_id_idx"    ON "slotting_recommendations"("run_id");
CREATE INDEX "slotting_recommendations_product_id_idx" ON "slotting_recommendations"("product_id");
CREATE INDEX "slotting_recommendations_status_idx"    ON "slotting_recommendations"("status");
