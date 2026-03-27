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

export type PermissionOverrides = {
  grants: Permission[];
  denies: Permission[];
};

export type PermissionPreset = {
  key: string;
  label: string;
  description: string;
  grants: Permission[];
  denies: Permission[];
};

export type AccessRisk = {
  code: string;
  severity: "high" | "medium";
  message: string;
};

const EMPTY_PERMISSION_OVERRIDES: PermissionOverrides = {
  grants: [],
  denies: [],
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LEVEL) as Permission[];

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    key: "billing-reviewer",
    label: "Billing Reviewer",
    description: "Approves billing without broad settings access.",
    grants: ["billing:approve"],
    denies: [],
  },
  {
    key: "receiving-lead",
    label: "Receiving Lead",
    description: "Adds completion authority to receiving-heavy operators.",
    grants: ["receiving:complete"],
    denies: [],
  },
  {
    key: "floor-supervisor",
    label: "Floor Supervisor",
    description: "Adds warehouse and shipping write access for floor oversight.",
    grants: ["warehouse:write", "shipping:write"],
    denies: [],
  },
  {
    key: "support-read-only",
    label: "Support Read-Only",
    description: "Broad visibility without tenant write access.",
    grants: ["settings:read", "users:read"],
    denies: [
      "inventory:write",
      "shipping:write",
      "orders:write",
      "billing:write",
      "billing:approve",
      "users:write",
      "settings:write",
    ],
  },
];

export const PERMISSION_GROUPS: Array<{
  key: string;
  label: string;
  permissions: Permission[];
}> = [
  { key: "clients", label: "Clients", permissions: ["clients:read", "clients:write"] },
  { key: "products", label: "Products", permissions: ["products:read", "products:write"] },
  {
    key: "receiving",
    label: "Receiving",
    permissions: ["receiving:read", "receiving:write", "receiving:complete"],
  },
  {
    key: "inventory",
    label: "Inventory",
    permissions: [
      "inventory:read",
      "inventory:write",
      "inventory:adjust",
      "inventory:approve",
      "inventory:count",
    ],
  },
  { key: "orders", label: "Orders", permissions: ["orders:read", "orders:write"] },
  { key: "warehouse", label: "Warehouse", permissions: ["warehouse:read", "warehouse:write"] },
  { key: "shipping", label: "Shipping", permissions: ["shipping:read", "shipping:write"] },
  { key: "operator", label: "Operator", permissions: ["operator:read", "operator:write"] },
  {
    key: "crossDock",
    label: "Cross-Dock",
    permissions: ["cross_dock:read", "cross_dock:write"],
  },
  {
    key: "returns",
    label: "Returns",
    permissions: ["returns:read", "returns:write", "returns:approve", "returns:dispose"],
  },
  {
    key: "yardDock",
    label: "Yard & Dock",
    permissions: ["yard-dock:read", "yard-dock:write", "yard-dock:manage"],
  },
  {
    key: "billing",
    label: "Billing",
    permissions: ["billing:read", "billing:write", "billing:approve"],
  },
  {
    key: "customs",
    label: "Customs",
    permissions: ["customs:read", "customs:write", "customs:file"],
  },
  { key: "reports", label: "Reports", permissions: ["reports:read"] },
  { key: "settings", label: "Settings", permissions: ["settings:read", "settings:write"] },
  { key: "users", label: "Users", permissions: ["users:read", "users:write"] },
];

// ─── Derived role → permissions map ──────────────────────────────────────────

const rolePermissions: Record<TenantRole, string[]> = {
  admin: Object.keys(PERMISSION_LEVEL).filter((p) => PERMISSION_LEVEL[p] <= ROLE_LEVEL.admin),
  manager: Object.keys(PERMISSION_LEVEL).filter((p) => PERMISSION_LEVEL[p] <= ROLE_LEVEL.manager),
  warehouse_worker: Object.keys(PERMISSION_LEVEL).filter(
    (p) => PERMISSION_LEVEL[p] <= ROLE_LEVEL.warehouse_worker
  ),
  viewer: Object.keys(PERMISSION_LEVEL).filter((p) => PERMISSION_LEVEL[p] <= ROLE_LEVEL.viewer),
};

export function normalizePermissionOverrides(
  raw: unknown
): PermissionOverrides {
  if (!raw || typeof raw !== "object") return EMPTY_PERMISSION_OVERRIDES;

  const candidate = raw as { grants?: unknown; denies?: unknown };
  const grants = Array.isArray(candidate.grants)
    ? candidate.grants.filter((permission): permission is Permission =>
        typeof permission === "string" && permission in PERMISSION_LEVEL
      )
    : [];
  const denies = Array.isArray(candidate.denies)
    ? candidate.denies.filter((permission): permission is Permission =>
        typeof permission === "string" && permission in PERMISSION_LEVEL
      )
    : [];

  return {
    grants: [...new Set(grants)],
    denies: [...new Set(denies)],
  };
}

export function getPermissions(role: TenantRole): Permission[] {
  return (rolePermissions[role] ?? []) as Permission[];
}

export function getEffectivePermissions(
  role: TenantRole,
  overrides?: unknown
): Permission[] {
  const normalized = normalizePermissionOverrides(overrides);
  const effective = new Set<Permission>(getPermissions(role));

  for (const permission of normalized.grants) {
    effective.add(permission);
  }

  for (const permission of normalized.denies) {
    effective.delete(permission);
  }

  return [...effective];
}

export function hasPermission(
  role: TenantRole,
  permission: string,
  overrides?: unknown
): boolean {
  if (!(permission in PERMISSION_LEVEL)) return false;
  return getEffectivePermissions(role, overrides).includes(permission as Permission);
}

/**
 * Check if a role meets the minimum level for a permission.
 * Unknown permissions require admin (fail-closed).
 */
export function checkPermissionLevel(
  role: TenantRole,
  permission: string,
  overrides?: unknown
): boolean {
  const normalized = normalizePermissionOverrides(overrides);

  if (permission in PERMISSION_LEVEL) {
    if (normalized.denies.includes(permission as Permission)) return false;
    if (normalized.grants.includes(permission as Permission)) return true;
  }

  const userLevel = ROLE_LEVEL[role] ?? 0;
  const requiredLevel = PERMISSION_LEVEL[permission] ?? 40;
  return userLevel >= requiredLevel;
}

export function getPermissionLabel(permission: Permission): string {
  const [resource, action] = permission.split(":");
  const resourceLabel = resource
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const actionLabel = action.replace(/\b\w/g, (char) => char.toUpperCase());
  return `${resourceLabel}: ${actionLabel}`;
}

export function getPermissionPreset(key: string): PermissionPreset | null {
  return PERMISSION_PRESETS.find((preset) => preset.key === key) ?? null;
}

export function getPermissionDiffSummary(role: TenantRole, overrides?: unknown) {
  const normalized = normalizePermissionOverrides(overrides);
  const base = new Set(getPermissions(role));
  const effective = new Set(getEffectivePermissions(role, normalized));

  const added = [...effective].filter((permission) => !base.has(permission));
  const removed = [...base].filter((permission) => !effective.has(permission));

  return {
    added,
    removed,
    effectiveCount: effective.size,
    inheritedCount: base.size,
  };
}

export function getAccessRisks(opts: {
  role: TenantRole;
  portalClientId?: string | null;
  overrides?: unknown;
}): AccessRisk[] {
  const effective = new Set(getEffectivePermissions(opts.role, opts.overrides));
  const risks: AccessRisk[] = [];

  if (opts.role === "viewer" && effective.has("users:write")) {
    risks.push({
      code: "viewer-users-write",
      severity: "high",
      message: "Viewer has user management write access.",
    });
  }

  if (opts.role === "viewer" && effective.has("settings:write")) {
    risks.push({
      code: "viewer-settings-write",
      severity: "high",
      message: "Viewer has tenant settings write access.",
    });
  }

  if (opts.portalClientId) {
    const riskyPortalPermissions: Permission[] = [
      "users:write",
      "settings:write",
      "billing:approve",
      "inventory:write",
      "orders:write",
      "shipping:write",
    ];

    const found = riskyPortalPermissions.filter((permission) => effective.has(permission));
    if (found.length > 0) {
      risks.push({
        code: "portal-broad-write",
        severity: "high",
        message: `Portal-bound user has broad tenant write access: ${found.map(getPermissionLabel).join(", ")}.`,
      });
    }
  }

  if (opts.role === "warehouse_worker" && !effective.has("operator:write")) {
    risks.push({
      code: "operator-shell-mismatch",
      severity: "medium",
      message: "Warehouse worker no longer has operator write access and may lose their default shell.",
    });
  }

  if (opts.role === "manager" && !effective.has("users:read")) {
    risks.push({
      code: "manager-users-read-removed",
      severity: "medium",
      message: "Manager cannot read users and may lose expected admin visibility.",
    });
  }

  return risks;
}
