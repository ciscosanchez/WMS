/**
 * Create or promote a superadmin user in the public schema.
 *
 * Usage:
 *   npx tsx scripts/create-superadmin.ts --email ops@ramola.io --password 'StrongPass123!' --name 'Ops Admin'
 *   npx tsx scripts/create-superadmin.ts --email existing@ramola.io --promote-only
 *   npx tsx scripts/create-superadmin.ts --email admin@company.com --password 'StrongPass123!' --tenant armstrong
 */

import { PrismaClient } from "../node_modules/.prisma/public-client";
import { hash } from "bcryptjs";

type Options = {
  email: string;
  name?: string;
  password?: string;
  promoteOnly: boolean;
  tenantSlug?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    email: "",
    promoteOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--email" && value) {
      options.email = value;
      i++;
    } else if (arg === "--name" && value) {
      options.name = value;
      i++;
    } else if (arg === "--password" && value) {
      options.password = value;
      i++;
    } else if (arg === "--tenant" && value) {
      options.tenantSlug = value;
      i++;
    } else if (arg === "--promote-only") {
      options.promoteOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    }
  }

  if (!options.email) {
    console.error("Missing required argument: --email");
    printUsageAndExit(1);
  }

  if (!options.promoteOnly && !options.password) {
    console.error(
      "Missing required argument: --password (or use --promote-only for an existing user)"
    );
    printUsageAndExit(1);
  }

  return options;
}

function printUsageAndExit(code: number): never {
  console.log(`
Usage:
  npx tsx scripts/create-superadmin.ts --email ops@ramola.io --password 'StrongPass123!' --name 'Ops Admin'
  npx tsx scripts/create-superadmin.ts --email existing@ramola.io --promote-only
  npx tsx scripts/create-superadmin.ts --email admin@company.com --password 'StrongPass123!' --tenant armstrong
`);
  process.exit(code);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: options.email },
      select: { id: true, email: true, isSuperadmin: true, name: true },
    });

    let userId: string;

    if (existing) {
      const data: {
        isSuperadmin: boolean;
        name?: string;
        passwordHash?: string;
      } = {
        isSuperadmin: true,
      };

      if (options.name) data.name = options.name;
      if (options.password) {
        data.passwordHash = await hash(options.password, 12);
      }

      const updated = await prisma.user.update({
        where: { email: options.email },
        data,
        select: { id: true, email: true, isSuperadmin: true, name: true },
      });

      userId = updated.id;
      console.log(`Updated user: ${updated.email}`);
      console.log(`  Name: ${updated.name}`);
      console.log(`  Superadmin: ${updated.isSuperadmin ? "yes" : "no"}`);
      console.log(`  Password updated: ${options.password ? "yes" : "no"}`);
    } else {
      const created = await prisma.user.create({
        data: {
          email: options.email,
          name: options.name ?? options.email,
          passwordHash: await hash(options.password!, 12),
          isSuperadmin: true,
        },
        select: { id: true, email: true, isSuperadmin: true, name: true },
      });

      userId = created.id;
      console.log(`Created user: ${created.email}`);
      console.log(`  Name: ${created.name}`);
      console.log(`  Superadmin: ${created.isSuperadmin ? "yes" : "no"}`);
    }

    if (options.tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: options.tenantSlug },
        select: { id: true, name: true, slug: true },
      });

      if (!tenant) {
        throw new Error(`Tenant not found: ${options.tenantSlug}`);
      }

      await prisma.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId } },
        update: { role: "admin" },
        create: { tenantId: tenant.id, userId, role: "admin" },
      });

      console.log(`Linked to tenant: ${tenant.name} (${tenant.slug}) as admin`);
    }

    console.log("");
    console.log("Done.");
    console.log(`Login: ${options.email}`);
    console.log(`Superadmin: yes`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to create/promote superadmin:", error);
  process.exit(1);
});
