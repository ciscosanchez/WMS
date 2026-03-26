-- Add fields introduced after the initial public schema migration.
-- Covers: invite/reset token flow, per-user locale, portal client scoping,
-- and missing non-unique indexes that were omitted from the init migration.

-- AlterTable users
ALTER TABLE "users" ADD COLUMN "locale" TEXT;
ALTER TABLE "users" ADD COLUMN "password_set_token" TEXT;
ALTER TABLE "users" ADD COLUMN "password_set_expires" TIMESTAMP(3);

-- AlterTable tenant_users
ALTER TABLE "tenant_users" ADD COLUMN "portal_client_id" TEXT;

-- CreateIndex (unique constraint on password_set_token)
CREATE UNIQUE INDEX "users_password_set_token_key" ON "users"("password_set_token");

-- CreateIndex (missing non-unique indexes from init migration)
CREATE INDEX "tenant_users_tenant_id_idx" ON "tenant_users"("tenant_id");
CREATE INDEX "tenant_users_user_id_idx" ON "tenant_users"("user_id");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
