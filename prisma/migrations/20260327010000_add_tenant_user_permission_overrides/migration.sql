ALTER TABLE "tenant_users"
ADD COLUMN "permission_overrides" JSONB NOT NULL DEFAULT '{"grants":[],"denies":[]}';
