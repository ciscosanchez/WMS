/**
 * @jest-environment node
 *
 * Tests for backorder retry actions:
 * retryBackorderAllocation, checkBackorderFulfillment
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock DB primitives ───────────────────────────────────────────────────────

const mockTxPrisma = {
  inventory: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  inventoryTransaction: { create: jest.fn() },
  pickTask: { create: jest.fn() },
};

const mockTransaction = jest.fn().mockImplementation(async (cb: any) => cb(mockTxPrisma));

const mockDb = {
  $transaction: mockTransaction,
  order: {
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  inventory: {
    findMany: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  sequence: { upsert: jest.fn().mockResolvedValue({ value: 1 }) },
};

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockRequireTenantContext = jest.fn();

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

jest.mock("@/lib/tenant/db-types", () => ({
  asTenantDb: jest.fn().mockImplementation((db: any) => db),
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

jest.mock("@/lib/sequences", () => ({
  nextSequence: jest.fn().mockResolvedValue("PICK-0001"),
}));

jest.mock("@/lib/workflow/transitions", () => ({
  assertTransition: jest.fn(),
  ORDER_TRANSITIONS: {
    pending: ["awaiting_fulfillment", "cancelled"],
    awaiting_fulfillment: ["allocated", "cancelled"],
    allocated: ["picking", "backordered", "cancelled"],
    picking: ["packed", "shipped", "cancelled"],
    backordered: ["picking", "cancelled"],
    packed: ["shipped"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  },
}));

function asAdmin() {
  mockRequireTenantContext.mockResolvedValue({
    user: { id: "user-1", email: "admin@test.com", name: "Admin" },
    tenant: { db: mockDb },
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
  retryBackorderAllocation,
  checkBackorderFulfillment,
} from "@/modules/orders/backorder-actions";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Backorder retry", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── retryBackorderAllocation ──────────────────────────────────────────────

  describe("retryBackorderAllocation", () => {
    const backorderedOrder = {
      id: "order-1",
      orderNumber: "ORD-001",
      status: "backordered",
      lines: [
        { id: "ol-1", productId: "p1", quantity: 5, product: { sku: "SKU-1", name: "Widget" } },
        { id: "ol-2", productId: "p2", quantity: 3, product: { sku: "SKU-2", name: "Gadget" } },
      ],
      picks: [],
    };

    it("allocates when inventory is now available and transitions to picking", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(backorderedOrder);

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 10 })
        .mockResolvedValueOnce({ id: "inv-2", binId: "bin-B", available: 5 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });
      mockDb.order.update.mockResolvedValue({});

      const result = await retryBackorderAllocation("order-1");

      expect(result.status).toBe("picking");
      expect(result.newlyAllocated).toBe(2);
      expect(result.stillBackordered).toBe(0);

      // Verify inventory was allocated for both lines
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: { allocated: { increment: 5 }, available: { decrement: 5 } },
        })
      );
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-2" },
          data: { allocated: { increment: 3 }, available: { decrement: 3 } },
        })
      );

      // Verify pick task created
      expect(mockTxPrisma.pickTask.create).toHaveBeenCalledTimes(1);
    });

    it("stays backordered when still no inventory for any lines", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(backorderedOrder);

      // No inventory found for either product
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(retryBackorderAllocation("order-1")).rejects.toThrow(
        /No inventory available for any backordered lines/
      );
    });

    it("partially allocates: some lines get inventory, others stay backordered", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(backorderedOrder);

      // Only p1 has inventory, p2 does not
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 10 })
        .mockResolvedValueOnce(null);

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });
      mockDb.order.update.mockResolvedValue({});

      const result = await retryBackorderAllocation("order-1");

      expect(result.status).toBe("backordered");
      expect(result.newlyAllocated).toBe(1);
      expect(result.stillBackordered).toBe(1);
    });

    it("throws if order is not in backordered status", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue({
        ...backorderedOrder,
        status: "picking",
      });

      await expect(retryBackorderAllocation("order-1")).rejects.toThrow(
        /not backordered/
      );
    });
  });

  // ── checkBackorderFulfillment ─────────────────────────────────────────────

  describe("checkBackorderFulfillment", () => {
    it("returns canFulfillAll=true when all lines have sufficient inventory", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
        status: "backordered",
        lines: [
          { id: "ol-1", productId: "p1", quantity: 5 },
          { id: "ol-2", productId: "p2", quantity: 3 },
        ],
        picks: [],
      });

      mockDb.inventory.findMany
        .mockResolvedValueOnce([{ available: 10 }])  // p1
        .mockResolvedValueOnce([{ available: 5 }]);   // p2

      const result = await checkBackorderFulfillment("order-1");

      expect(result.canFulfillAll).toBe(true);
      expect(result.canFulfillSome).toBe(true);
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].hasInventory).toBe(true);
      expect(result.lines[1].hasInventory).toBe(true);
    });

    it("returns canFulfillSome=true when only some lines have inventory", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
        status: "backordered",
        lines: [
          { id: "ol-1", productId: "p1", quantity: 5 },
          { id: "ol-2", productId: "p2", quantity: 3 },
        ],
        picks: [],
      });

      mockDb.inventory.findMany
        .mockResolvedValueOnce([{ available: 10 }])  // p1 has enough
        .mockResolvedValueOnce([{ available: 1 }]);   // p2 not enough

      const result = await checkBackorderFulfillment("order-1");

      expect(result.canFulfillAll).toBe(false);
      expect(result.canFulfillSome).toBe(true);
    });

    it("returns canFulfillAll=false, canFulfillSome=false when no inventory", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
        status: "backordered",
        lines: [
          { id: "ol-1", productId: "p1", quantity: 5 },
        ],
        picks: [],
      });

      mockDb.inventory.findMany.mockResolvedValue([]);

      const result = await checkBackorderFulfillment("order-1");

      expect(result.canFulfillAll).toBe(false);
      expect(result.canFulfillSome).toBe(false);
    });

    it("accounts for already-allocated picks in fulfillment check", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
        status: "backordered",
        lines: [
          { id: "ol-1", productId: "p1", quantity: 10 },
        ],
        picks: [
          { id: "pick-1", lines: [{ productId: "p1", quantity: 7 }] },
        ],
      });

      // Only need 3 more (10 - 7 already allocated)
      mockDb.inventory.findMany.mockResolvedValue([{ available: 4 }]);

      const result = await checkBackorderFulfillment("order-1");

      expect(result.canFulfillAll).toBe(true);
    });
  });
});
