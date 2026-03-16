import { redirect } from "next/navigation";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import { config } from "@/lib/config";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
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

export async function getSession(): Promise<{ user: SessionUser } | null> {
  if (config.useMockData) {
    return { user: MOCK_USER };
  }

  const { auth } = await import("@/lib/auth/auth-options");
  const session = await auth();
  if (!session?.user) return null;

  return { user: session.user as unknown as SessionUser };
}

export async function requireAuth(): Promise<SessionUser> {
  if (config.useMockData) {
    return MOCK_USER;
  }

  const { auth } = await import("@/lib/auth/auth-options");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return session.user as unknown as SessionUser;
}

export async function requireTenantAccess(tenantSlug: string) {
  if (config.useMockData) {
    return { user: MOCK_USER, role: "admin" as TenantRole };
  }

  const user = await requireAuth();
  const membership = user.tenants.find((t) => t.slug === tenantSlug);

  if (!membership && !user.isSuperadmin) {
    redirect("/login");
  }

  return { user, role: (membership?.role ?? "admin") as TenantRole };
}

export async function requirePermission(tenantSlug: string, permission: string) {
  if (config.useMockData) {
    return { user: MOCK_USER, role: "admin" as TenantRole };
  }

  const { user, role } = await requireTenantAccess(tenantSlug);
  // TODO: implement granular permission checks
  return { user, role };
}
