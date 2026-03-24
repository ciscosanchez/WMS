-- Migration: 0005_labor_management
-- Adds operator shift tracking, task time logging, and labor rate configuration

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "ShiftStatus" AS ENUM (
  'clocked_in',
  'clocked_out'
);

CREATE TYPE "TaskType" AS ENUM (
  'pick',
  'pack',
  'receive',
  'putaway',
  'move',
  'count'
);

-- ─── Operator Shifts ────────────────────────────────────────────────────────

CREATE TABLE "operator_shifts" (
    "id"            TEXT           NOT NULL,
    "operator_id"   TEXT           NOT NULL,
    "clock_in"      TIMESTAMP(3)   NOT NULL,
    "clock_out"     TIMESTAMP(3),
    "status"        "ShiftStatus"  NOT NULL DEFAULT 'clocked_in',
    "break_minutes" INTEGER        NOT NULL DEFAULT 0,
    "hourly_rate"   DECIMAL(10,2),
    "notes"         TEXT,
    "created_at"    TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operator_shifts_operator_id_idx" ON "operator_shifts"("operator_id");
CREATE INDEX "operator_shifts_clock_in_idx"    ON "operator_shifts"("clock_in");

-- ─── Task Time Logs ─────────────────────────────────────────────────────────

CREATE TABLE "task_time_logs" (
    "id"            TEXT          NOT NULL,
    "shift_id"      TEXT,
    "operator_id"   TEXT          NOT NULL,
    "task_type"     "TaskType"    NOT NULL,
    "reference_id"  TEXT          NOT NULL,
    "client_id"     TEXT,
    "started_at"    TIMESTAMP(3)  NOT NULL,
    "completed_at"  TIMESTAMP(3),
    "units_handled" INTEGER       NOT NULL DEFAULT 0,
    "lines_handled" INTEGER       NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_time_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_time_logs_shift_id_fkey"
        FOREIGN KEY ("shift_id") REFERENCES "operator_shifts"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "task_time_logs_operator_id_idx" ON "task_time_logs"("operator_id");
CREATE INDEX "task_time_logs_task_type_idx"   ON "task_time_logs"("task_type");
CREATE INDEX "task_time_logs_client_id_idx"   ON "task_time_logs"("client_id");
CREATE INDEX "task_time_logs_started_at_idx"  ON "task_time_logs"("started_at");

-- ─── Labor Rates ────────────────────────────────────────────────────────────

CREATE TABLE "labor_rates" (
    "id"             TEXT          NOT NULL,
    "operator_id"    TEXT,
    "role"           TEXT,
    "hourly_rate"    DECIMAL(10,2) NOT NULL,
    "currency"       TEXT          NOT NULL DEFAULT 'USD',
    "effective_from" TIMESTAMP(3)  NOT NULL,
    "effective_to"   TIMESTAMP(3),
    "is_active"      BOOLEAN       NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_rates_pkey" PRIMARY KEY ("id")
);

-- ─── Add labor billing types to existing enum ───────────────────────────────

ALTER TYPE "BillingServiceType" ADD VALUE IF NOT EXISTS 'labor_hour';
ALTER TYPE "BillingServiceType" ADD VALUE IF NOT EXISTS 'labor_unit';
