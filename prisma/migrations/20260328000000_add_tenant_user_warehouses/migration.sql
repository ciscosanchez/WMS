-- Adds warehouse-level role assignments for tenant users.
-- No rows for a user = unrestricted (sees all warehouses at their tenant role).
-- Users with role=admin bypass this table entirely in application logic.

CREATE TABLE "tenant_user_warehouses" (
  "id"             TEXT NOT NULL,
  "tenant_user_id" TEXT NOT NULL,
  "warehouse_id"   TEXT NOT NULL,
  "role"           "TenantRole",

  CONSTRAINT "tenant_user_warehouses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tenant_user_warehouses"
  ADD CONSTRAINT "tenant_user_warehouses_tenant_user_id_fkey"
  FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "tenant_user_warehouses_tenant_user_id_warehouse_id_key"
  ON "tenant_user_warehouses"("tenant_user_id", "warehouse_id");

CREATE INDEX "tenant_user_warehouses_tenant_user_id_idx"
  ON "tenant_user_warehouses"("tenant_user_id");
