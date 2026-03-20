import { headers } from "next/headers";
import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import type { SessionUser } from "@/lib/auth/session";

const ROLE_LEVEL: Record<TenantRole, number> = {
  admin: 40,
  manager: 30,
  warehouse_worker: 20,
  viewer: 10,
};

const PERMISSION_LEVEL: Record<string, number> = {
  "clients:read": 10, "clients:write": 40,
  "products:read": 10, "products:write": 30,
  "receiving:read": 10, "receiving:write": 20, "receiving:complete": 30,
  "inventory:read": 10, "inventory:write": 20, "inventory:adjust": 30, "inventory:approve": 30, "inventory:count": 20,
  "orders:read": 10, "orders:write": 30,
  "warehouse:read": 10, "warehouse:write": 30,
  "shipping:read": 10, "shipping:write": 20,
  "operator:write": 20,
  "reports:read": 10,
  "settings:read": 30, "settings:write": 40,
  "users:read": 30, "users:write": 40,
};

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

/**
 * Resolve the current tenant AND verify the authenticated user is a member.
 * This is the correct function to call in server actions — it enforces both
 * authentication and cross-tenant isolation in one call.
 *
 * Throws/redirects if:
 * - No valid session
 * - No tenant in request context
 * - User is not a member of this tenant (and is not a superadmin)
 */
export async function requireTenantContext(permission?: string): Promise<{
  user: SessionUser;
  role: TenantRole;
  tenant: TenantContext;
}> {
  const slug = await getTenantFromHeaders();
  if (!slug) throw new Error("No tenant context");

  // requireTenantAccess does auth + membership check together
  const { requireTenantAccess } = await import("@/lib/auth/session");
  const { user, role } = await requireTenantAccess(slug);

  // Optional permission check — uses the already-resolved role (no extra DB call)
  if (permission && !user.isSuperadmin) {
    const userLevel = ROLE_LEVEL[role] ?? 0;
    const requiredLevel = PERMISSION_LEVEL[permission] ?? 40; // Unknown permissions require admin (fail-closed)
    if (userLevel < requiredLevel) {
      throw new Error(`Forbidden: requires "${permission}" (your role: ${role})`);
    }
  }

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");

  const tenant = await publicDb.tenant.findUnique({
    where: { slug, status: "active" },
  });
  if (!tenant) throw new Error("Tenant not found or inactive");

  const db = getTenantDb(tenant.dbSchema);
  return {
    user,
    role,
    tenant: {
      tenantId: tenant.id,
      slug: tenant.slug,
      dbSchema: tenant.dbSchema,
      db,
    },
  };
}
