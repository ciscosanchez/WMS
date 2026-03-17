/**
 * Seed Armstrong tenant with demo users and warehouse data.
 * Usage: npx tsx scripts/seed-armstrong.ts
 *
 * Users created:
 *   admin@armstrong.com     / admin123      → Admin (full access)
 *   receiving@armstrong.com / receiving123  → Warehouse Worker (receiving focus)
 *   warehouse@armstrong.com / warehouse123  → Warehouse Worker (inventory focus)
 */

import { PrismaClient } from "../node_modules/.prisma/public-client";
import { PrismaClient as TenantPrismaClient } from "../node_modules/.prisma/tenant-client";
import { hash } from "bcryptjs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Armstrong data...\n");

  // 1. Create users
  const users = [
    {
      email: "admin@armstrong.com",
      name: "Cisco Sanchez",
      password: "admin123",
      isSuperadmin: true,
      role: "admin" as const,
    },
    {
      email: "receiving@armstrong.com",
      name: "Alex Morgan",
      password: "receiving123",
      isSuperadmin: false,
      role: "warehouse_worker" as const,
    },
    {
      email: "warehouse@armstrong.com",
      name: "Jamie Lee",
      password: "warehouse123",
      isSuperadmin: false,
      role: "warehouse_worker" as const,
    },
  ];

  const createdUsers = [];
  for (const u of users) {
    const passwordHash = await hash(u.password, 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, passwordHash },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        isSuperadmin: u.isSuperadmin,
      },
    });
    createdUsers.push({ ...user, role: u.role });
    console.log(`  User: ${u.email} / ${u.password} (${u.role})`);
  }

  // 2. Provision Armstrong tenant
  const dbSchema = "tenant_armstrong";
  let tenant = await prisma.tenant.findUnique({ where: { slug: "armstrong" } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Armstrong Logistics",
        slug: "armstrong",
        dbSchema,
        status: "provisioning",
        plan: "enterprise",
        settings: {
          timezone: "America/Chicago",
          defaultCity: "Dallas",
          defaultState: "TX",
        },
      },
    });

    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`);

    const schemaPath = path.resolve(process.cwd(), "prisma/tenant-schema.prisma");
    const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${dbSchema}`;

    console.log("\n  Running tenant migrations...");
    await execAsync(
      `npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
      { env: { ...process.env, DATABASE_URL: dbUrl } }
    );

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "active" },
    });
    console.log(`  Tenant: Armstrong Logistics (armstrong)`);
  } else {
    console.log(`  Tenant already exists: ${tenant.name}`);
  }

  // 3. Link users to tenant
  for (const u of createdUsers) {
    await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: u.id } },
      update: { role: u.role },
      create: { tenantId: tenant.id, userId: u.id, role: u.role },
    });
  }
  console.log(`  Linked ${createdUsers.length} users to Armstrong tenant`);

  // 4. Seed tenant data
  const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${dbSchema}`;
  const tenantDb = new TenantPrismaClient({ datasourceUrl: dbUrl });

  // Warehouse
  const warehouse = await tenantDb.warehouse.upsert({
    where: { code: "DAL-01" },
    update: {},
    create: {
      code: "DAL-01",
      name: "Dallas Main Warehouse",
      address: "1200 Industrial Blvd, Dallas, TX 75207",
    },
  });

  // Zones
  const zoneData = [
    { code: "RCV", name: "Receiving Dock", type: "receiving" },
    { code: "A", name: "General Storage", type: "storage" },
    { code: "B", name: "High Value Storage", type: "storage" },
    { code: "SHP", name: "Shipping Dock", type: "shipping" },
  ];

  for (const z of zoneData) {
    const zone = await tenantDb.zone.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code: z.code } },
      update: {},
      create: { warehouseId: warehouse.id, code: z.code, name: z.name, type: z.type },
    });

    // Create aisles, racks, shelves, bins for storage zones
    if (z.type === "storage") {
      for (let ai = 1; ai <= 3; ai++) {
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

          for (let si = 1; si <= 3; si++) {
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
  console.log(`  Warehouse: DAL-01 (4 zones, 144 bins)`);

  // Clients
  const clients = [
    {
      code: "ARTERIORS",
      name: "Arteriors Home",
      contactName: "Lisa Chen",
      contactEmail: "lisa@arteriors.com",
      contactPhone: "(214) 555-0301",
      address: "4545 Simonton Rd",
      city: "Dallas",
      state: "TX",
      country: "US",
      zipCode: "75244",
    },
    {
      code: "HONEYWELL",
      name: "Honeywell Safety Products",
      contactName: "Mark Thompson",
      contactEmail: "mark.t@honeywell.com",
      contactPhone: "(214) 555-0302",
      address: "300 Concord Rd",
      city: "Addison",
      state: "TX",
      country: "US",
      zipCode: "75001",
    },
    {
      code: "LIGHTANNEX",
      name: "Light Annex",
      contactName: "Sarah Kim",
      contactEmail: "sarah@lightannex.com",
      contactPhone: "(214) 555-0303",
      address: "1100 Dragon St",
      city: "Dallas",
      state: "TX",
      country: "US",
      zipCode: "75207",
    },
    {
      code: "AUDIT",
      name: "Audit Logistics",
      contactName: "James Davis",
      contactEmail: "james@auditlogistics.com",
      contactPhone: "(214) 555-0304",
      address: "2200 Commerce St",
      city: "Dallas",
      state: "TX",
      country: "US",
      zipCode: "75201",
    },
  ];

  for (const c of clients) {
    await tenantDb.client.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log(`  Clients: ${clients.length} (Arteriors, Honeywell, Light Annex, Audit)`);

  // Products
  const products = [
    { clientCode: "ARTERIORS", sku: "ART-LAMP-001", name: "Caviar Adjustable Pendant", weight: 8.5 },
    { clientCode: "ARTERIORS", sku: "ART-TABLE-002", name: "Mosquito Side Table", weight: 22.0 },
    { clientCode: "ARTERIORS", sku: "ART-MIRROR-003", name: "Keri Mirror", weight: 15.0 },
    { clientCode: "HONEYWELL", sku: "HW-VEST-001", name: "Hi-Vis Safety Vest Class 3", weight: 0.4 },
    { clientCode: "HONEYWELL", sku: "HW-GLOVE-002", name: "Cut-Resistant Gloves (12pk)", weight: 1.8 },
    { clientCode: "HONEYWELL", sku: "HW-HARD-003", name: "Hard Hat with Ratchet", weight: 0.9 },
    { clientCode: "LIGHTANNEX", sku: "LA-FIX-001", name: "Modern Flush Mount LED", weight: 3.2 },
    { clientCode: "LIGHTANNEX", sku: "LA-PEND-002", name: "Industrial Pendant Light", weight: 5.6 },
    { clientCode: "AUDIT", sku: "AUD-PALLET-001", name: "Standard Pallet Shipment", weight: 500.0 },
    { clientCode: "AUDIT", sku: "AUD-LTL-002", name: "LTL Freight Unit", weight: 200.0 },
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
  console.log(`  Products: ${products.length} SKUs across all clients`);

  await tenantDb.$disconnect();
  console.log("\nDone! Armstrong tenant is ready.");
  console.log("  WMS login: https://wms.ramola.app/login");
  console.log("  Accounts:");
  for (const u of users) {
    console.log(`    ${u.email} / ${u.password} (${u.role})`);
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
