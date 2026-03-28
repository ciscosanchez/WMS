import {
  getEffectiveWarehouseRole,
  getAccessibleWarehouseIds,
  type WarehouseAccess,
} from "../../src/lib/auth/rbac";

const WH_MEMPHIS = "wh-e2e-memphis";
const WH_ARKANSAS = "wh-e2e-arkansas";
const WH_OTHER = "wh-other";

// ─── getEffectiveWarehouseRole ────────────────────────────────────────────────

describe("getEffectiveWarehouseRole", () => {
  describe("admin bypass", () => {
    it("returns admin for admin role regardless of assignments", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: "viewer" }];
      expect(getEffectiveWarehouseRole("admin", access, WH_MEMPHIS)).toBe("admin");
    });

    it("returns admin for admin role with null warehouseAccess", () => {
      expect(getEffectiveWarehouseRole("admin", null, WH_MEMPHIS)).toBe("admin");
    });

    it("returns admin for admin role even for unassigned warehouse", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: null }];
      expect(getEffectiveWarehouseRole("admin", access, WH_ARKANSAS)).toBe("admin");
    });
  });

  describe("unrestricted users (no assignments)", () => {
    it("returns tenantRole when warehouseAccess is null", () => {
      expect(getEffectiveWarehouseRole("manager", null, WH_MEMPHIS)).toBe("manager");
    });

    it("returns tenantRole when warehouseAccess is empty array", () => {
      expect(getEffectiveWarehouseRole("manager", [], WH_MEMPHIS)).toBe("manager");
    });

    it("returns tenantRole for warehouse_worker with no restrictions", () => {
      expect(getEffectiveWarehouseRole("warehouse_worker", null, WH_MEMPHIS)).toBe(
        "warehouse_worker"
      );
    });

    it("returns tenantRole for viewer with no restrictions", () => {
      expect(getEffectiveWarehouseRole("viewer", null, WH_MEMPHIS)).toBe("viewer");
    });
  });

  describe("restricted users (has assignments)", () => {
    it("returns null for a warehouse not in assignments", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: null }];
      expect(getEffectiveWarehouseRole("manager", access, WH_ARKANSAS)).toBeNull();
    });

    it("returns null for a completely unknown warehouse", () => {
      const access: WarehouseAccess[] = [
        { warehouseId: WH_MEMPHIS, role: null },
        { warehouseId: WH_ARKANSAS, role: null },
      ];
      expect(getEffectiveWarehouseRole("manager", access, WH_OTHER)).toBeNull();
    });

    it("falls back to tenantRole when warehouse role is null", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: null }];
      expect(getEffectiveWarehouseRole("manager", access, WH_MEMPHIS)).toBe("manager");
    });

    it("uses warehouse-specific role when set", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: "viewer" }];
      expect(getEffectiveWarehouseRole("manager", access, WH_MEMPHIS)).toBe("viewer");
    });

    it("warehouse role can be lower than tenant role", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: "viewer" }];
      expect(getEffectiveWarehouseRole("manager", access, WH_MEMPHIS)).toBe("viewer");
    });

    it("warehouse role can be higher than tenant role", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: "manager" }];
      expect(getEffectiveWarehouseRole("viewer", access, WH_MEMPHIS)).toBe("manager");
    });

    it("returns correct role for each warehouse when user has multiple assignments", () => {
      const access: WarehouseAccess[] = [
        { warehouseId: WH_MEMPHIS, role: "manager" },
        { warehouseId: WH_ARKANSAS, role: "viewer" },
      ];
      expect(getEffectiveWarehouseRole("warehouse_worker", access, WH_MEMPHIS)).toBe("manager");
      expect(getEffectiveWarehouseRole("warehouse_worker", access, WH_ARKANSAS)).toBe("viewer");
    });
  });
});

// ─── E2E scenarios covered by tests/e2e/warehouse-rbac.spec.ts ───────────────
// Warehouse assignment CRUD (assignWarehouseToUser, removeWarehouseAssignment,
// updateWarehouseAssignmentRole) require a live DB and are validated via E2E.
// The guard logic tested here covers the pure-function layer.

// ─── getAccessibleWarehouseIds ────────────────────────────────────────────────

describe("getAccessibleWarehouseIds", () => {
  describe("unrestricted (returns null)", () => {
    it("returns null for admin role regardless of assignments", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: null }];
      expect(getAccessibleWarehouseIds("admin", access)).toBeNull();
    });

    it("returns null for admin role with no assignments", () => {
      expect(getAccessibleWarehouseIds("admin", null)).toBeNull();
    });

    it("returns null for manager with no assignments", () => {
      expect(getAccessibleWarehouseIds("manager", null)).toBeNull();
    });

    it("returns null for manager with empty assignments array", () => {
      expect(getAccessibleWarehouseIds("manager", [])).toBeNull();
    });

    it("returns null for warehouse_worker with no assignments", () => {
      expect(getAccessibleWarehouseIds("warehouse_worker", null)).toBeNull();
    });

    it("returns null for viewer with no assignments", () => {
      expect(getAccessibleWarehouseIds("viewer", null)).toBeNull();
    });
  });

  describe("restricted (returns array)", () => {
    it("returns warehouse IDs from assignments for manager", () => {
      const access: WarehouseAccess[] = [
        { warehouseId: WH_MEMPHIS, role: null },
        { warehouseId: WH_ARKANSAS, role: "viewer" },
      ];
      const ids = getAccessibleWarehouseIds("manager", access);
      expect(ids).toEqual([WH_MEMPHIS, WH_ARKANSAS]);
    });

    it("returns single warehouse ID for warehouse_worker with one assignment", () => {
      const access: WarehouseAccess[] = [{ warehouseId: WH_MEMPHIS, role: null }];
      expect(getAccessibleWarehouseIds("warehouse_worker", access)).toEqual([WH_MEMPHIS]);
    });

    it("includes warehouse IDs regardless of per-warehouse role value", () => {
      const access: WarehouseAccess[] = [
        { warehouseId: WH_MEMPHIS, role: "viewer" },
        { warehouseId: WH_ARKANSAS, role: null },
        { warehouseId: WH_OTHER, role: "manager" },
      ];
      const ids = getAccessibleWarehouseIds("viewer", access);
      expect(ids).toHaveLength(3);
      expect(ids).toContain(WH_MEMPHIS);
      expect(ids).toContain(WH_ARKANSAS);
      expect(ids).toContain(WH_OTHER);
    });
  });
});
