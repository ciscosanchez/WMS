import { headers } from "next/headers";
import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LEVEL, PERMISSION_LEVEL } from "@/lib/auth/rbac";

export interface TenantContext {
  tenantId: string;
  slug: string;
  dbSchema: string;
  db: PrismaClient;
}

export async function getTenantFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  const isDev = process.env.NODE_ENV !== "production";

  if (process.env.TENANT_RESOLUTION === "header") {
    const slug = headersList.get("x-tenant-slug");
    if (slug) return slug;

    // Cookie fallback — dev only. In production, require explicit header.
    if (isDev) {
      const cookieHeader = headersList.get("cookie") || "";
      const match = cookieHeader.match(/tenant-slug=([^;]+)/);
      if (match) return match[1];
    }

    // Default slug — dev only. Production must always resolve explicitly.
    if (isDev && process.env.DEFAULT_TENANT_SLUG) {
      return process.env.DEFAULT_TENANT_SLUG;
    }

    return null;
  }

  // Production: extract from subdomain (e.g. armstrong.wms.ramola.app → armstrong)
  // wms.ramola.app (3 parts) = base domain, no tenant
  // armstrong.wms.ramola.app (4+ parts) = tenant slug is parts[0]
  const host = headersList.get("host") || "";
  const parts = host.split(".");
  if (parts.length >= 4) return parts[0];

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
  portalClientId?: string | null;
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

  // Extract portalClientId from JWT token (no DB round-trip)
  const membership = user.tenants.find((t) => t.slug === slug);
  const portalClientId = membership?.portalClientId ?? null;

  return {
    user,
    role,
    tenant: {
      tenantId: tenant.id,
      slug: tenant.slug,
      dbSchema: tenant.dbSchema,
      db,
    },
    portalClientId,
  };
}

export async function requirePortalContext() {
  const context = await requireTenantContext();
  if (!context.portalClientId) {
    throw new Error("Forbidden: portal client binding required");
  }
  return context;
}
