/**
 * E2E TEST SEED — DEV / CI USE ONLY. Never run against production.
 *
 * Creates the armstrong tenant with two warehouses at stable, well-known IDs
 * so Playwright tests can reference them in mock-auth personas without DB lookups.
 *
 * Stable IDs used by auth.setup.ts:
 *   Memphis DC  → "wh-e2e-memphis"
 *   Arkansas FC → "wh-e2e-arkansas"
 *
 * Usage: npx tsx scripts/seed-e2e.ts
 */

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: seed-e2e.ts must not be run in a production environment.");
  process.exit(1);
}

import { PrismaClient } from "../../node_modules/.prisma/public-client";
import { PrismaClient as TenantPrismaClient } from "../../node_modules/.prisma/tenant-client";
import { hash } from "bcryptjs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Stable warehouse IDs — defined in tests/e2e/e2e-constants.ts, mirrored here
import { E2E_WAREHOUSE_MEMPHIS, E2E_WAREHOUSE_ARKANSAS } from "../tests/e2e/e2e-constants";

const ARMSTRONG_SLUG = "armstrong";
const ARMSTRONG_SCHEMA = "tenant_armstrong";

async function main() {
  console.log("Seeding E2E data (armstrong tenant)...\n");

  // 1. Admin user
  const passwordHash = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@armstrong.com" },
    update: {},
    create: {
      email: "admin@armstrong.com",
      name: "Cisco Sanchez",
      passwordHash,
      isSuperadmin: false,
    },
  });
  console.log("  User: admin@armstrong.com / admin123");

  // 2. Armstrong tenant
  let tenant = await prisma.tenant.findUnique({ where: { slug: ARMSTRONG_SLUG } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Armstrong Logistics",
        slug: ARMSTRONG_SLUG,
        dbSchema: ARMSTRONG_SCHEMA,
        status: "provisioning",
      },
    });

    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${ARMSTRONG_SCHEMA}"`);

    const schemaPath = path.resolve(process.cwd(), "prisma/tenant-schema.prisma");
    const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${ARMSTRONG_SCHEMA}`;

    await execAsync(
      `npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
      { env: { ...process.env, DATABASE_URL: dbUrl } }
    );

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "active" },
    });
    console.log("  Tenant: Armstrong Logistics (armstrong)");
  } else {
    console.log("  Tenant: armstrong (already exists)");
  }

  // 3. Link admin to tenant
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: {},
    create: { tenantId: tenant.id, userId: admin.id, role: "admin" },
  });

  // 4. Seed warehouses with stable IDs
  const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${ARMSTRONG_SCHEMA}`;
  const tenantDb = new TenantPrismaClient({ datasourceUrl: dbUrl });

  // Memphis Distribution Center
  await tenantDb.warehouse.upsert({
    where: { code: "MEM" },
    update: { name: "Memphis Distribution Center" },
    create: {
      id: E2E_WAREHOUSE_MEMPHIS,
      code: "MEM",
      name: "Memphis Distribution Center",
      address: "1 Harbor Town Square, Memphis, TN 38103",
    },
  });

  // Arkansas Fulfillment Center
  await tenantDb.warehouse.upsert({
    where: { code: "ARK" },
    update: { name: "Arkansas Fulfillment Center" },
    create: {
      id: E2E_WAREHOUSE_ARKANSAS,
      code: "ARK",
      name: "Arkansas Fulfillment Center",
      address: "500 Distribution Blvd, Little Rock, AR 72201",
    },
  });

  console.log(`  Warehouse: Memphis DC (${E2E_WAREHOUSE_MEMPHIS})`);
  console.log(`  Warehouse: Arkansas FC (${E2E_WAREHOUSE_ARKANSAS})`);

  await tenantDb.$disconnect();
  console.log("\nDone. E2E tests can reference stable warehouse IDs from this seed.");
}

main()
  .catch((e) => {
    console.error("E2E seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
