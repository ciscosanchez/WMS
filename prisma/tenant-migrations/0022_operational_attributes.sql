-- Migration: 0022_operational_attributes
-- Add generic configurable operational attributes foundation

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'operational_attribute_scope'
      AND n.nspname = current_schema()
  ) THEN
    EXECUTE format(
      'CREATE TYPE %I.operational_attribute_scope AS ENUM (
        ''inbound_shipment'',
        ''inbound_shipment_line'',
        ''lpn'',
        ''inventory_unit'',
        ''inventory_record''
      )',
      current_schema()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'operational_attribute_data_type'
      AND n.nspname = current_schema()
  ) THEN
    EXECUTE format(
      'CREATE TYPE %I.operational_attribute_data_type AS ENUM (
        ''text'',
        ''number'',
        ''currency'',
        ''date'',
        ''boolean'',
        ''single_select'',
        ''multi_select'',
        ''json''
      )',
      current_schema()
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "operational_attribute_definitions" (
  "id"                 TEXT                             NOT NULL PRIMARY KEY,
  "key"                TEXT                             NOT NULL,
  "label"              TEXT                             NOT NULL,
  "description"        TEXT,
  "entity_scope"       operational_attribute_scope      NOT NULL,
  "data_type"          operational_attribute_data_type  NOT NULL,
  "is_required"        BOOLEAN                          NOT NULL DEFAULT false,
  "is_active"          BOOLEAN                          NOT NULL DEFAULT true,
  "allow_suggestions"  BOOLEAN                          NOT NULL DEFAULT false,
  "validation_rules"   JSONB                            NOT NULL DEFAULT '{}',
  "display_rules"      JSONB                            NOT NULL DEFAULT '{}',
  "behavior_flags"     JSONB                            NOT NULL DEFAULT '{}',
  "sort_order"         INTEGER                          NOT NULL DEFAULT 0,
  "created_at"         TIMESTAMPTZ                      NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ                      NOT NULL DEFAULT now(),
  CONSTRAINT "operational_attribute_definitions_entity_scope_key_key" UNIQUE ("entity_scope", "key")
);

CREATE INDEX IF NOT EXISTS "idx_operational_attribute_definitions_scope_active"
  ON "operational_attribute_definitions" ("entity_scope", "is_active");

CREATE TABLE IF NOT EXISTS "operational_attribute_options" (
  "id"             TEXT         NOT NULL PRIMARY KEY,
  "definition_id"  TEXT         NOT NULL,
  "value"          TEXT         NOT NULL,
  "label"          TEXT         NOT NULL,
  "sort_order"     INTEGER      NOT NULL DEFAULT 0,
  "is_active"      BOOLEAN      NOT NULL DEFAULT true,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "operational_attribute_options_definition_id_value_key" UNIQUE ("definition_id", "value"),
  CONSTRAINT "operational_attribute_options_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "operational_attribute_definitions" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_operational_attribute_options_definition_active"
  ON "operational_attribute_options" ("definition_id", "is_active");

CREATE TABLE IF NOT EXISTS "operational_attribute_values" (
  "id"             TEXT                        NOT NULL PRIMARY KEY,
  "definition_id"  TEXT                        NOT NULL,
  "entity_scope"   operational_attribute_scope NOT NULL,
  "entity_id"      TEXT                        NOT NULL,
  "text_value"     TEXT,
  "number_value"   DECIMAL(18,4),
  "boolean_value"  BOOLEAN,
  "date_value"     TIMESTAMPTZ,
  "json_value"     JSONB,
  "created_by"     TEXT,
  "updated_by"     TEXT,
  "created_at"     TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  CONSTRAINT "operational_attribute_values_definition_scope_entity_key"
    UNIQUE ("definition_id", "entity_scope", "entity_id"),
  CONSTRAINT "operational_attribute_values_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "operational_attribute_definitions" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_operational_attribute_values_scope_entity"
  ON "operational_attribute_values" ("entity_scope", "entity_id");

CREATE INDEX IF NOT EXISTS "idx_operational_attribute_values_definition"
  ON "operational_attribute_values" ("definition_id");
