-- Migration: 0013_automation
-- Adds automation device registry and device task queue

CREATE TYPE "DeviceType" AS ENUM ('amr', 'conveyor', 'pick_to_light', 'put_to_light', 'sortation');
CREATE TYPE "DeviceStatus" AS ENUM ('dev_online', 'dev_offline', 'dev_error', 'dev_maintenance');

CREATE TABLE "automation_devices" (
    "id"           TEXT          NOT NULL,
    "warehouse_id" TEXT          NOT NULL,
    "code"         TEXT          NOT NULL,
    "name"         TEXT          NOT NULL,
    "type"         "DeviceType"  NOT NULL,
    "status"       "DeviceStatus" NOT NULL DEFAULT 'dev_offline',
    "zone_id"      TEXT,
    "ip_address"   TEXT,
    "last_ping_at" TIMESTAMP(3),
    "config"       JSONB         NOT NULL DEFAULT '{}',
    "is_active"    BOOLEAN       NOT NULL DEFAULT true,
    "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "automation_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "device_tasks" (
    "id"            TEXT         NOT NULL,
    "device_id"     TEXT         NOT NULL,
    "task_type"     TEXT         NOT NULL,
    "status"        TEXT         NOT NULL DEFAULT 'queued',
    "payload"       JSONB        NOT NULL DEFAULT '{}',
    "result"        JSONB,
    "dispatched_at" TIMESTAMP(3),
    "completed_at"  TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automation_devices_warehouse_id_code_key" ON "automation_devices"("warehouse_id", "code");
CREATE INDEX "device_tasks_device_id_idx" ON "device_tasks"("device_id");
CREATE INDEX "device_tasks_status_idx" ON "device_tasks"("status");

ALTER TABLE "device_tasks" ADD CONSTRAINT "device_tasks_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "automation_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
