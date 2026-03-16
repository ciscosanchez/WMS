import { TenantRole } from "../../../node_modules/.prisma/public-client";

export type Permission =
  | "clients:read"
  | "clients:write"
  | "products:read"
  | "products:write"
  | "warehouse:read"
  | "warehouse:write"
  | "receiving:read"
  | "receiving:write"
  | "receiving:complete"
  | "inventory:read"
  | "inventory:write"
  | "inventory:adjust"
  | "inventory:approve"
  | "inventory:count"
  | "reports:read"
  | "settings:read"
  | "settings:write"
  | "users:read"
  | "users:write";

const rolePermissions: Record<TenantRole, Permission[]> = {
  admin: [
    "clients:read",
    "clients:write",
    "products:read",
    "products:write",
    "warehouse:read",
    "warehouse:write",
    "receiving:read",
    "receiving:write",
    "receiving:complete",
    "inventory:read",
    "inventory:write",
    "inventory:adjust",
    "inventory:approve",
    "inventory:count",
    "reports:read",
    "settings:read",
    "settings:write",
    "users:read",
    "users:write",
  ],
  manager: [
    "clients:read",
    "clients:write",
    "products:read",
    "products:write",
    "warehouse:read",
    "warehouse:write",
    "receiving:read",
    "receiving:write",
    "receiving:complete",
    "inventory:read",
    "inventory:write",
    "inventory:adjust",
    "inventory:approve",
    "inventory:count",
    "reports:read",
    "settings:read",
    "users:read",
  ],
  warehouse_worker: [
    "clients:read",
    "products:read",
    "warehouse:read",
    "receiving:read",
    "receiving:write",
    "inventory:read",
    "inventory:write",
    "inventory:count",
  ],
  viewer: [
    "clients:read",
    "products:read",
    "warehouse:read",
    "receiving:read",
    "inventory:read",
    "reports:read",
  ],
};

export function hasPermission(role: TenantRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function getPermissions(role: TenantRole): Permission[] {
  return rolePermissions[role] ?? [];
}
