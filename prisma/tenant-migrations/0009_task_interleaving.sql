-- Migration: 0009_task_interleaving
-- Adds interleaved route and step models for combined pick/putaway/replenish trips

CREATE TYPE "InterleavedStepType" AS ENUM ('il_pick', 'il_putaway', 'il_replenish');
CREATE TYPE "InterleavedStepStatus" AS ENUM ('il_pending', 'il_completed', 'il_skipped');
CREATE TYPE "InterleavedRouteStatus" AS ENUM ('route_pending', 'route_assigned', 'route_in_progress', 'route_completed');
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'interleaved';

ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "interleaving_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "interleaved_routes" (
    "id"           TEXT                     NOT NULL,
    "route_number" TEXT                     NOT NULL,
    "operator_id"  TEXT                     NOT NULL,
    "status"       "InterleavedRouteStatus" NOT NULL DEFAULT 'route_pending',
    "started_at"   TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interleaved_routes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interleaved_routes_route_number_key" UNIQUE ("route_number")
);

CREATE INDEX "interleaved_routes_operator_id_idx" ON "interleaved_routes"("operator_id");
CREATE INDEX "interleaved_routes_status_idx" ON "interleaved_routes"("status");

CREATE TABLE "interleaved_steps" (
    "id"           TEXT                    NOT NULL,
    "route_id"     TEXT                    NOT NULL,
    "seq"          INTEGER                 NOT NULL,
    "type"         "InterleavedStepType"   NOT NULL,
    "reference_id" TEXT                    NOT NULL,
    "bin_id"       TEXT                    NOT NULL,
    "product_id"   TEXT                    NOT NULL,
    "quantity"     INTEGER                 NOT NULL,
    "status"       "InterleavedStepStatus" NOT NULL DEFAULT 'il_pending',
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "interleaved_steps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interleaved_steps_route_id_fkey"
        FOREIGN KEY ("route_id") REFERENCES "interleaved_routes"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "interleaved_steps_route_id_idx" ON "interleaved_steps"("route_id");
