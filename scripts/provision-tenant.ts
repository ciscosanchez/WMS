/**
 * Provision a new tenant
 * Usage: npx tsx scripts/provision-tenant.ts <name> <slug>
 * Example: npx tsx scripts/provision-tenant.ts "Acme Logistics" acme
 */

import { PrismaClient } from "../../node_modules/.prisma/public-client";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function main() {
  const [, , name, slug] = process.argv;

  if (!name || !slug) {
    console.error("Usage: npx tsx scripts/provision-tenant.ts <name> <slug>");
    process.exit(1);
  }

  const dbSchema = `tenant_${slug.replace(/-/g, "_")}`;
  console.log(`Provisioning tenant: ${name} (${slug}) → schema: ${dbSchema}`);

  // Create tenant record
  const tenant = await prisma.tenant.create({
    data: { name, slug, dbSchema, status: "provisioning" },
  });
  console.log(`  Created tenant record: ${tenant.id}`);

  // Create schema
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`);
  console.log(`  Created schema: ${dbSchema}`);

  // Push tenant schema
  const schemaPath = path.resolve(process.cwd(), "prisma/tenant-schema.prisma");
  const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${dbSchema}`;

  console.log("  Pushing tenant schema...");
  const { stdout, stderr } = await execAsync(
    `npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
    { env: { ...process.env, DATABASE_URL: dbUrl } }
  );
  if (stdout) console.log(`  ${stdout}`);
  if (stderr) console.error(`  ${stderr}`);

  // Activate tenant
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { status: "active" },
  });

  console.log(`  Tenant "${name}" provisioned and active!`);
}

main()
  .catch((e) => {
    console.error("Failed to provision tenant:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
