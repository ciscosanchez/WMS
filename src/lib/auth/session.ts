import type { TenantRole } from "../../../node_modules/.prisma/public-client";

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
  email: "admin@armstrong.dev",
  name: "Admin User",
  isSuperadmin: true,
  tenants: [{ tenantId: "mock-tenant-1", slug: "demo", role: "admin" }],
};

export async function getSession() {
  return { user: MOCK_USER };
}

export async function requireAuth(): Promise<SessionUser> {
  return MOCK_USER;
}

export async function requireTenantAccess(tenantSlug: string) {
  return { user: MOCK_USER, role: "admin" as TenantRole };
}

export async function requirePermission(tenantSlug: string, permission: string) {
  return { user: MOCK_USER, role: "admin" as TenantRole };
}
