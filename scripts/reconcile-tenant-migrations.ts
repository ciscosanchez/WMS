import { publicDb } from "@/lib/db/public-client";
import { getTenantMigrationStatus, runTenantMigrations } from "@/lib/db/tenant-migrations";
import { readdirSync } from "fs";
import path from "path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma/tenant-migrations");
const BASELINE_THROUGH = process.env.TENANT_BASELINE_THROUGH ?? "0021_customs_freight.sql";

type TenantRow = {
  slug: string;
  dbSchema: string;
  status: string;
};

function getPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

function getBaselineMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .filter((file) => file <= BASELINE_THROUGH);
}

async function seedTenantMigrationHistory(dbSchema: string, migrationFiles: string[]) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO "${dbSchema}"`);

    const inventoryTable = await client.query<{ exists: string | null }>(
      "SELECT to_regclass('inventory') AS exists"
    );
    if (!inventoryTable.rows[0]?.exists) {
      throw new Error(`Schema "${dbSchema}" does not look like a provisioned tenant schema`);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of migrationFiles) {
      await client.query(
        "INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
        [file]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const slug = process.argv[2]?.trim() || null;
  const baselineFiles = getBaselineMigrationFiles();

  const tenants = (await publicDb.tenant.findMany({
    where: slug ? { slug } : undefined,
    select: { slug: true, dbSchema: true, status: true },
    orderBy: { createdAt: "asc" },
  })) as TenantRow[];

  if (tenants.length === 0) {
    throw new Error(slug ? `No tenant found for slug "${slug}"` : "No tenants found");
  }

  console.log(
    `Reconciling tenant migration history for ${tenants.length} schema(s) through ${BASELINE_THROUGH}...`
  );

  for (const tenant of tenants) {
    const before = await getTenantMigrationStatus(tenant.dbSchema);
    console.log(
      `\n[${tenant.slug}] schema=${tenant.dbSchema} status=${tenant.status} applied_before=${before.length}`
    );

    if (before.length === 0) {
      await seedTenantMigrationHistory(tenant.dbSchema, baselineFiles);
      console.log(`[${tenant.slug}] seeded_baseline=${baselineFiles.length}`);
    }

    await runTenantMigrations(tenant.dbSchema);

    const after = await getTenantMigrationStatus(tenant.dbSchema);
    console.log(`[${tenant.slug}] applied_after=${after.length}`);
  }

  console.log("\nTenant migration reconciliation complete.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await publicDb.$disconnect();
  });
