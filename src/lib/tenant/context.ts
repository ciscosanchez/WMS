import { headers } from "next/headers";
import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import type { SessionUser } from "@/lib/auth/session";
import {
  checkPermissionLevel,
  getEffectiveWarehouseRole,
  getAccessibleWarehouseIds,
  type PermissionOverrides,
  type WarehouseAccess,
} from "@/lib/auth/rbac";

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
 * - warehouseId provided and user has no access to that warehouse
 *
 * When warehouseId is provided, returns effectiveWarehouseRole (the role to
 * use for permission checks at that specific warehouse).
 */
export async function requireTenantContext(
  permission?: string,
  opts?: { warehouseId?: string }
): Promise<{
  user: SessionUser;
  role: TenantRole;
  tenant: TenantContext;
  portalClientId?: string | null;
  permissionOverrides?: PermissionOverrides | null;
  warehouseAccess: WarehouseAccess[] | null;
  effectiveWarehouseRole?: TenantRole | null;
}> {
  const slug = await getTenantFromHeaders();
  if (!slug) throw new Error("No tenant context");

  // requireTenantAccess does auth + membership check together
  const { requireTenantAccess } = await import("@/lib/auth/session");
  const { user, role, permissionOverrides, warehouseAccess } = await requireTenantAccess(slug);

  // Resolve warehouse role first — permission check must use it if present.
  // A per-warehouse role override (e.g. manager downgraded to viewer at a location)
  // must gate the permission check, not the broader tenant role.
  let effectiveWarehouseRole: TenantRole | null | undefined;
  if (opts?.warehouseId && !user.isSuperadmin) {
    effectiveWarehouseRole = getEffectiveWarehouseRole(role, warehouseAccess, opts.warehouseId);
    if (effectiveWarehouseRole === null) {
      throw new Error(`Forbidden: no access to warehouse "${opts.warehouseId}"`);
    }
  }

  // Permission check — use effectiveWarehouseRole when available so a warehouse-scoped
  // downgrade (manager→viewer at location) is enforced, not bypassed by the tenant role.
  if (permission && !user.isSuperadmin) {
    const roleForCheck = effectiveWarehouseRole ?? role;
    if (!checkPermissionLevel(roleForCheck, permission, permissionOverrides)) {
      throw new Error(`Forbidden: requires "${permission}" (your role: ${roleForCheck})`);
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
    permissionOverrides,
    warehouseAccess,
    effectiveWarehouseRole,
  };
}

/**
 * Returns the accessible warehouse IDs for the current request.
 * Convenience wrapper for use in list queries.
 * null = unrestricted (show all), string[] = show only these.
 */
export async function getRequestWarehouseFilter(): Promise<string[] | null> {
  const slug = await getTenantFromHeaders();
  if (!slug) return null;

  const { requireTenantAccess } = await import("@/lib/auth/session");
  const { user, role, warehouseAccess } = await requireTenantAccess(slug);

  if (user.isSuperadmin) return null;
  return getAccessibleWarehouseIds(role, warehouseAccess);
}

export async function requirePortalContext() {
  const context = await requireTenantContext();
  if (!context.portalClientId) {
    throw new Error("Forbidden: portal client binding required");
  }
  return context;
}
