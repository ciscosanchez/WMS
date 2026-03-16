import { publicDb } from "./public-client";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function provisionTenant(name: string, slug: string): Promise<string> {
  const dbSchema = `tenant_${slug.replace(/-/g, "_")}`;

  // Create tenant record
  const tenant = await publicDb.tenant.create({
    data: {
      name,
      slug,
      dbSchema,
      status: "provisioning",
    },
  });

  try {
    // Create schema
    await publicDb.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`);

    // Run tenant migrations
    const schemaPath = path.resolve(process.cwd(), "prisma/tenant-schema.prisma");
    const dbUrl = `${process.env.DATABASE_URL!.split("?")[0]}?schema=${dbSchema}`;

    await execAsync(
      `npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
      {
        env: { ...process.env, DATABASE_URL: dbUrl },
      }
    );

    // Mark as active
    await publicDb.tenant.update({
      where: { id: tenant.id },
      data: { status: "active" },
    });

    return tenant.id;
  } catch (error) {
    // Mark as failed, don't delete so we can debug
    await publicDb.tenant.update({
      where: { id: tenant.id },
      data: { status: "suspended" },
    });
    throw error;
  }
}
