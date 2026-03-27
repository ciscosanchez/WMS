import { publicDb } from "@/lib/db/public-client";
import { getTenantMigrationStatus, runTenantMigrations } from "@/lib/db/tenant-migrations";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  dbSchema: string;
  status: string;
};

async function main() {
  const slug = process.argv[2]?.trim() || null;

  const where = slug ? { slug } : undefined;
  const tenants = (await publicDb.tenant.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      dbSchema: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  })) as TenantRow[];

  if (tenants.length === 0) {
    throw new Error(slug ? `No tenant found for slug "${slug}"` : "No tenants found");
  }

  console.log(`Applying tenant migrations for ${tenants.length} schema(s)...`);

  for (const tenant of tenants) {
    const before = await getTenantMigrationStatus(tenant.dbSchema);
    console.log(
      `\n[${tenant.slug}] schema=${tenant.dbSchema} status=${tenant.status} applied_before=${before.length}`
    );

    await runTenantMigrations(tenant.dbSchema);

    const after = await getTenantMigrationStatus(tenant.dbSchema);
    const appliedNow = after.length - before.length;
    console.log(
      `[${tenant.slug}] applied_after=${after.length} newly_applied=${Math.max(appliedNow, 0)}`
    );
  }

  console.log("\nTenant migration application complete.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await publicDb.$disconnect();
  });
