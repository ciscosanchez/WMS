#!/usr/bin/env npx tsx
/**
 * DEV / LOCAL USE ONLY — for a clean local dev environment.
 * Do NOT run this against production — it uses demo seed data with weak passwords.
 * For production schema changes use: prisma migrate deploy (handled by deploy.sh).
 *
 * Usage:
 *   npx tsx scripts/setup-production.ts
 *
 * What it does (in order):
 *   1. Checks DATABASE_URL is set and can connect
 *   2. Generates Prisma clients (public + tenant)
 *   3. Runs public schema migrations (prisma migrate deploy)
 *   4. Creates Armstrong tenant (schema + migrations + demo data)
 *   5. Creates colleague tenant (optional — for testing)
 *   6. Verifies everything works
 *
 * Safe to run multiple times — all operations are upserts.
 */

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: setup-production.ts must not be run in a production environment.");
  console.error("       For production deploys, use infra/deploy.sh.");
  process.exit(1);
}

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`\n  ${"▸"} ${msg}`);
}

function success(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
}

async function run(cmd: string, label: string): Promise<boolean> {
  log(label);
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: process.cwd(),
      env: process.env,
      timeout: 120_000,
    });
    if (stdout.trim()) console.log(`    ${stdout.trim().split("\n").join("\n    ")}`);
    if (stderr.trim() && !stderr.includes("DEPRECATION")) {
      console.log(`    ${stderr.trim().split("\n").join("\n    ")}`);
    }
    success(label);
    return true;
  } catch (err) {
    fail(`${label}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║     Ramola WMS — Production Setup        ║");
  console.log("╚══════════════════════════════════════════╝");

  // ── Step 0: Check environment ──────────────────────────────────────────
  log("Checking environment...");

  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
    console.log("\n    cp .env.example .env");
    console.log("    # Edit .env with your PostgreSQL connection string\n");
    process.exit(1);
  }
  success("DATABASE_URL is set");

  if (!process.env.AUTH_SECRET) {
    fail("AUTH_SECRET is not set. Generate one:");
    console.log("\n    openssl rand -base64 32\n");
    console.log("    Then add AUTH_SECRET=<value> to .env\n");
    process.exit(1);
  }
  success("AUTH_SECRET is set");

  // ── Step 1: Test database connection ───────────────────────────────────
  log("Testing database connection...");
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query("SELECT current_database(), current_user");
    success(`Connected to database: ${rows[0].current_database} as ${rows[0].current_user}`);
    await pool.end();
  } catch (err) {
    fail(`Cannot connect to database: ${err instanceof Error ? err.message : err}`);
    console.log("\n    Check your DATABASE_URL in .env\n");
    process.exit(1);
  }

  // ── Step 2: Generate Prisma clients ────────────────────────────────────
  const publicSchema = path.resolve("prisma/schema.prisma");
  const tenantSchema = path.resolve("prisma/tenant-schema.prisma");

  const ok2a = await run(
    `npx prisma generate --schema="${publicSchema}"`,
    "Generating public Prisma client"
  );
  const ok2b = await run(
    `npx prisma generate --schema="${tenantSchema}"`,
    "Generating tenant Prisma client"
  );
  if (!ok2a || !ok2b) {
    fail("Prisma client generation failed. Check the errors above.");
    process.exit(1);
  }

  // ── Step 3: Apply public schema migrations ─────────────────────────────
  const ok3 = await run(
    `npx prisma migrate deploy --schema="${publicSchema}"`,
    "Applying public schema migrations (users, tenants, sessions)"
  );
  if (!ok3) {
    fail("Public schema migration failed.");
    process.exit(1);
  }

  // ── Step 4: Seed Armstrong tenant ──────────────────────────────────────
  const ok4 = await run(
    "npx tsx scripts/seed-armstrong.ts",
    "Seeding Armstrong tenant (admin + warehouse + data)"
  );
  if (!ok4) {
    fail("Armstrong seed failed. Check the errors above.");
    process.exit(1);
  }

  // ── Step 5: Seed colleague tenant ──────────────────────────────────────
  const ok5 = await run(
    "npx tsx scripts/seed-colleague.ts",
    "Seeding Colleague Sandbox tenant"
  );
  if (!ok5) {
    console.log("    (Non-fatal — colleague tenant is optional)");
  }

  // ── Step 6: Verify ─────────────────────────────────────────────────────
  log("Verifying setup...");
  try {
    const { PrismaClient } = await import("../node_modules/.prisma/public-client");
    const prisma = new PrismaClient();

    const tenantCount = await prisma.tenant.count({ where: { status: "active" } });
    const userCount = await prisma.user.count();
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin@armstrong.com" },
      select: { email: true, isSuperadmin: true },
    });

    success(`Tenants: ${tenantCount} active`);
    success(`Users: ${userCount} total`);

    if (adminUser?.isSuperadmin) {
      success("Superadmin verified: admin@armstrong.com");
    } else {
      fail("Superadmin not found — login will fail");
    }

    await prisma.$disconnect();
  } catch (err) {
    fail(`Verification failed: ${err instanceof Error ? err.message : err}`);
  }

  // ── Done ───────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║            Setup Complete!                ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log("  Dev accounts (see seed scripts for credentials):");
  console.log("    admin@armstrong.com, receiving@armstrong.com, warehouse@armstrong.com");
  console.log("    colleague@ramola.io");
  console.log("");
  console.log("  URLs:");
  console.log("    WMS Login:     https://wms.ramola.app/login");
  console.log("    Platform Admin: https://wms.ramola.app/platform/tenants");
  console.log("    Operator App:  https://wms.ramola.app/receive");
  console.log("");
  console.log("  Next steps:");
  console.log("    1. Make sure USE_MOCK_DATA=false in .env");
  console.log("    2. Restart the app: pm2 restart wms (or docker compose up -d)");
  console.log("    3. Log in at https://wms.ramola.app/login");
  console.log("");
}

main().catch((e) => {
  console.error("\nSetup failed:", e);
  process.exit(1);
});
