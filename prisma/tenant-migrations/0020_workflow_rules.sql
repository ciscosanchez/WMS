-- Migration: 0020_workflow_rules
-- Add workflow rules engine for user-configurable if/then automation

CREATE TABLE IF NOT EXISTS "workflow_rules" (
  "id"          TEXT         NOT NULL PRIMARY KEY,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "trigger"     TEXT         NOT NULL,
  "conditions"  JSONB        NOT NULL DEFAULT '[]',
  "actions"     JSONB        NOT NULL DEFAULT '[]',
  "priority"    INTEGER      NOT NULL DEFAULT 0,
  "is_active"   BOOLEAN      NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflow_rules_trigger" ON "workflow_rules" ("trigger");
CREATE INDEX IF NOT EXISTS "idx_workflow_rules_is_active" ON "workflow_rules" ("is_active");
