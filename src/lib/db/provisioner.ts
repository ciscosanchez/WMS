import { publicDb } from "./public-client";
import { runTenantMigrations } from "./tenant-migrations";

export async function provisionTenant(name: string, slug: string): Promise<string> {
  // Server-side slug validation — prevent SQL injection via schema name
  if (!/^[a-z][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    throw new Error("Invalid tenant slug: must be 3-50 chars, lowercase alphanumeric + hyphens, start with letter");
  }

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
