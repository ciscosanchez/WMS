/**
 * Permission boundary tests for requireTenantContext(permission).
 *
 * Mocks requireTenantAccess so no DB is needed.
 * Verifies the inline permission check in context.ts throws for under-privileged roles.
 */

import type { TenantRole } from "../../node_modules/.prisma/public-client";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequireTenantAccess = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: "tenant-1",
        slug: "test",
        dbSchema: "test_schema",
        status: "active",
      }),
    },
  },
}));

jest.mock("@/lib/db/tenant-client", () => ({
  getTenantDb: jest.fn().mockReturnValue({}),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: (key: string) => (key === "x-tenant-slug" ? "test" : null),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function asRole(role: TenantRole, isSuperadmin = false) {
  mockRequireTenantAccess.mockResolvedValue({
    user: {
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      isSuperadmin,
      tenants: [{ tenantId: "tenant-1", slug: "test", role }],
    },
    role,
  });
}

// Import once — module is not reset between tests
import { requireTenantContext } from "@/lib/tenant/context";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("requireTenantContext — permission enforcement", () => {
  beforeEach(() => {
    mockRequireTenantAccess.mockReset();
  });

  describe("clients:write (requires admin, level 40)", () => {
    it("allows admin", async () => {
      asRole("admin");
      await expect(requireTenantContext("clients:write")).resolves.toBeDefined();
    });

    it("blocks manager", async () => {
      asRole("manager");
      await expect(requireTenantContext("clients:write")).rejects.toThrow("Forbidden");
    });

    it("blocks warehouse_worker", async () => {
      asRole("warehouse_worker");
      await expect(requireTenantContext("clients:write")).rejects.toThrow("Forbidden");
    });

    it("blocks viewer", async () => {
      asRole("viewer");
      await expect(requireTenantContext("clients:write")).rejects.toThrow("Forbidden");
    });
  });

  describe("products:write (requires manager, level 30)", () => {
    it("allows admin", async () => {
      asRole("admin");
      await expect(requireTenantContext("products:write")).resolves.toBeDefined();
    });

    it("allows manager", async () => {
      asRole("manager");
      await expect(requireTenantContext("products:write")).resolves.toBeDefined();
    });

    it("blocks warehouse_worker", async () => {
      asRole("warehouse_worker");
      await expect(requireTenantContext("products:write")).rejects.toThrow("Forbidden");
    });

    it("blocks viewer", async () => {
      asRole("viewer");
      await expect(requireTenantContext("products:write")).rejects.toThrow("Forbidden");
    });
  });

  describe("receiving:write (requires warehouse_worker, level 20)", () => {
    it("allows admin", async () => {
      asRole("admin");
      await expect(requireTenantContext("receiving:write")).resolves.toBeDefined();
    });

    it("allows manager", async () => {
      asRole("manager");
      await expect(requireTenantContext("receiving:write")).resolves.toBeDefined();
    });

    it("allows warehouse_worker", async () => {
      asRole("warehouse_worker");
      await expect(requireTenantContext("receiving:write")).resolves.toBeDefined();
    });

    it("blocks viewer", async () => {
      asRole("viewer");
      await expect(requireTenantContext("receiving:write")).rejects.toThrow("Forbidden");
    });
  });

  describe("superadmin bypass", () => {
    it("superadmin passes even admin-only permissions regardless of tenant role", async () => {
      asRole("viewer", /* isSuperadmin */ true);
      await expect(requireTenantContext("clients:write")).resolves.toBeDefined();
      await expect(requireTenantContext("settings:write")).resolves.toBeDefined();
    });
  });

  describe("no permission argument", () => {
    it("resolves for any role when no permission is required", async () => {
      asRole("viewer");
      await expect(requireTenantContext()).resolves.toBeDefined();
    });
  });
});
