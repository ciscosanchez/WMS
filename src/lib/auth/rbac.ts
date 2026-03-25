import type { TenantRole } from "../../../node_modules/.prisma/public-client";

// ─── Single source of truth: role hierarchy ──────────────────────────────────

export const ROLE_LEVEL: Record<TenantRole, number> = {
  admin: 40,
  manager: 30,
  warehouse_worker: 20,
  viewer: 10,
};

// ─── Single source of truth: permission → minimum role level ─────────────────

export const PERMISSION_LEVEL: Record<string, number> = {
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
  "operator:read": 10,
  "operator:write": 20,
  // Cross-dock
  "cross_dock:read": 10,
  "cross_dock:write": 30,
  // Returns / RMA
  "returns:read": 10,
  "returns:write": 20,
  "returns:approve": 30,
  "returns:dispose": 30,
  // Yard & dock scheduling
  "yard-dock:read": 10,
  "yard-dock:write": 20,
  "yard-dock:manage": 30,
  // Billing operations
  "billing:read": 10,
  "billing:write": 30,
  "billing:approve": 40,
  // Customs
  "customs:read": 10,
  "customs:write": 30,
  "customs:file": 40,
  // Reports
  "reports:read": 10,
  // Settings (admin-only)
  "settings:read": 30,
  "settings:write": 40,
  // User management
  "users:read": 30,
  "users:write": 40,
};

// ─── Permission type (union of all known permission keys) ────────────────────

export type Permission = keyof typeof PERMISSION_LEVEL;

// ─── Derived role → permissions map ──────────────────────────────────────────

const rolePermissions: Record<TenantRole, string[]> = {
  admin: Object.keys(PERMISSION_LEVEL).filter((p) => PERMISSION_LEVEL[p] <= ROLE_LEVEL.admin),
  manager: Object.keys(PERMISSION_LEVEL).filter((p) => PERMISSION_LEVEL[p] <= ROLE_LEVEL.manager),
  warehouse_worker: Object.keys(PERMISSION_LEVEL).filter(
    (p) => PERMISSION_LEVEL[p] <= ROLE_LEVEL.warehouse_worker
  ),
  viewer: Object.keys(PERMISSION_LEVEL).filter((p) => PERMISSION_LEVEL[p] <= ROLE_LEVEL.viewer),
};

export function hasPermission(role: TenantRole, permission: string): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function getPermissions(role: TenantRole): string[] {
  return rolePermissions[role] ?? [];
}

/**
 * Check if a role meets the minimum level for a permission.
 * Unknown permissions require admin (fail-closed).
 */
export function checkPermissionLevel(role: TenantRole, permission: string): boolean {
  const userLevel = ROLE_LEVEL[role] ?? 0;
  const requiredLevel = PERMISSION_LEVEL[permission] ?? 40;
  return userLevel >= requiredLevel;
}
