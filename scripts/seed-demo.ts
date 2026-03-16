/**
 * Seed demo data: creates a superadmin user, a demo tenant, and sample data
 * Usage: npx tsx scripts/seed-demo.ts
 */

import { PrismaClient } from "../../node_modules/.prisma/public-client";
import { PrismaClient as TenantPrismaClient } from "../../node_modules/.prisma/tenant-client";
import { hash } from "bcryptjs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...\n");

  // 1. Create superadmin user
  const passwordHash = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@armstrong.dev" },
    update: {},
    create: {
      email: "admin@armstrong.dev",
      name: "Admin",
      passwordHash,
      isSuperadmin: true,
    },
  });
  console.log(`  Superadmin: admin@armstrong.dev / admin123`);

  // 2. Create demo tenant
  const dbSchema = "tenant_demo";
  let tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "Demo Warehouse", slug: "demo", dbSchema, status: "provisioning" },
    });

    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`);

    const schemaPath = path.resolve(process.cwd(), "prisma/tenant-schema.prisma");
    const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${dbSchema}`;

    await execAsync(
      `npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
      { env: { ...process.env, DATABASE_URL: dbUrl } }
    );

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "active" },
    });
    console.log(`  Tenant: Demo Warehouse (demo)`);
  }

  // 3. Link admin to tenant
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: {},
    create: { tenantId: tenant.id, userId: admin.id, role: "admin" },
  });

  // 4. Seed tenant data
  const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${dbSchema}`;
  const tenantDb = new TenantPrismaClient({ datasourceUrl: dbUrl });

  // Create warehouse
  const warehouse = await tenantDb.warehouse.upsert({
    where: { code: "WH1" },
    update: {},
    create: { code: "WH1", name: "Main Warehouse", address: "123 Logistics Ave" },
  });

  // Create zone
  const zone = await tenantDb.zone.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "A" } },
    update: {},
    create: { warehouseId: warehouse.id, code: "A", name: "Zone A - General Storage", type: "storage" },
  });

  // Create aisle
  const aisle = await tenantDb.aisle.upsert({
    where: { zoneId_code: { zoneId: zone.id, code: "01" } },
    update: {},
    create: { zoneId: zone.id, code: "01" },
  });

  // Create rack
  const rack = await tenantDb.rack.upsert({
    where: { aisleId_code: { aisleId: aisle.id, code: "01" } },
    update: {},
    create: { aisleId: aisle.id, code: "01" },
  });

  // Create shelf
  const shelf = await tenantDb.shelf.upsert({
    where: { rackId_code: { rackId: rack.id, code: "01" } },
    update: {},
    create: { rackId: rack.id, code: "01" },
  });

  // Create bins
  for (let i = 1; i <= 5; i++) {
    const code = String(i).padStart(2, "0");
    await tenantDb.bin.upsert({
      where: { shelfId_code: { shelfId: shelf.id, code } },
      update: {},
      create: {
        shelfId: shelf.id,
        code,
        barcode: `WH1-A-01-01-01-${code}`,
        type: "standard",
        status: "available",
      },
    });
  }
  console.log(`  Warehouse WH1 with Zone A, 5 bins`);

  // Create sample client
  const client = await tenantDb.client.upsert({
    where: { code: "ACME" },
    update: {},
    create: {
      code: "ACME",
      name: "Acme Corporation",
      contactName: "John Smith",
      contactEmail: "john@acme.com",
      contactPhone: "555-0100",
      address: "456 Commerce St",
      city: "Houston",
      state: "TX",
      country: "US",
      zipCode: "77001",
    },
  });
  console.log(`  Client: Acme Corporation (ACME)`);

  // Create sample products
  const products = [
    { sku: "WIDGET-001", name: "Standard Widget", weight: 0.5 },
    { sku: "GADGET-001", name: "Premium Gadget", weight: 1.2 },
    { sku: "PART-A100", name: "Component Part A-100", weight: 0.1 },
  ];

  for (const p of products) {
    await tenantDb.product.upsert({
      where: { clientId_sku: { clientId: client.id, sku: p.sku } },
      update: {},
      create: {
        clientId: client.id,
        sku: p.sku,
        name: p.name,
        weight: p.weight,
        baseUom: "EA",
      },
    });
  }
  console.log(`  Products: ${products.length} sample SKUs`);

  await tenantDb.$disconnect();
  console.log("\nDone! You can log in at http://localhost:3000/login");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
