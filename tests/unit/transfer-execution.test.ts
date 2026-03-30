/**
 * @jest-environment node
 *
 * Tests for transfer execution actions:
 * shipTransfer, receiveTransfer, completeTransfer
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock DB primitives ───────────────────────────────────────────────────────

const mockTxPrisma = {
  inventory: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  inventoryTransaction: { create: jest.fn() },
  transferOrder: { update: jest.fn() },
  transferOrderLine: { update: jest.fn() },
};

const mockTransaction = jest.fn().mockImplementation(async (cb: any) => cb(mockTxPrisma));

const mockDb = {
  $transaction: mockTransaction,
  transferOrder: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  bin: { findFirst: jest.fn() },
  zone: { upsert: jest.fn() },
  aisle: { upsert: jest.fn() },
  rack: { upsert: jest.fn() },
  shelf: { upsert: jest.fn() },
  billingEvent: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  sequence: { upsert: jest.fn().mockResolvedValue({ value: 1 }) },
};

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockRequireTenantContext = jest.fn();

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

jest.mock("@/lib/auth/rbac", () => ({
  getAccessibleWarehouseIds: jest.fn().mockReturnValue(null),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/config", () => ({
  config: { useMockData: false },
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/workflow/transitions", () => ({
  assertTransition: jest.fn(),
  TRANSFER_ORDER_TRANSITIONS: {
    draft: ["approved", "cancelled"],
    approved: ["in_transit", "cancelled"],
    in_transit: ["received"],
    received: ["completed"],
    completed: [],
    cancelled: [],
  },
}));

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
  shipTransfer,
  receiveTransfer,
  completeTransfer,
} from "@/modules/transfers/execution";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Transfer execution", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── shipTransfer ──────────────────────────────────────────────────────────

  describe("shipTransfer", () => {
    const transfer = {
      id: "xfer-1",
      transferNumber: "TRF-001",
      status: "approved",
      fromWarehouseId: "wh-1",
      toWarehouseId: "wh-2",
      lines: [
        { id: "line-1", productId: "p1", quantity: 10, lotNumber: null },
      ],
    };

    it("decrements source inventory and writes move transaction", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue(transfer);
      mockTxPrisma.inventory.findMany.mockResolvedValue([
        { id: "inv-1", binId: "bin-A", onHand: 20, allocated: 0 },
      ]);
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.transferOrder.update.mockResolvedValue({
        ...transfer,
        status: "in_transit",
      });

      await shipTransfer("xfer-1");

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { onHand: 10, available: 10 },
      });

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "move",
          productId: "p1",
          fromBinId: "bin-A",
          quantity: 10,
          referenceType: "transfer_order",
          referenceId: "xfer-1",
        }),
      });
    });

    it("throws on insufficient inventory", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue(transfer);
      mockTxPrisma.inventory.findMany.mockResolvedValue([
        { id: "inv-1", binId: "bin-A", onHand: 5, allocated: 0 },
      ]);

      await expect(shipTransfer("xfer-1")).rejects.toThrow(
        /Insufficient inventory for product p1/
      );
    });

    it("splits across multiple bins when single bin lacks stock", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue(transfer);
      mockTxPrisma.inventory.findMany.mockResolvedValue([
        { id: "inv-1", binId: "bin-A", onHand: 6, allocated: 0 },
        { id: "inv-2", binId: "bin-B", onHand: 8, allocated: 0 },
      ]);
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.transferOrder.update.mockResolvedValue({});

      await shipTransfer("xfer-1");

      // Should update both bins
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledTimes(2);
      // First bin: 6 available, takes all 6
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { onHand: 0, available: 0 },
      });
      // Second bin: takes remaining 4
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: "inv-2" },
        data: { onHand: 4, available: 4 },
      });
    });

    it("transitions transfer to in_transit", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue(transfer);
      mockTxPrisma.inventory.findMany.mockResolvedValue([
        { id: "inv-1", binId: "bin-A", onHand: 20, allocated: 0 },
      ]);
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.transferOrder.update.mockResolvedValue({});

      await shipTransfer("xfer-1");

      expect(mockTxPrisma.transferOrder.update).toHaveBeenCalledWith({
        where: { id: "xfer-1" },
        data: expect.objectContaining({ status: "in_transit" }),
      });
    });
  });

  // ── receiveTransfer ───────────────────────────────────────────────────────

  describe("receiveTransfer", () => {
    const transfer = {
      id: "xfer-1",
      transferNumber: "TRF-001",
      status: "in_transit",
      fromWarehouseId: "wh-1",
      toWarehouseId: "wh-2",
      lines: [
        { id: "line-1", productId: "p1", quantity: 10, lotNumber: null },
      ],
    };

    it("upserts destination inventory when existing record found", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue(transfer);
      mockDb.bin.findFirst.mockResolvedValue({ id: "recv-bin" });

      mockTxPrisma.inventory.findFirst.mockResolvedValue({
        id: "inv-dest",
        onHand: 5,
        available: 5,
      });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.transferOrderLine.update.mockResolvedValue({});
      mockTxPrisma.transferOrder.update.mockResolvedValue({});

      await receiveTransfer("xfer-1");

      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: "inv-dest" },
        data: { onHand: 15, available: 15 },
      });
    });

    it("creates new inventory when no existing record in dest", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue(transfer);
      mockDb.bin.findFirst.mockResolvedValue({ id: "recv-bin" });

      mockTxPrisma.inventory.findFirst.mockResolvedValue(null);
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.transferOrderLine.update.mockResolvedValue({});
      mockTxPrisma.transferOrder.update.mockResolvedValue({});

      await receiveTransfer("xfer-1");

      expect(mockTxPrisma.inventory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: "p1",
          binId: "recv-bin",
          onHand: 10,
          allocated: 0,
          available: 10,
        }),
      });
    });

    it("writes receive transaction ledger entry", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue(transfer);
      mockDb.bin.findFirst.mockResolvedValue({ id: "recv-bin" });

      mockTxPrisma.inventory.findFirst.mockResolvedValue(null);
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.transferOrderLine.update.mockResolvedValue({});
      mockTxPrisma.transferOrder.update.mockResolvedValue({});

      await receiveTransfer("xfer-1");

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "receive",
          productId: "p1",
          toBinId: "recv-bin",
          quantity: 10,
          referenceType: "transfer_order",
          referenceId: "xfer-1",
        }),
      });
    });
  });

  // ── completeTransfer ──────────────────────────────────────────────────────

  describe("completeTransfer", () => {
    it("completes when all lines fully received", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue({
        id: "xfer-1",
        transferNumber: "TRF-001",
        status: "received",
        fromWarehouseId: "wh-1",
        toWarehouseId: "wh-2",
        lines: [
          { id: "line-1", productId: "p1", quantity: 10, receivedQty: 10 },
        ],
      });
      mockDb.transferOrder.update.mockResolvedValue({});
      mockDb.billingEvent.create.mockResolvedValue({});

      await completeTransfer("xfer-1");

      expect(mockDb.transferOrder.update).toHaveBeenCalledWith({
        where: { id: "xfer-1" },
        data: { status: "completed" },
      });
    });

    it("throws if any line is short-received", async () => {
      mockDb.transferOrder.findUniqueOrThrow.mockResolvedValue({
        id: "xfer-1",
        transferNumber: "TRF-001",
        status: "received",
        fromWarehouseId: "wh-1",
        toWarehouseId: "wh-2",
        lines: [
          { id: "line-1", productId: "p1", quantity: 10, receivedQty: 7 },
          { id: "line-2", productId: "p2", quantity: 5, receivedQty: 5 },
        ],
      });

      await expect(completeTransfer("xfer-1")).rejects.toThrow(
        /not fully received.*expected 10, received 7/
      );

      expect(mockDb.transferOrder.update).not.toHaveBeenCalled();
    });
  });
});
