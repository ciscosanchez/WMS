import {
  checkPermissionLevel,
  getAccessRisks,
  getPermissionPreset,
  getPermissions,
  hasPermission,
  validatePermissionPolicy,
} from "@/lib/auth/rbac";

describe("RBAC", () => {
  describe("hasPermission", () => {
    it("admin has all permissions", () => {
      expect(hasPermission("admin", "clients:read")).toBe(true);
      expect(hasPermission("admin", "clients:write")).toBe(true);
      expect(hasPermission("admin", "settings:write")).toBe(true);
      expect(hasPermission("admin", "users:write")).toBe(true);
      expect(hasPermission("admin", "inventory:approve")).toBe(true);
    });

    it("manager can read settings but not write", () => {
      expect(hasPermission("manager", "settings:read")).toBe(true);
      expect(hasPermission("manager", "settings:write")).toBe(false);
    });

    it("manager can approve inventory adjustments", () => {
      expect(hasPermission("manager", "inventory:approve")).toBe(true);
    });

    it("warehouse_worker can receive and move inventory", () => {
      expect(hasPermission("warehouse_worker", "receiving:read")).toBe(true);
      expect(hasPermission("warehouse_worker", "receiving:write")).toBe(true);
      expect(hasPermission("warehouse_worker", "inventory:write")).toBe(true);
      expect(hasPermission("warehouse_worker", "inventory:count")).toBe(true);
    });

    it("warehouse_worker cannot access settings or manage users", () => {
      expect(hasPermission("warehouse_worker", "settings:read")).toBe(false);
      expect(hasPermission("warehouse_worker", "settings:write")).toBe(false);
      expect(hasPermission("warehouse_worker", "users:read")).toBe(false);
      expect(hasPermission("warehouse_worker", "users:write")).toBe(false);
    });

    it("warehouse_worker cannot create/edit master data", () => {
      expect(hasPermission("warehouse_worker", "clients:write")).toBe(false);
      expect(hasPermission("warehouse_worker", "products:write")).toBe(false);
      expect(hasPermission("warehouse_worker", "warehouse:write")).toBe(false);
    });

    it("viewer has read-only access", () => {
      expect(hasPermission("viewer", "clients:read")).toBe(true);
      expect(hasPermission("viewer", "products:read")).toBe(true);
      expect(hasPermission("viewer", "receiving:read")).toBe(true);
      expect(hasPermission("viewer", "inventory:read")).toBe(true);
      expect(hasPermission("viewer", "reports:read")).toBe(true);
    });

    it("viewer cannot write anything", () => {
      expect(hasPermission("viewer", "clients:write")).toBe(false);
      expect(hasPermission("viewer", "receiving:write")).toBe(false);
      expect(hasPermission("viewer", "inventory:write")).toBe(false);
      expect(hasPermission("viewer", "settings:write")).toBe(false);
    });
  });

  describe("getPermissions", () => {
    it("returns all permissions for admin", () => {
      const perms = getPermissions("admin");
      expect(perms.length).toBeGreaterThan(0);
      expect(perms).toContain("settings:write");
      expect(perms).toContain("users:write");
    });

    it("returns fewer permissions for viewer than admin", () => {
      const adminPerms = getPermissions("admin");
      const viewerPerms = getPermissions("viewer");
      expect(viewerPerms.length).toBeLessThan(adminPerms.length);
    });

    it("viewer permissions are subset of admin permissions", () => {
      const adminPerms = getPermissions("admin");
      const viewerPerms = getPermissions("viewer");
      viewerPerms.forEach((p) => {
        expect(adminPerms).toContain(p);
      });
    });
  });

  describe("permission overrides", () => {
    it("allows additive grants above the base role", () => {
      expect(
        hasPermission("viewer", "billing:read", {
          grants: ["billing:read"],
          denies: [],
        })
      ).toBe(true);
    });

    it("allows denying inherited role permissions", () => {
      expect(
        hasPermission("manager", "orders:read", {
          grants: [],
          denies: ["orders:read"],
        })
      ).toBe(false);
    });

    it("deny wins over grant", () => {
      expect(
        checkPermissionLevel("manager", "inventory:read", {
          grants: ["inventory:read"],
          denies: ["inventory:read"],
        })
      ).toBe(false);
    });
  });

  describe("phase 3 helpers", () => {
    it("returns permission presets by key", () => {
      const preset = getPermissionPreset("billing-reviewer");
      expect(preset?.grants).toContain("billing:approve");
    });

    it("flags risky portal write access", () => {
      const risks = getAccessRisks({
        role: "viewer",
        portalClientId: "client_123",
        overrides: { grants: ["orders:write"], denies: [] },
      });

      expect(risks.some((risk) => risk.code === "portal-broad-write")).toBe(true);
    });

    it("flags viewer escalation to user management", () => {
      const risks = getAccessRisks({
        role: "viewer",
        overrides: { grants: ["users:write"], denies: [] },
      });

      expect(risks.some((risk) => risk.code === "viewer-users-write")).toBe(true);
    });
  });

  describe("phase 4 policy validation", () => {
    it("blocks portal-bound users from sensitive tenant admin grants", () => {
      const violations = validatePermissionPolicy({
        role: "viewer",
        portalClientId: "client-1",
        overrides: { grants: ["users:write"], denies: [] },
      });

      expect(violations[0]?.code).toBe("portal-blocked-grants");
    });

    it("blocks viewer settings write escalation", () => {
      const violations = validatePermissionPolicy({
        role: "viewer",
        overrides: { grants: ["settings:write"], denies: [] },
      });

      expect(violations[0]?.code).toBe("viewer-settings-write-blocked");
    });
  });
});
