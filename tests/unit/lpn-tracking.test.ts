/**
 * @jest-environment node
 *
 * Tests for LPN (License Plate Number) container tracking.
 */

import type { TenantRole } from "../../node_modules/.prisma/public-client";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockRequireTenantAccess = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

const mockDb = {
  lpn: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  lpnContent: { create: jest.fn() },
  inventory: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  inventoryTransaction: { create: jest.fn() },
  operationalAttributeValue: {
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn(),
  },
  operationalAttributeDefinition: { findMany: jest.fn().mockResolvedValue([]) },
  $transaction: jest
    .fn()
    .mockImplementation(async (cb: (p: typeof mockDb) => unknown) => cb(mockDb)),
  auditLog: { create: jest.fn() },
  sequence: { upsert: jest.fn().mockResolvedValue({ value: 1 }) },
};

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
  getTenantDb: jest.fn().mockReturnValue(mockDb),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: (key: string) => (key === "x-tenant-slug" ? "test" : null),
  }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/config", () => ({ config: { useMockData: false } }));
jest.mock("@/lib/audit", () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/sequences", () => ({ nextSequence: jest.fn().mockResolvedValue("LPN-0001") }));

beforeAll(() => {
  process.env.TENANT_RESOLUTION = "header";
});
afterAll(() => {
  delete process.env.TENANT_RESOLUTION;
});

function asAdmin() {
  mockRequireTenantAccess.mockResolvedValue({
    user: {
      id: "user-1",
      email: "admin@test.com",
      name: "Admin",
      isSuperadmin: false,
      tenants: [
        { tenantId: "tenant-1", slug: "test", role: "admin" as TenantRole, portalClientId: null },
      ],
    },
    role: "admin",
  });
}

function resetMocks() {
  jest.clearAllMocks();
  asAdmin();
  mockDb.$transaction.mockImplementation(async (cb: (p: typeof mockDb) => unknown) => cb(mockDb));
}

// ── Imports ─────────────────────────────────────────────────────────────────

import { createLpn, moveLpn, consumeLpn, addContentToLpn } from "@/modules/lpn/actions";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("LPN Container Tracking", () => {
  beforeEach(resetMocks);

  describe("createLpn", () => {
    it("creates LPN with number from sequence", async () => {
      mockDb.lpn.create.mockResolvedValue({ id: "lpn-1", lpnNumber: "LPN-0001" });

      const result = await createLpn({
        binId: "bin-1",
        palletType: "standard",
        contents: [{ productId: "prod-1", quantity: 10 }],
      });

      expect(result).toMatchObject({ lpnNumber: "LPN-0001" });
      expect(mockDb.lpn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lpnNumber: "LPN-0001", binId: "bin-1" }),
        })
      );
    });
  });

  describe("addContentToLpn", () => {
    it("adds content to active LPN", async () => {
      mockDb.lpn.findUnique.mockResolvedValue({ id: "lpn-1", status: "lpn_active" });
      mockDb.lpnContent.create.mockResolvedValue({ id: "content-1" });

      await addContentToLpn({ lpnId: "lpn-1", productId: "prod-2", quantity: 5 });

      expect(mockDb.lpnContent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lpnId: "lpn-1", productId: "prod-2", quantity: 5 }),
        })
      );
    });

    it("rejects adding to consumed LPN", async () => {
      mockDb.lpn.findUnique.mockResolvedValue({ id: "lpn-1", status: "lpn_consumed" });

      await expect(
        addContentToLpn({ lpnId: "lpn-1", productId: "prod-2", quantity: 5 })
      ).rejects.toThrow("Cannot add to consumed LPN");
    });
  });

  describe("moveLpn", () => {
    it("updates bin and status", async () => {
      mockDb.lpn.findUnique.mockResolvedValue({
        id: "lpn-1",
        status: "lpn_active",
        binId: "bin-A",
      });
      mockDb.lpn.update.mockResolvedValue({ id: "lpn-1", binId: "bin-B", status: "lpn_active" });

      await moveLpn({ lpnId: "lpn-1", targetBinId: "bin-B" });

      expect(mockDb.lpn.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lpn-1" },
          data: { binId: "bin-B", status: "lpn_active" },
        })
      );
    });

    it("rejects moving consumed LPN", async () => {
      mockDb.lpn.findUnique.mockResolvedValue({ id: "lpn-1", status: "lpn_consumed" });

      await expect(moveLpn({ lpnId: "lpn-1", targetBinId: "bin-B" })).rejects.toThrow(
        "Cannot move consumed LPN"
      );
    });
  });

  describe("consumeLpn", () => {
    it("creates inventory records for each content line", async () => {
      mockDb.lpn.findUnique.mockResolvedValue({
        id: "lpn-1",
        status: "lpn_active",
        binId: "bin-A",
        contents: [
          { productId: "prod-1", quantity: 10, lotNumber: null, serialNumber: null },
          { productId: "prod-2", quantity: 5, lotNumber: "LOT-1", serialNumber: null },
        ],
      });
      mockDb.inventory.findFirst.mockResolvedValue(null);
      mockDb.inventory.create.mockResolvedValue({});
      mockDb.inventoryTransaction.create.mockResolvedValue({});
      mockDb.lpn.update.mockResolvedValue({ id: "lpn-1", status: "lpn_consumed" });

      await consumeLpn("lpn-1");

      expect(mockDb.inventory.create).toHaveBeenCalledTimes(2);
      expect(mockDb.lpn.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lpn-1" },
          data: expect.objectContaining({ status: "lpn_consumed" }),
        })
      );
    });

    it("rejects if LPN has no bin", async () => {
      mockDb.lpn.findUnique.mockResolvedValue({
        id: "lpn-1",
        status: "lpn_active",
        binId: null,
        contents: [],
      });

      await expect(consumeLpn("lpn-1")).rejects.toThrow("no bin assigned");
    });

    it("rejects if already consumed", async () => {
      mockDb.lpn.findUnique.mockResolvedValue({ id: "lpn-1", status: "lpn_consumed" });

      await expect(consumeLpn("lpn-1")).rejects.toThrow("already consumed");
    });
  });
});
