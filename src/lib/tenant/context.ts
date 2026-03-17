import { headers } from "next/headers";
import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";

export interface TenantContext {
  tenantId: string;
  slug: string;
  dbSchema: string;
  db: PrismaClient;
}

export async function getTenantFromHeaders(): Promise<string | null> {
  const headersList = await headers();

  if (process.env.TENANT_RESOLUTION === "header") {
    const slug = headersList.get("x-tenant-slug");
    if (slug) return slug;
    // Cookie fallback for browser
    const cookieHeader = headersList.get("cookie") || "";
    const match = cookieHeader.match(/tenant-slug=([^;]+)/);
    if (match) return match[1];
    // Dev default — avoids needing to set cookie manually
    if (process.env.DEFAULT_TENANT_SLUG) return process.env.DEFAULT_TENANT_SLUG;
    return null;
  }

  // Production: extract from subdomain
  const host = headersList.get("host") || "";
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0];

  return null;
}

export async function resolveTenant(): Promise<TenantContext | null> {
  const slug = await getTenantFromHeaders();
  if (!slug) return null;

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");

  const tenant = await publicDb.tenant.findUnique({
    where: { slug, status: "active" },
  });
  if (!tenant) return null;

  const db = getTenantDb(tenant.dbSchema);
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    dbSchema: tenant.dbSchema,
    db,
  };
}
