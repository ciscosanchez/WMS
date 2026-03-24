import { redirect } from "next/navigation";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import { config } from "@/lib/config";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
  locale?: string;
  tenants: Array<{
    tenantId: string;
    slug: string;
    role: TenantRole;
  }>;
}

const MOCK_USER: SessionUser = {
  id: "mock-user-1",
  email: "admin@ramola.io",
  name: "Admin User",
  isSuperadmin: true,
  tenants: [{ tenantId: "mock-tenant-1", slug: "demo", role: "admin" }],
};

// ─── Role hierarchy ────────────────────────────────────────────────────────────

const ROLE_LEVEL: Record<TenantRole, number> = {
  admin: 40,
  manager: 30,
  warehouse_worker: 20,
  viewer: 10,
};

/** Minimum role level required for each permission key. */
const PERMISSION_LEVEL: Record<string, number> = {
  // Clients
  "clients:read": 10,
  "clients:write": 40,
  // Products
  "products:read": 10,
  "products:write": 30,
  // Receiving
  "receiving:read": 10,
  "receiving:write": 20,
  "receiving:complete": 30,
  // Inventory
  "inventory:read": 10,
  "inventory:write": 20,
  "inventory:adjust": 30,
  "inventory:approve": 30,
  "inventory:count": 20,
  // Orders
  "orders:read": 10,
  "orders:write": 30,
  // Warehouse / bins
  "warehouse:read": 10,
  "warehouse:write": 30,
  // Shipping / outbound
  "shipping:read": 10,
  "shipping:write": 20,
  // Operator floor screens
  "operator:write": 20,
  // Reports
  "reports:read": 10,
  // Settings (admin-only)
  "settings:read": 30,
  "settings:write": 40,
  // User management
  "users:read": 30,
  "users:write": 40,
};

// ─── Core auth helpers ─────────────────────────────────────────────────────────

export async function getSession(): Promise<{ user: SessionUser } | null> {
  if (config.useMockAuth) {
    return { user: MOCK_USER };
  }

  const { auth } = await import("@/lib/auth/auth-options");
  const session = await auth();
  if (!session?.user) return null;

  return { user: session.user as unknown as SessionUser };
}

export async function requireAuth(): Promise<SessionUser> {
  if (config.useMockAuth) {
    return MOCK_USER;
  }

  const { auth } = await import("@/lib/auth/auth-options");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return session.user as unknown as SessionUser;
}

// ─── Tenant-scoped auth helpers ────────────────────────────────────────────────

/**
 * Verify the authenticated user is a member of the given tenant.
 * Superadmins bypass membership checks.
 * Redirects to /login on failure.
 */
export async function requireTenantAccess(tenantSlug: string) {
  if (config.useMockAuth) {
    return { user: MOCK_USER, role: "admin" as TenantRole };
  }

  const user = await requireAuth();
  const membership = user.tenants.find((t) => t.slug === tenantSlug);

  if (!membership && !user.isSuperadmin) {
    redirect("/login");
  }

  return { user, role: (membership?.role ?? "admin") as TenantRole };
}

/**
 * Verify the authenticated user has at least the minimum role required for
 * the given permission on the given tenant. Throws 403 if not.
 */
export async function requirePermission(tenantSlug: string, permission: string) {
  if (config.useMockAuth) {
    return { user: MOCK_USER, role: "admin" as TenantRole };
  }

  const { user, role } = await requireTenantAccess(tenantSlug);

  // Superadmins have all permissions
  if (user.isSuperadmin) return { user, role };

  const userLevel = ROLE_LEVEL[role] ?? 0;
  const requiredLevel = PERMISSION_LEVEL[permission] ?? 40; // Unknown permissions require admin (fail-closed)

  if (userLevel < requiredLevel) {
    throw new Error(`Forbidden: requires "${permission}" (your role: ${role})`);
  }

  return { user, role };
}
