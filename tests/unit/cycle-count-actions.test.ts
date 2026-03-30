/**
 * @jest-environment node
 *
 * Tests for cycle count actions:
 * createCycleCountPlan, generateCycleCountTasks, submitCycleCount, approveCycleCount
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock DB primitives ───────────────────────────────────────────────────────

const mockTxPrisma = {
  adjustmentLine: { update: jest.fn() },
  inventory: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  inventoryAdjustment: { update: jest.fn() },
  inventoryTransaction: { create: jest.fn() },
};

const mockTransaction = jest.fn().mockImplementation(async (cb: any) => cb(mockTxPrisma));

const mockDb = {
  $transaction: mockTransaction,
  cycleCountPlan: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  inventory: {
    findMany: jest.fn(),
  },
  inventoryAdjustment: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  sequence: { upsert: jest.fn().mockResolvedValue({ value: 1 }) },
};

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockRequireTenantContext = jest.fn();

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockReturnValue(new Map()),
  cookies: jest.fn().mockReturnValue({ get: jest.fn(), set: jest.fn() }),
}));

jest.mock("@/lib/config", () => ({
  config: { useMockData: false },
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/sequences", () => ({
  nextSequence: jest.fn().mockResolvedValue("CC-0001"),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function asAdmin() {
  mockRequireTenantContext.mockResolvedValue({
    user: { id: "user-1", email: "admin@test.com", name: "Admin" },
    tenant: { db: mockDb },
    role: "admin",
    warehouseAccess: null,
  });
}

function resetMocks() {
  jest.clearAllMocks();
  asAdmin();
  mockTransaction.mockImplementation(async (cb: any) => cb(mockTxPrisma));
}

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  createCycleCountPlan,
  generateCycleCountTasks,
  submitCycleCount,
  approveCycleCount,
} from "@/modules/inventory/cycle-count-actions";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Cycle count actions", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── createCycleCountPlan ─────────────────────────────────────────────────

  describe("createCycleCountPlan", () => {
    it("creates a plan with valid data and returns it", async () => {
      const planData = {
        name: "Weekly Full Count",
        method: "full",
        frequency: "weekly",
        config: {},
      };

      const createdPlan = { id: "plan-1", ...planData, nextRunAt: new Date() };
      mockDb.cycleCountPlan.create.mockResolvedValue(createdPlan);

      const result = await createCycleCountPlan(planData);

      expect(result).toEqual(createdPlan);
      expect(mockDb.cycleCountPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Weekly Full Count",
          method: "full",
          frequency: "weekly",
          config: {},
        }),
      });
      // nextRunAt should be roughly 7 days in the future for weekly
      const callArgs = mockDb.cycleCountPlan.create.mock.calls[0][0];
      const nextRun = callArgs.data.nextRunAt as Date;
      const daysDiff = (nextRun.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(6);
      expect(daysDiff).toBeLessThan(8);
    });

    it("rejects invalid method", async () => {
      await expect(
        createCycleCountPlan({ name: "Bad", method: "invalid", frequency: "daily" })
      ).rejects.toThrow();
    });

    it("rejects empty name", async () => {
      await expect(
        createCycleCountPlan({ name: "", method: "full", frequency: "weekly" })
      ).rejects.toThrow();
    });
  });

  // ── generateCycleCountTasks ──────────────────────────────────────────────

  describe("generateCycleCountTasks", () => {
    it("creates adjustment lines for all occupied bins (full method)", async () => {
      const plan = {
        id: "plan-1",
        name: "Full Count",
        method: "full",
        frequency: "monthly",
        config: {},
      };
      mockDb.cycleCountPlan.findUniqueOrThrow.mockResolvedValue(plan);

      const inventoryRows = [
        {
          id: "inv-1",
          productId: "p1",
          binId: "bin-A",
          lotNumber: null,
          serialNumber: null,
          onHand: 10,
        },
        {
          id: "inv-2",
          productId: "p2",
          binId: "bin-B",
          lotNumber: "LOT-1",
          serialNumber: null,
          onHand: 25,
        },
        {
          id: "inv-3",
          productId: "p3",
          binId: "bin-C",
          lotNumber: null,
          serialNumber: "SN-001",
          onHand: 1,
        },
      ];
      mockDb.inventory.findMany.mockResolvedValue(inventoryRows);

      const createdAdj = { id: "adj-1" };
      mockDb.inventoryAdjustment.create.mockResolvedValue(createdAdj);
      mockDb.cycleCountPlan.update.mockResolvedValue({});

      const result = await generateCycleCountTasks("plan-1");

      expect(result).toEqual({ adjustmentId: "adj-1", lineCount: 3 });

      // Verify the adjustment was created with correct lines
      const createCall = mockDb.inventoryAdjustment.create.mock.calls[0][0];
      expect(createCall.data.type).toBe("cycle_count");
      expect(createCall.data.status).toBe("draft");
      expect(createCall.data.adjustmentNumber).toBe("CC-0001");
      expect(createCall.data.lines.create).toHaveLength(3);

      // Each line should have systemQty = onHand and initial variance = -onHand
      const firstLine = createCall.data.lines.create[0];
      expect(firstLine.productId).toBe("p1");
      expect(firstLine.binId).toBe("bin-A");
      expect(firstLine.systemQty).toBe(10);
      expect(firstLine.countedQty).toBe(0);
      expect(firstLine.variance).toBe(-10);
    });

    it("returns zero lineCount when no inventory matches", async () => {
      const plan = {
        id: "plan-2",
        name: "Empty Count",
        method: "full",
        frequency: "weekly",
        config: {},
      };
      mockDb.cycleCountPlan.findUniqueOrThrow.mockResolvedValue(plan);
      mockDb.inventory.findMany.mockResolvedValue([]);

      const result = await generateCycleCountTasks("plan-2");

      expect(result.adjustmentId).toBeNull();
      expect(result.lineCount).toBe(0);
      expect(mockDb.inventoryAdjustment.create).not.toHaveBeenCalled();
    });

    it("updates plan lastRunAt and nextRunAt", async () => {
      const plan = {
        id: "plan-3",
        name: "Daily Count",
        method: "full",
        frequency: "daily",
        config: {},
      };
      mockDb.cycleCountPlan.findUniqueOrThrow.mockResolvedValue(plan);
      mockDb.inventory.findMany.mockResolvedValue([
        {
          id: "inv-1",
          productId: "p1",
          binId: "bin-A",
          lotNumber: null,
          serialNumber: null,
          onHand: 5,
        },
      ]);
      mockDb.inventoryAdjustment.create.mockResolvedValue({ id: "adj-x" });
      mockDb.cycleCountPlan.update.mockResolvedValue({});

      await generateCycleCountTasks("plan-3");

      expect(mockDb.cycleCountPlan.update).toHaveBeenCalledWith({
        where: { id: "plan-3" },
        data: expect.objectContaining({
          lastRunAt: expect.any(Date),
          nextRunAt: expect.any(Date),
        }),
      });
    });
  });

  // ── submitCycleCount ─────────────────────────────────────────────────────

  describe("submitCycleCount", () => {
    const adjustment = {
      id: "adj-1",
      type: "cycle_count",
      status: "draft",
      lines: [
        { id: "line-1", systemQty: 10, countedQty: 0, variance: -10 },
        { id: "line-2", systemQty: 25, countedQty: 0, variance: -25 },
      ],
    };

    it("validates that adjustment is in draft status", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue({
        ...adjustment,
        status: "completed",
      });

      await expect(
        submitCycleCount({
          adjustmentId: "adj-1",
          counts: [{ lineId: "line-1", countedQty: 10 }],
        })
      ).rejects.toThrow(/Cannot submit counts for adjustment in status: completed/);
    });

    it("rejects non-cycle-count adjustment types", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue({
        ...adjustment,
        type: "manual",
        status: "draft",
      });

      await expect(
        submitCycleCount({
          adjustmentId: "adj-1",
          counts: [{ lineId: "line-1", countedQty: 10 }],
        })
      ).rejects.toThrow(/Adjustment is not a cycle count/);
    });

    it("computes variance and updates lines within transaction", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(adjustment);
      mockTxPrisma.adjustmentLine.update.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      const result = await submitCycleCount({
        adjustmentId: "adj-1",
        counts: [
          { lineId: "line-1", countedQty: 8 },
          { lineId: "line-2", countedQty: 30 },
        ],
      });

      expect(result).toEqual({ success: true, adjustmentId: "adj-1" });

      // line-1: counted 8 - system 10 = variance -2
      expect(mockTxPrisma.adjustmentLine.update).toHaveBeenCalledWith({
        where: { id: "line-1" },
        data: { countedQty: 8, variance: -2 },
      });

      // line-2: counted 30 - system 25 = variance +5
      expect(mockTxPrisma.adjustmentLine.update).toHaveBeenCalledWith({
        where: { id: "line-2" },
        data: { countedQty: 30, variance: 5 },
      });

      // Status should transition to pending_approval
      expect(mockTxPrisma.inventoryAdjustment.update).toHaveBeenCalledWith({
        where: { id: "adj-1" },
        data: { status: "pending_approval" },
      });
    });

    it("throws when a lineId is not found", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(adjustment);

      await expect(
        submitCycleCount({
          adjustmentId: "adj-1",
          counts: [{ lineId: "nonexistent", countedQty: 5 }],
        })
      ).rejects.toThrow(/Adjustment line nonexistent not found/);
    });
  });

  // ── approveCycleCount ────────────────────────────────────────────────────

  describe("approveCycleCount", () => {
    const adjustment = {
      id: "adj-1",
      type: "cycle_count",
      status: "pending_approval",
      lines: [
        { id: "line-1", productId: "p1", binId: "bin-A", lotNumber: null,
          serialNumber: null, systemQty: 10, countedQty: 8, variance: -2 },
        { id: "line-2", productId: "p2", binId: "bin-B", lotNumber: "LOT-1",
          serialNumber: null, systemQty: 25, countedQty: 30, variance: 5 },
        { id: "line-3", productId: "p3", binId: "bin-C", lotNumber: null,
          serialNumber: null, systemQty: 15, countedQty: 15, variance: 0 },
      ],
    };

    function setupApproveMocks() {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(adjustment);
      mockTxPrisma.inventory.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.productId === "p1") return { id: "inv-1", onHand: 10, allocated: 2 };
        if (where.productId === "p2") return { id: "inv-2", onHand: 25, allocated: 0 };
        return null;
      });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});
    }

    it("applies variances to inventory (decrements and increments onHand)", async () => {
      setupApproveMocks();
      await approveCycleCount("adj-1");

      // p1: onHand 10 + variance -2 = 8, available = max(0, 8 - 2) = 6
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { onHand: 8, available: 6 },
      });
      // p2: onHand 25 + variance 5 = 30, available = max(0, 30 - 0) = 30
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: "inv-2" },
        data: { onHand: 30, available: 30 },
      });
    });

    it("skips zero-variance lines and writes correct ledger entries", async () => {
      setupApproveMocks();
      await approveCycleCount("adj-1");

      // Only 2 inventory updates (p1 and p2), not p3 (zero variance)
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledTimes(2);
      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledTimes(2);

      // Negative variance -> fromBinId set, toBinId null
      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "count", productId: "p1", fromBinId: "bin-A", toBinId: null,
          quantity: 2, referenceType: "cycle_count", referenceId: "adj-1",
        }),
      });
      // Positive variance -> toBinId set, fromBinId null
      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "count", productId: "p2", fromBinId: null, toBinId: "bin-B",
          quantity: 5, referenceType: "cycle_count", referenceId: "adj-1",
        }),
      });
    });

    it("marks adjustment as completed with approver info", async () => {
      setupApproveMocks();
      await approveCycleCount("adj-1");

      expect(mockTxPrisma.inventoryAdjustment.update).toHaveBeenCalledWith({
        where: { id: "adj-1" },
        data: expect.objectContaining({
          status: "completed", approvedBy: "user-1",
          approvedAt: expect.any(Date), completedAt: expect.any(Date),
        }),
      });
    });

    it("rejects approval when status is not pending_approval", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue({
        ...adjustment, status: "draft",
      });
      await expect(approveCycleCount("adj-1")).rejects.toThrow(
        /Cannot approve adjustment in status: draft/
      );
    });

    it("creates new inventory when positive variance but no existing row", async () => {
      const singleLineAdj = {
        id: "adj-2", type: "cycle_count", status: "pending_approval",
        lines: [{ id: "line-x", productId: "p-new", binId: "bin-X",
          lotNumber: null, serialNumber: "SN-99", systemQty: 0,
          countedQty: 3, variance: 3 }],
      };
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(singleLineAdj);
      mockTxPrisma.inventory.findFirst.mockResolvedValue(null);
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveCycleCount("adj-2");

      expect(mockTxPrisma.inventory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: "p-new", binId: "bin-X", serialNumber: "SN-99",
          onHand: 3, allocated: 0, available: 3,
        }),
      });
    });
  });
});
