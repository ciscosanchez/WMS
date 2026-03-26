/**
 * DEV / LOCAL USE ONLY — never run against production.
 *
 * Seed a new tenant for colleague testing.
 * Usage: npx tsx scripts/seed-colleague.ts
 *
 * Creates (weak passwords — dev only):
 *   - Tenant: "Colleague Sandbox" (slug: colleague)
 *   - Admin user: colleague@ramola.io / colleague123
 *   - Warehouse with zones + bins
 *   - Sample clients + products
 *
 * This is a completely isolated tenant — separate DB schema, separate data.
 */

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: seed-colleague.ts must not be run in a production environment.");
  process.exit(1);
}

import { PrismaClient } from "../node_modules/.prisma/public-client";
import { PrismaClient as TenantPrismaClient } from "../node_modules/.prisma/tenant-client";
import { hash } from "bcryptjs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function main() {
  console.log("Creating colleague tenant...\n");

  // ─── 1. Create user ───────────────────────────────────────────────────────
  const email = "colleague@ramola.io";
  const password = "colleague123";
  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "Colleague Admin", passwordHash },
    create: {
      email,
      name: "Colleague Admin",
      passwordHash,
      isSuperadmin: false,
    },
  });
  console.log(`  User: ${email} / ${password} (admin)`);

  // ─── 2. Provision tenant ──────────────────────────────────────────────────
  const slug = "colleague";
  const dbSchema = "tenant_colleague";

  let tenant = await prisma.tenant.findUnique({ where: { slug } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Colleague Sandbox",
        slug,
        dbSchema,
        status: "provisioning",
        plan: "professional",
        settings: {
          timezone: "America/Chicago",
          defaultCity: "Houston",
          defaultState: "TX",
        },
      },
    });

    // Create PostgreSQL schema
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`);

    // Run tenant migrations (applies all 0001-0019 migration files)
    const schemaPath = path.resolve(process.cwd(), "prisma/tenant-schema.prisma");
    const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${dbSchema}`;

    console.log("  Running tenant migrations...");
    await execAsync(
      `npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
      { env: { ...process.env, DATABASE_URL: dbUrl } }
    );

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "active" },
    });
    console.log(`  Tenant: Colleague Sandbox (${slug})`);
  } else {
    console.log(`  Tenant already exists: ${tenant.name}`);
  }

  // ─── 3. Link user to tenant as admin ──────────────────────────────────────
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: "admin" },
    create: { tenantId: tenant.id, userId: user.id, role: "admin" },
  });
  console.log("  Linked user as admin");

  // ─── 4. Seed sample data ──────────────────────────────────────────────────
  const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${dbSchema}`;
  const tenantDb = new TenantPrismaClient({ datasourceUrl: dbUrl });

  // Warehouse
  const warehouse = await tenantDb.warehouse.upsert({
    where: { code: "HOU-01" },
    update: {},
    create: {
      code: "HOU-01",
      name: "Houston Main Warehouse",
      address: "5000 Westheimer Rd, Houston, TX 77056",
    },
  });

  // Zones
  const zones = [
    { code: "RCV", name: "Receiving", type: "receiving" },
    { code: "A", name: "General Storage", type: "storage" },
    { code: "B", name: "Cold Storage", type: "storage" },
    { code: "SHP", name: "Shipping", type: "shipping" },
  ];

  for (const z of zones) {
    const zone = await tenantDb.zone.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code: z.code } },
      update: {},
      create: { warehouseId: warehouse.id, code: z.code, name: z.name, type: z.type },
    });

    if (z.type === "storage") {
      for (let ai = 1; ai <= 2; ai++) {
        const aisleCode = String(ai).padStart(2, "0");
        const aisle = await tenantDb.aisle.upsert({
          where: { zoneId_code: { zoneId: zone.id, code: aisleCode } },
          update: {},
          create: { zoneId: zone.id, code: aisleCode },
        });

        for (let ri = 1; ri <= 2; ri++) {
          const rackCode = String(ri).padStart(2, "0");
          const rack = await tenantDb.rack.upsert({
            where: { aisleId_code: { aisleId: aisle.id, code: rackCode } },
            update: {},
            create: { aisleId: aisle.id, code: rackCode },
          });

          for (let si = 1; si <= 2; si++) {
            const shelfCode = String(si).padStart(2, "0");
            const shelf = await tenantDb.shelf.upsert({
              where: { rackId_code: { rackId: rack.id, code: shelfCode } },
              update: {},
              create: { rackId: rack.id, code: shelfCode },
            });

            for (let bi = 1; bi <= 4; bi++) {
              const binCode = String(bi).padStart(2, "0");
              const barcode = `${warehouse.code}-${z.code}-${aisleCode}-${rackCode}-${shelfCode}-${binCode}`;
              await tenantDb.bin.upsert({
                where: { shelfId_code: { shelfId: shelf.id, code: binCode } },
                update: {},
                create: {
                  shelfId: shelf.id,
                  code: binCode,
                  barcode,
                  type: "standard",
                  status: "available",
                },
              });
            }
          }
        }
      }
    }
  }
  console.log(`  Warehouse: HOU-01 (4 zones, 64 bins)`);

  // Clients
  const clients = [
    {
      code: "ACME",
      name: "Acme Corp",
      contactName: "Road Runner",
      contactEmail: "rr@acme.com",
      address: "100 Desert Rd",
      city: "Houston",
      state: "TX",
      country: "US",
      zipCode: "77001",
    },
    {
      code: "GLOBEX",
      name: "Globex Corporation",
      contactName: "Hank Scorpio",
      contactEmail: "hank@globex.com",
      address: "200 Cypress Creek",
      city: "Houston",
      state: "TX",
      country: "US",
      zipCode: "77002",
    },
  ];

  for (const c of clients) {
    await tenantDb.client.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log(`  Clients: ${clients.length}`);

  // Products
  const products = [
    { clientCode: "ACME", sku: "ACME-WIDGET-001", name: "Standard Widget", weight: 1.5 },
    { clientCode: "ACME", sku: "ACME-GADGET-002", name: "Deluxe Gadget", weight: 3.2 },
    { clientCode: "ACME", sku: "ACME-GIZMO-003", name: "Turbo Gizmo", weight: 0.8 },
    { clientCode: "GLOBEX", sku: "GLX-DEVICE-001", name: "Doomsday Device", weight: 50.0 },
    { clientCode: "GLOBEX", sku: "GLX-LASER-002", name: "Laser Pointer XL", weight: 0.3 },
  ];

  for (const p of products) {
    const client = await tenantDb.client.findUnique({ where: { code: p.clientCode } });
    if (client) {
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
  }
  console.log(`  Products: ${products.length} SKUs`);

  await tenantDb.$disconnect();

  console.log("\n========================================");
  console.log("  Colleague tenant is ready!");
  console.log("========================================");
  console.log(`  Login URL: https://wms.ramola.app/login`);
  console.log(`  Email:     ${email}`);
  console.log(`  Password:  ${password}`);
  console.log(`  Tenant:    Colleague Sandbox`);
  console.log(`  Warehouse: HOU-01 (Houston)`);
  console.log("========================================\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
