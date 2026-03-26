import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { publicDb } from "@/lib/db/public-client";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import { config } from "@/lib/config";
import { ROLE_LEVEL, PERMISSION_LEVEL } from "@/lib/auth/rbac";
import {
  DEFAULT_MOCK_AUTH_USER,
  MOCK_AUTH_COOKIE,
  decodeMockAuthCookie,
} from "@/lib/auth/mock-auth";

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

const MOCK_USER: SessionUser = DEFAULT_MOCK_AUTH_USER;

async function getMockSessionUser(): Promise<SessionUser> {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(MOCK_AUTH_COOKIE)?.value;
    return (decodeMockAuthCookie(cookieValue) as SessionUser | null) ?? MOCK_USER;
  } catch {
    return MOCK_USER;
  }
}

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
    return { user: await getMockSessionUser() };
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
    return getMockSessionUser();
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
    const user = await getMockSessionUser();
    const membership = user.tenants.find((t) => t.slug === tenantSlug);
    return { user, role: (membership?.role ?? "admin") as TenantRole };
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
    const user = await getMockSessionUser();
    const membership = user.tenants.find((t) => t.slug === tenantSlug);
    return { user, role: (membership?.role ?? "admin") as TenantRole };
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
