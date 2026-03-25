/**
 * Versioned tenant migration runner.
 *
 * Reads SQL files from prisma/tenant-migrations/, applies any that have not
 * yet been run against the given tenant schema, and records each one in a
 * _migrations tracking table inside that schema.
 *
 * All migration statements are executed inside a single transaction with
 * SET LOCAL search_path so that unqualified table names resolve to the
 * correct tenant schema without risk of leaking across connections.
 */
import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma/tenant-migrations");

function getPool(): pg.Pool {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

/**
 * Split a SQL file into individual statements, stripping blank lines and
 * single-line comments. Handles the common case of Prisma-generated migration
 * files that separate statements with `;\n\n`.
 */
function splitStatements(sql: string): string[] {
  const withoutLineComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return withoutLineComments
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function runTenantMigrations(dbSchema: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Pin all subsequent DDL to the tenant schema for this transaction
    await client.query(`SET LOCAL search_path TO "${dbSchema}"`);

    // Create the migrations tracking table if it doesn't exist yet
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id        SERIAL      PRIMARY KEY,
        name      TEXT        NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Which migrations are already applied?
    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM _migrations ORDER BY id"
    );
    const applied = new Set(rows.map((r) => r.name));

    // Read and sort migration files (lexicographic = chronological with numbered names)
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      const statements = splitStatements(sql);

      if (statements.length === 0) {
        throw new Error(`Tenant migration "${file}" contains no executable SQL statements`);
      }

      for (const stmt of statements) {
        await client.query(stmt);
      }

      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Tenant migration failed for schema "${dbSchema}": ${message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Check which migrations have been applied to a tenant schema.
 * Useful for health-checks and admin tooling.
 */
export async function getTenantMigrationStatus(
  dbSchema: string
): Promise<Array<{ name: string; applied_at: Date }>> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL search_path TO "${dbSchema}"`);
    const { rows } = await client.query<{ name: string; applied_at: Date }>(
      "SELECT name, applied_at FROM _migrations ORDER BY id"
    );
    return rows;
  } catch {
    // _migrations table doesn't exist yet — no migrations applied
    return [];
  } finally {
    client.release();
    await pool.end();
  }
}
