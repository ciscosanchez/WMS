import { redirect } from "next/navigation";
import { publicDb } from "@/lib/db/public-client";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import { config } from "@/lib/config";
import { ROLE_LEVEL, PERMISSION_LEVEL } from "@/lib/auth/rbac";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
  authVersion: number;
  locale?: string;
  tenants: Array<{
    tenantId: string;
    slug: string;
    role: TenantRole;
    portalClientId?: string | null;
  }>;
}

const MOCK_USER: SessionUser = {
  id: "mock-user-1",
  email: "admin@ramola.io",
  name: "Admin User",
  isSuperadmin: true,
  authVersion: 0,
  tenants: [{ tenantId: "mock-tenant-1", slug: "demo", role: "admin" }],
};

async function validateSessionUser(user: SessionUser): Promise<SessionUser | null> {
  const current = await publicDb.user.findUnique({
    where: { id: user.id },
    select: { authVersion: true },
  });

  if (!current) return null;
  if (current.authVersion !== user.authVersion) return null;
  return user;
}

// ─── Core auth helpers ─────────────────────────────────────────────────────────

export async function getSession(): Promise<{ user: SessionUser } | null> {
  if (config.useMockAuth) {
    return { user: MOCK_USER };
  }

  const { auth } = await import("@/lib/auth/auth-options");
  const session = await auth();
  if (!session?.user) return null;

  const user = await validateSessionUser(session.user as unknown as SessionUser);
  if (!user) return null;

  return { user };
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

  const user = await validateSessionUser(session.user as unknown as SessionUser);
  if (!user) {
    redirect("/login");
  }

  return user;
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
