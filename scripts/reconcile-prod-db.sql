-- reconcile-prod-db.sql
--
-- Idempotent script to bring an untracked production database into alignment
-- with the Prisma migration history so that future `prisma migrate deploy`
-- runs work normally.
--
-- Safe to run multiple times. Uses ADD COLUMN IF NOT EXISTS, CREATE INDEX IF
-- NOT EXISTS, etc. throughout.
--
-- Run with:
--   psql "$DATABASE_URL" -f scripts/reconcile-prod-db.sql
--
-- Or from the server:
--   docker compose -f infra/docker-compose.prod.yml exec -T postgres \
--     psql -U ramola -d ramola -f /app/scripts/reconcile-prod-db.sql
--
-- After this script completes successfully, deploy.sh will detect
-- _prisma_migrations and run `prisma migrate deploy` normally on every
-- subsequent deploy.

-- ─── 1. Missing columns on public.users ─────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "auth_version"        INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locale"              TEXT,
  ADD COLUMN IF NOT EXISTS "password_set_token"  TEXT,
  ADD COLUMN IF NOT EXISTS "password_set_expires" TIMESTAMP(3);

-- ─── 2. Missing column on public.tenant_users ────────────────────────────────

ALTER TABLE "tenant_users"
  ADD COLUMN IF NOT EXISTS "portal_client_id" TEXT;

-- ─── 3. Missing indexes ──────────────────────────────────────────────────────

-- Unique index required for password_set_token lookups
CREATE UNIQUE INDEX IF NOT EXISTS "users_password_set_token_key"
  ON "users"("password_set_token");

-- Non-unique indexes omitted from the original init migration
CREATE INDEX IF NOT EXISTS "tenant_users_tenant_id_idx"
  ON "tenant_users"("tenant_id");

CREATE INDEX IF NOT EXISTS "tenant_users_user_id_idx"
  ON "tenant_users"("user_id");

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx"
  ON "sessions"("user_id");

-- ─── 4. Prisma migration history table ──────────────────────────────────────
--
-- Create the standard Prisma migrations table if it doesn't exist, then
-- register all existing migrations as already applied so that
-- `prisma migrate deploy` skips them and only runs future migrations.

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                    VARCHAR(36)  PRIMARY KEY,
  "checksum"              VARCHAR(64)  NOT NULL,
  "finished_at"           TIMESTAMPTZ,
  "migration_name"        VARCHAR(255) NOT NULL,
  "logs"                  TEXT,
  "rolled_back_at"        TIMESTAMPTZ,
  "started_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "applied_steps_count"   INTEGER      NOT NULL DEFAULT 0
);

-- Register each migration as applied. Uses WHERE NOT EXISTS so the script is
-- safe to run multiple times — _prisma_migrations has no unique constraint on
-- migration_name by default, so we guard manually.

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "applied_steps_count")
SELECT gen_random_uuid()::text, 'reconciled', NOW(), m.name, 'Applied by reconcile-prod-db.sql', NULL, 1
FROM (VALUES
  ('20260317145051_init_tenant_schema'),
  ('20260317145059_init_public_schema'),
  ('20260325215500_add_auth_version_to_users'),
  ('20260326000000_add_missing_user_fields')
) AS m(name)
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = m.name
);

-- ─── Done ────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'reconcile-prod-db.sql complete. Run prisma migrate deploy to apply any future migrations.';
END $$;
