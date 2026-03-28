import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import { normalizePermissionOverrides, type PermissionOverrides } from "@/lib/auth/rbac";

export const MOCK_AUTH_COOKIE = "wms-mock-auth";

export type MockTenantMembership = {
  tenantId: string;
  slug: string;
  role: TenantRole;
  portalClientId: string | null;
  permissionOverrides?: PermissionOverrides | null;
  warehouseAccess?: Array<{ warehouseId: string; role: TenantRole | null }> | null;
};

export type MockAuthUser = {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
  authVersion: number;
  locale?: string;
  tenants: MockTenantMembership[];
};

export const DEFAULT_MOCK_AUTH_USER: MockAuthUser = {
  id: "mock-user-1",
  email: "admin@ramola.io",
  name: "Admin User",
  isSuperadmin: true,
  authVersion: 0,
  tenants: [
    {
      tenantId: "mock-tenant-1",
      slug: "demo",
      role: "admin",
      portalClientId: null,
      permissionOverrides: { grants: [], denies: [] },
    },
  ],
};

function isTenantRole(value: unknown): value is TenantRole {
  return (
    value === "admin" || value === "manager" || value === "warehouse_worker" || value === "viewer"
  );
}

export function encodeMockAuthCookie(user: MockAuthUser): string {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

export function decodeMockAuthCookie(value: string | null | undefined): MockAuthUser | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      id?: unknown;
      email?: unknown;
      name?: unknown;
      isSuperadmin?: unknown;
      authVersion?: unknown;
      locale?: unknown;
      tenants?: unknown;
    };

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.isSuperadmin !== "boolean" ||
      typeof parsed.authVersion !== "number" ||
      !Array.isArray(parsed.tenants)
    ) {
      return null;
    }

    const tenants = parsed.tenants
      .map((tenant) => {
        if (!tenant || typeof tenant !== "object") return null;
        const membership = tenant as Record<string, unknown>;
        if (
          typeof membership.tenantId !== "string" ||
          typeof membership.slug !== "string" ||
          !isTenantRole(membership.role)
        ) {
          return null;
        }

        const rawAccess = membership.warehouseAccess;
        const warehouseAccess =
          Array.isArray(rawAccess) && rawAccess.length > 0
            ? rawAccess
                .map((wa) => {
                  if (!wa || typeof wa !== "object") return null;
                  const entry = wa as Record<string, unknown>;
                  if (typeof entry.warehouseId !== "string") return null;
                  return {
                    warehouseId: entry.warehouseId,
                    role: isTenantRole(entry.role) ? entry.role : null,
                  };
                })
                .filter((wa): wa is Exclude<typeof wa, null> => wa !== null)
            : null;

        return {
          tenantId: membership.tenantId,
          slug: membership.slug,
          role: membership.role,
          portalClientId:
            typeof membership.portalClientId === "string" || membership.portalClientId === null
              ? membership.portalClientId
              : null,
          permissionOverrides: normalizePermissionOverrides(membership.permissionOverrides),
          warehouseAccess: warehouseAccess && warehouseAccess.length > 0 ? warehouseAccess : null,
        };
      })
      .filter((tenant): tenant is Exclude<typeof tenant, null> => tenant !== null);

    if (tenants.length === 0) return null;

    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      isSuperadmin: parsed.isSuperadmin,
      authVersion: parsed.authVersion,
      locale: typeof parsed.locale === "string" ? parsed.locale : undefined,
      tenants,
    };
  } catch {
    return null;
  }
}
