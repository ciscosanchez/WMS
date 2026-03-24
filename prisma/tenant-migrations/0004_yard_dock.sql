-- Migration: 0004_yard_dock
-- Adds dock door management, yard spot tracking, dock appointments, and yard visits

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "DockDoorType" AS ENUM (
  'inbound',
  'outbound',
  'both'
);

CREATE TYPE "DockDoorStatus" AS ENUM (
  'available',
  'occupied',
  'maintenance',
  'closed'
);

CREATE TYPE "YardSpotType" AS ENUM (
  'parking',
  'staging',
  'refrigerated',
  'hazmat'
);

CREATE TYPE "YardSpotStatus" AS ENUM (
  'empty',
  'occupied',
  'reserved',
  'blocked'
);

CREATE TYPE "AppointmentStatus" AS ENUM (
  'scheduled',
  'confirmed',
  'checked_in',
  'at_dock',
  'loading',
  'unloading',
  'completed',
  'cancelled',
  'no_show'
);

CREATE TYPE "AppointmentDirection" AS ENUM (
  'inbound',
  'outbound'
);

CREATE TYPE "YardVisitStatus" AS ENUM (
  'in_yard',
  'at_dock',
  'departed'
);

-- ─── Dock Doors ─────────────────────────────────────────────────────────────

CREATE TABLE "dock_doors" (
    "id"           TEXT             NOT NULL,
    "warehouse_id" TEXT             NOT NULL,
    "code"         TEXT             NOT NULL,
    "name"         TEXT             NOT NULL,
    "type"         "DockDoorType"   NOT NULL DEFAULT 'both',
    "status"       "DockDoorStatus" NOT NULL DEFAULT 'available',
    "notes"        TEXT,
    "is_active"    BOOLEAN          NOT NULL DEFAULT true,
    "created_at"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dock_doors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dock_doors_warehouse_id_fkey"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "dock_doors_warehouse_id_code_key"
    ON "dock_doors"("warehouse_id", "code");

-- ─── Yard Spots ─────────────────────────────────────────────────────────────

CREATE TABLE "yard_spots" (
    "id"           TEXT             NOT NULL,
    "warehouse_id" TEXT             NOT NULL,
    "code"         TEXT             NOT NULL,
    "name"         TEXT             NOT NULL,
    "type"         "YardSpotType"   NOT NULL DEFAULT 'parking',
    "status"       "YardSpotStatus" NOT NULL DEFAULT 'empty',
    "row"          INTEGER,
    "col"          INTEGER,
    "notes"        TEXT,
    "is_active"    BOOLEAN          NOT NULL DEFAULT true,
    "created_at"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yard_spots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "yard_spots_warehouse_id_fkey"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "yard_spots_warehouse_id_code_key"
    ON "yard_spots"("warehouse_id", "code");

-- ─── Dock Appointments ──────────────────────────────────────────────────────

CREATE TABLE "dock_appointments" (
    "id"                   TEXT                   NOT NULL,
    "appointment_number"   TEXT                   NOT NULL,
    "warehouse_id"         TEXT                   NOT NULL,
    "dock_door_id"         TEXT,
    "direction"            "AppointmentDirection" NOT NULL,
    "status"               "AppointmentStatus"    NOT NULL DEFAULT 'scheduled',
    -- Timing
    "scheduled_start"      TIMESTAMP(3)           NOT NULL,
    "scheduled_end"        TIMESTAMP(3)           NOT NULL,
    "actual_arrival"       TIMESTAMP(3),
    "dock_start"           TIMESTAMP(3),
    "dock_end"             TIMESTAMP(3),
    -- Driver / trailer
    "carrier"              TEXT,
    "trailer_number"       TEXT,
    "driver_name"          TEXT,
    "driver_phone"         TEXT,
    "driver_license"       TEXT,
    -- Linked entities
    "inbound_shipment_id"  TEXT,
    "outbound_shipment_id" TEXT,
    "client_id"            TEXT,
    -- Metadata
    "notes"                TEXT,
    "cancel_reason"        TEXT,
    "created_at"           TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dock_appointments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dock_appointments_number_key" UNIQUE ("appointment_number"),
    CONSTRAINT "dock_appointments_warehouse_id_fkey"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "dock_appointments_dock_door_id_fkey"
        FOREIGN KEY ("dock_door_id") REFERENCES "dock_doors"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "dock_appointments_inbound_shipment_id_fkey"
        FOREIGN KEY ("inbound_shipment_id") REFERENCES "inbound_shipments"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "dock_appointments_outbound_shipment_id_fkey"
        FOREIGN KEY ("outbound_shipment_id") REFERENCES "shipments"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "dock_appointments_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "dock_appointments_warehouse_id_idx"    ON "dock_appointments"("warehouse_id");
CREATE INDEX "dock_appointments_status_idx"          ON "dock_appointments"("status");
CREATE INDEX "dock_appointments_scheduled_start_idx" ON "dock_appointments"("scheduled_start");
CREATE INDEX "dock_appointments_dock_door_id_idx"    ON "dock_appointments"("dock_door_id");
CREATE INDEX "dock_appointments_client_id_idx"       ON "dock_appointments"("client_id");

-- ─── Yard Visits ────────────────────────────────────────────────────────────

CREATE TABLE "yard_visits" (
    "id"             TEXT              NOT NULL,
    "yard_spot_id"   TEXT              NOT NULL,
    "appointment_id" TEXT,
    "trailer_number" TEXT              NOT NULL,
    "carrier"        TEXT,
    "seal_number"    TEXT,
    "status"         "YardVisitStatus" NOT NULL DEFAULT 'in_yard',
    "arrived_at"     TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departed_at"    TIMESTAMP(3),
    "notes"          TEXT,
    "created_at"     TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yard_visits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "yard_visits_yard_spot_id_fkey"
        FOREIGN KEY ("yard_spot_id") REFERENCES "yard_spots"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "yard_visits_appointment_id_fkey"
        FOREIGN KEY ("appointment_id") REFERENCES "dock_appointments"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "yard_visits_yard_spot_id_idx" ON "yard_visits"("yard_spot_id");
CREATE INDEX "yard_visits_status_idx"       ON "yard_visits"("status");
