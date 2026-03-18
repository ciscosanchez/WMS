import { publicDb } from "./public-client";
import { runTenantMigrations } from "./tenant-migrations";

export async function provisionTenant(name: string, slug: string): Promise<string> {
  const dbSchema = `tenant_${slug.replace(/-/g, "_")}`;

  // Create tenant record in provisioning state
  const tenant = await publicDb.tenant.create({
    data: {
      name,
      slug,
      dbSchema,
      status: "provisioning",
    },
  });

  try {
    // Create the Postgres schema
    await publicDb.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`);

    // Apply all versioned tenant migrations
    await runTenantMigrations(dbSchema);

    // Mark as active
    await publicDb.tenant.update({
      where: { id: tenant.id },
      data: { status: "active" },
    });

    return tenant.id;
  } catch (error) {
    // Mark as failed so we can inspect and retry — don't delete the record
    await publicDb.tenant.update({
      where: { id: tenant.id },
      data: { status: "suspended" },
    });
    throw error;
  }
}
