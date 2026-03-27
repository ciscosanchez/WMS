import type { TenantRole } from "../../../node_modules/.prisma/public-client";

export type SessionLikeUser = {
  isSuperadmin?: boolean;
  locale?: string;
  tenants?: Array<{
    slug: string;
    role: TenantRole;
    portalClientId?: string | null;
  }>;
};

export type UserPersona =
  | "superadmin"
  | "tenant_admin"
  | "tenant_manager"
  | "warehouse_worker"
  | "viewer"
  | "portal_user"
  | "operator";

export function getTenantMembership(
  user: SessionLikeUser | null | undefined,
  slug?: string | null
) {
  const tenants = user?.tenants ?? [];
  if (tenants.length === 0) return null;

  if (slug) {
    return tenants.find((tenant) => tenant.slug === slug) ?? null;
  }

  return tenants[0] ?? null;
}

export function isPortalUser(
  user: SessionLikeUser | null | undefined,
  slug?: string | null
): boolean {
  return Boolean(getTenantMembership(user, slug)?.portalClientId);
}

export function isOperatorUser(
  user: SessionLikeUser | null | undefined,
  slug?: string | null
): boolean {
  return getTenantMembership(user, slug)?.role === "warehouse_worker";
}

export function getUserPersonas(
  user: SessionLikeUser | null | undefined,
  slug?: string | null
): UserPersona[] {
  const personas = new Set<UserPersona>();
  const membership = getTenantMembership(user, slug);

  if (user?.isSuperadmin) personas.add("superadmin");

  switch (membership?.role) {
    case "admin":
      personas.add("tenant_admin");
      break;
    case "manager":
      personas.add("tenant_manager");
      break;
    case "warehouse_worker":
      personas.add("warehouse_worker");
      personas.add("operator");
      break;
    case "viewer":
      personas.add("viewer");
      break;
  }

  if (membership?.portalClientId) {
    personas.add("portal_user");
  }

  return [...personas];
}

export function getDefaultTenantPath(
  user: SessionLikeUser | null | undefined,
  slug?: string | null
): string {
  if (isPortalUser(user, slug)) return "/portal/inventory";
  if (isOperatorUser(user, slug)) return "/my-tasks";
  return "/dashboard";
}
