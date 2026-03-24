/**
 * @jest-environment node
 *
 * Tests for the returns module lifecycle:
 * createRma, updateRmaStatus, receiveReturnLine, inspectReturnLine, finalizeReturn
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock DB primitives ───────────────────────────────────────────────────────

const mockTxPrisma = {
  inventory: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  inventoryTransaction: { create: jest.fn() },
  returnAuthorization: {
    update: jest.fn(),
  },
};

const mockTransaction = jest.fn().mockImplementation(async (cb: any) => {
  return cb(mockTxPrisma);
});

const mockDb = {
  $transaction: mockTransaction,
  returnAuthorization: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  returnLine: {
    update: jest.fn(),
  },
  returnInspection: {
    create: jest.fn(),
  },
  inventory: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  inventoryTransaction: { create: jest.fn() },
  billingEvent: { create: jest.fn() },
  rateCard: { findFirst: jest.fn() },
  auditLog: { create: jest.fn() },
  sequence: { upsert: jest.fn().mockResolvedValue({ value: 1 }) },
};

// ── Module mocks ─────────────────────────────────────────────────────────────
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
  getTenantDb: jest.fn().mockReturnValue(mockDb),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: (key: string) => (key === "x-tenant-slug" ? "test" : null),
  }),
}));

beforeAll(() => {
  process.env.TENANT_RESOLUTION = "header";
});
afterAll(() => {
  delete process.env.TENANT_RESOLUTION;
});

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/config", () => ({
  config: { useMockData: false },
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/sequences", () => ({
  nextSequence: jest.fn().mockResolvedValue("RMA-0001"),
}));

jest.mock("@/modules/billing/capture", () => ({
  captureEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/jobs/queue", () => ({
  notificationQueue: { add: jest.fn().mockResolvedValue(undefined) },
  integrationQueue: { add: jest.fn().mockResolvedValue(undefined) },
  emailQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));

function asAdmin() {
  mockRequireTenantAccess.mockResolvedValue({
    user: {
      id: "user-1",
      email: "admin@test.com",
      name: "Admin",
      isSuperadmin: false,
      tenants: [{ tenantId: "tenant-1", slug: "test", role: "admin", portalClientId: null }],
    },
    role: "admin",
  });
}

function resetMocks() {
  jest.clearAllMocks();
  asAdmin();
  mockTransaction.mockImplementation(async (cb: any) => cb(mockTxPrisma));
}

// ── Imports (after mocks) ────────────────────────────────────────────────────
import {
  createRma,
  updateRmaStatus,
  receiveReturnLine,
  inspectReturnLine,
  finalizeReturn,
} from "@/modules/returns/actions";

// ── Tests ────────────────────────────────────────────────────────────────────
describe("Returns lifecycle", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("createRma", () => {
    const validData = {
      clientId: "client-1",
      reason: "Defective product",
    };

    const validLines = [
      { productId: "prod-1", expectedQty: 5, uom: "EA" },
      { productId: "prod-2", expectedQty: 3, uom: "EA" },
    ];

    it("creates an RMA with lines and returns rmaNumber", async () => {
      mockDb.returnAuthorization.create.mockResolvedValue({
        id: "rma-1",
        rmaNumber: "RMA-0001",
      });

      const result = await createRma(validData, validLines);

      expect(result.error).toBeUndefined();
      expect(result.rmaNumber).toBe("RMA-0001");
      expect(result.id).toBe("rma-1");
      expect(mockDb.returnAuthorization.create).toHaveBeenCalledTimes(1);

      const createCall = mockDb.returnAuthorization.create.mock.calls[0][0];
      expect(createCall.data.rmaNumber).toBe("RMA-0001");
      expect(createCall.data.clientId).toBe("client-1");
      expect(createCall.data.lines.create).toHaveLength(2);
    });

    it("rejects empty lines array", async () => {
      const result = await createRma(validData, []);

      expect(result.error).toBe("At least one return line is required");
      expect(mockDb.returnAuthorization.create).not.toHaveBeenCalled();
    });
  });

  describe("updateRmaStatus", () => {
    it("allows valid transition requested -> approved", async () => {
      mockDb.returnAuthorization.findUniqueOrThrow.mockResolvedValue({
        id: "rma-1",
        status: "requested",
      });
      mockDb.returnAuthorization.update.mockResolvedValue({});

      const result = await updateRmaStatus("rma-1", "approved");

      expect(result.error).toBeUndefined();
      expect(mockDb.returnAuthorization.update).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid transition requested -> rma_completed", async () => {
      mockDb.returnAuthorization.findUniqueOrThrow.mockResolvedValue({
        id: "rma-1",
        status: "requested",
      });

      const result = await updateRmaStatus("rma-1", "rma_completed");

      expect(result.error).toContain("Invalid");
      expect(mockDb.returnAuthorization.update).not.toHaveBeenCalled();
    });

    it("sets approvedBy and approvedAt on approve", async () => {
      mockDb.returnAuthorization.findUniqueOrThrow.mockResolvedValue({
        id: "rma-1",
        status: "requested",
      });
      mockDb.returnAuthorization.update.mockResolvedValue({});

      await updateRmaStatus("rma-1", "approved");

      const updateCall = mockDb.returnAuthorization.update.mock.calls[0][0];
      expect(updateCall.data.approvedBy).toBe("user-1");
      expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
    });
  });

  describe("receiveReturnLine", () => {
    it("increments receivedQty on the line", async () => {
      mockDb.returnLine.update.mockResolvedValue({});
      mockDb.returnAuthorization.updateMany.mockResolvedValue({});

      const result = await receiveReturnLine("rma-1", {
        lineId: "line-1",
        quantity: 3,
        condition: "good",
      });

      expect(result.error).toBeUndefined();
      expect(mockDb.returnLine.update).toHaveBeenCalledWith({
        where: { id: "line-1" },
        data: { receivedQty: { increment: 3 } },
      });
    });
  });

  describe("inspectReturnLine", () => {
    const inspectionData = {
      lineId: "line-1",
      binId: "bin-1",
      quantity: 5,
      condition: "good" as const,
      disposition: "restock" as const,
      notes: "Looks fine",
    };

    it("creates inspection and sets disposition on line", async () => {
      mockDb.returnInspection.create.mockResolvedValue({});
      mockDb.returnLine.update.mockResolvedValue({});
      mockDb.returnAuthorization.findUnique.mockResolvedValue({
        id: "rma-1",
        lines: [{ dispositionQty: 0, receivedQty: 5 }],
      });
      mockDb.returnAuthorization.updateMany.mockResolvedValue({});

      const result = await inspectReturnLine("rma-1", inspectionData);

      expect(result.error).toBeUndefined();
      expect(mockDb.returnInspection.create).toHaveBeenCalledTimes(1);

      const lineUpdate = mockDb.returnLine.update.mock.calls[0][0];
      expect(lineUpdate.data.disposition).toBe("restock");
      expect(lineUpdate.data.dispositionQty).toEqual({ increment: 5 });
    });

    it("auto-transitions to dispositioned when all lines inspected", async () => {
      mockDb.returnInspection.create.mockResolvedValue({});
      mockDb.returnLine.update.mockResolvedValue({});
      mockDb.returnAuthorization.findUnique.mockResolvedValue({
        id: "rma-1",
        lines: [
          { dispositionQty: 5, receivedQty: 5 },
          { dispositionQty: 3, receivedQty: 3 },
        ],
      });
      mockDb.returnAuthorization.updateMany.mockResolvedValue({});

      await inspectReturnLine("rma-1", inspectionData);

      expect(mockDb.returnAuthorization.updateMany).toHaveBeenCalledWith({
        where: { id: "rma-1", status: "inspecting" },
        data: { status: "dispositioned" },
      });
    });
  });

  describe("finalizeReturn", () => {
    it("rejects if not in dispositioned status", async () => {
      mockDb.returnAuthorization.findUniqueOrThrow.mockResolvedValue({
        id: "rma-1",
        status: "inspecting",
        lines: [],
      });

      const result = await finalizeReturn("rma-1");

      expect(result.error).toBe("RMA must be in dispositioned status to finalize");
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("creates inventory for restock disposition", async () => {
      mockDb.returnAuthorization.findUniqueOrThrow.mockResolvedValue({
        id: "rma-1",
        status: "dispositioned",
        clientId: "client-1",
        lines: [
          {
            id: "line-1",
            productId: "prod-1",
            disposition: "restock",
            dispositionQty: 5,
            lotNumber: "LOT-1",
            serialNumber: null,
            inspections: [{ binId: "bin-1" }],
          },
        ],
      });

      mockTxPrisma.inventory.findFirst.mockResolvedValue(null);
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.returnAuthorization.update.mockResolvedValue({});

      const result = await finalizeReturn("rma-1");

      expect(result.error).toBeUndefined();
      expect(mockTxPrisma.inventory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: "prod-1",
          binId: "bin-1",
          onHand: 5,
          available: 5,
        }),
      });
      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "return_receive",
          productId: "prod-1",
          quantity: 5,
        }),
      });
    });

    it("creates return_dispose ledger entry for dispose disposition", async () => {
      mockDb.returnAuthorization.findUniqueOrThrow.mockResolvedValue({
        id: "rma-1",
        status: "dispositioned",
        clientId: "client-1",
        lines: [
          {
            id: "line-2",
            productId: "prod-2",
            disposition: "dispose",
            dispositionQty: 3,
            lotNumber: null,
            serialNumber: null,
            dispositionNotes: "Damaged beyond repair",
            inspections: [],
          },
        ],
      });

      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.returnAuthorization.update.mockResolvedValue({});

      const result = await finalizeReturn("rma-1");

      expect(result.error).toBeUndefined();
      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "return_dispose",
          productId: "prod-2",
          quantity: 3,
          reason: "Disposed: Damaged beyond repair",
        }),
      });
      // No inventory record should be created for disposed items
      expect(mockTxPrisma.inventory.create).not.toHaveBeenCalled();
      expect(mockTxPrisma.inventory.update).not.toHaveBeenCalled();
    });
  });
});
