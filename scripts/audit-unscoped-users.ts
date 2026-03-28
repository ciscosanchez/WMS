/**
 * Audit users who have a scoped role (warehouse_worker, manager) but zero warehouse
 * assignments — these users resolve to warehouseAccess: null (unrestricted) at login,
 * which is wider than intended.
 *
 * Usage: npx tsx scripts/audit-unscoped-users.ts
 *
 * Output lists affected users so you can either add assignments or correct their role.
 */

import { PrismaClient } from "../node_modules/.prisma/public-client";

const prisma = new PrismaClient();

async function main() {
  const SCOPED_ROLES = ["warehouse_worker", "manager"];

  const affected = await prisma.tenantUser.findMany({
    where: {
      role: { in: SCOPED_ROLES },
      warehouseAssignments: { none: {} },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      tenant: { select: { slug: true } },
    },
    orderBy: [{ tenant: { slug: "asc" } }, { role: "asc" }],
  });

  if (affected.length === 0) {
    console.log(
      "✓ No affected users found — all scoped roles have at least one warehouse assignment."
    );
    return;
  }

  console.log(
    `⚠  Found ${affected.length} user(s) with scoped role but no warehouse assignments:\n`
  );
  console.log(["Tenant", "User ID", "Name", "Email", "Role"].join("\t"));
  for (const m of affected) {
    console.log([m.tenant.slug, m.userId, m.user.name, m.user.email, m.role].join("\t"));
  }
  console.log(
    "\nAction required: assign at least one warehouse to each user, or change their role to 'admin'."
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
