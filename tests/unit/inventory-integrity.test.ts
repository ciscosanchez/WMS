/**
 * @jest-environment node
 *
 * Tests for transactional inventory integrity:
 * - moveInventory: atomic deduct/credit with in-tx re-validation
 * - approveAdjustment: atomic per-line apply + status flip
 * - generatePickTasksForOrder (via updateOrderStatus): atomic allocation
 * - markShipmentShipped: atomic onHand decrement + deallocation + ledger
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
  inventoryAdjustment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  pickTask: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  bin: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  order: { update: jest.fn() },
  shipment: { update: jest.fn() },
};

const mockTransaction = jest.fn().mockImplementation(async (cb: any) => {
  return cb(mockTxPrisma);
});

const mockDb = {
  $transaction: mockTransaction,
  inventory: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  inventoryTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  inventoryAdjustment: {
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  orderLine: { deleteMany: jest.fn() },
  shipment: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  pickTask: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  sequence: {
    upsert: jest.fn().mockResolvedValue({ value: 1 }),
  },
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

// Ensure getTenantFromHeaders reads x-tenant-slug header
beforeAll(() => { process.env.TENANT_RESOLUTION = "header"; });
afterAll(() => { delete process.env.TENANT_RESOLUTION; });

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

jest.mock("@/lib/integrations/dispatchpro/client", () => ({
  createDispatchOrder: jest.fn().mockResolvedValue({ id: "disp-1" }),
}));

jest.mock("@/modules/orders/shopify-sync", () => ({
  pushShopifyFulfillment: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/jobs/queue", () => ({
  notificationQueue: { add: jest.fn().mockResolvedValue(undefined) },
  integrationQueue: { add: jest.fn().mockResolvedValue(undefined) },
  emailQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  // Restore default $transaction implementation after clearAllMocks
  mockTransaction.mockImplementation(async (cb: any) => cb(mockTxPrisma));
}

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { moveInventory, approveAdjustment } from "@/modules/inventory/actions";
import { updateOrderStatus } from "@/modules/orders/actions";
import { markShipmentShipped } from "@/modules/shipping/actions";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Transactional inventory integrity", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // moveInventory
  // ────────────────────────────────────────────────────────────────────────────

  describe("moveInventory", () => {
    const moveData = {
      productId: "prod-1",
      fromBinId: "bin-A",
      toBinId: "bin-B",
      quantity: 10,
    };

    it("uses $transaction for the entire move", async () => {
      // Pre-tx lookup finds source
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 50,
        allocated: 0,
        available: 50,
      });

      // Inside tx: re-check finds locked row
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", available: 50 }) // locked source
        .mockResolvedValueOnce({ id: "inv-2" }); // dest exists

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });

      await moveInventory(moveData);

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it("decrements source and increments destination inside tx", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 50,
        allocated: 0,
        available: 50,
      });

      // locked source
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", available: 50 })
        .mockResolvedValueOnce({ id: "inv-2" }); // dest exists

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });

      await moveInventory(moveData);

      // Source decrement
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: {
            onHand: { decrement: 10 },
            available: { decrement: 10 },
          },
        })
      );

      // Dest increment
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-2" },
          data: {
            onHand: { increment: 10 },
            available: { increment: 10 },
          },
        })
      );
    });

    it("creates destination inventory when bin is empty", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 20,
        allocated: 0,
        available: 20,
      });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", available: 20 }) // locked source
        .mockResolvedValueOnce(null); // no dest inventory

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventory.create.mockResolvedValue({ id: "inv-new" });
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });

      await moveInventory(moveData);

      expect(mockTxPrisma.inventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-1",
            binId: "bin-B",
            onHand: 10,
            allocated: 0,
            available: 10,
          }),
        })
      );
    });

    it("writes a ledger entry inside tx", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 50,
        allocated: 0,
        available: 50,
      });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", available: 50 })
        .mockResolvedValueOnce(null);

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });

      await moveInventory(moveData);

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "move",
            productId: "prod-1",
            fromBinId: "bin-A",
            toBinId: "bin-B",
            quantity: 10,
            performedBy: "user-1",
          }),
        })
      );
    });

    it("throws when source has insufficient available stock (pre-tx check)", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 5,
        allocated: 0,
        available: 5,
      });

      await expect(moveInventory(moveData)).rejects.toThrow(
        "Insufficient available inventory"
      );

      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("throws when source not found at all", async () => {
      mockDb.inventory.findFirst.mockResolvedValue(null);

      await expect(moveInventory(moveData)).rejects.toThrow(
        "Insufficient available inventory"
      );

      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("throws on concurrent modification (in-tx re-validation)", async () => {
      mockDb.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        productId: "prod-1",
        binId: "bin-A",
        onHand: 50,
        allocated: 0,
        available: 50,
      });

      // Inside tx: re-check fails (another session decremented between pre-check and tx)
      mockTxPrisma.inventory.findFirst.mockResolvedValueOnce(null);

      await expect(moveInventory(moveData)).rejects.toThrow(
        "Insufficient available inventory (concurrent modification)"
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // approveAdjustment
  // ────────────────────────────────────────────────────────────────────────────

  describe("approveAdjustment", () => {
    const adjustmentId = "adj-1";

    const mockAdjustment = {
      id: adjustmentId,
      status: "pending_approval",
      reason: "Cycle count variance",
      lines: [
        {
          id: "line-1",
          productId: "prod-1",
          binId: "bin-A",
          lotNumber: null,
          serialNumber: null,
          systemQty: 100,
          countedQty: 95,
          variance: -5,
        },
        {
          id: "line-2",
          productId: "prod-2",
          binId: "bin-B",
          lotNumber: "LOT-42",
          serialNumber: null,
          systemQty: 0,
          countedQty: 10,
          variance: 10,
        },
      ],
    };

    it("uses $transaction for the entire approval", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "pending_approval" });
      mockTxPrisma.inventory.findFirst.mockResolvedValue({
        id: "inv-1",
        allocated: 5,
      });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveAdjustment(adjustmentId);

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it("applies correct onHand = countedQty and available = countedQty - allocated", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "pending_approval" });

      // Line 1: existing inventory with allocation
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", allocated: 5 })
        .mockResolvedValueOnce(null); // Line 2: no existing record

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveAdjustment(adjustmentId);

      // Line 1: update existing — onHand=95, available=95-5=90
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: { onHand: 95, available: 90 },
        })
      );

      // Line 2: create new — countedQty=10
      expect(mockTxPrisma.inventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-2",
            binId: "bin-B",
            onHand: 10,
            allocated: 0,
            available: 10,
          }),
        })
      );
    });

    it("marks adjustment as completed atomically inside the tx", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "pending_approval" });
      mockTxPrisma.inventory.findFirst.mockResolvedValue({ id: "inv-1", allocated: 0 });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveAdjustment(adjustmentId);

      expect(mockTxPrisma.inventoryAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adjustmentId },
          data: expect.objectContaining({
            status: "completed",
            approvedBy: "user-1",
          }),
        })
      );
    });

    it("writes a ledger entry for each adjustment line", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "pending_approval" });
      mockTxPrisma.inventory.findFirst.mockResolvedValue({ id: "inv-1", allocated: 0 });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventory.create.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.inventoryAdjustment.update.mockResolvedValue({});

      await approveAdjustment(adjustmentId);

      // One ledger entry per line
      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledTimes(2);

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "adjust",
            productId: "prod-1",
            quantity: -5,
            referenceType: "adjustment",
            referenceId: adjustmentId,
          }),
        })
      );

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "adjust",
            productId: "prod-2",
            quantity: 10,
            referenceType: "adjustment",
            referenceId: adjustmentId,
          }),
        })
      );
    });

    it("is idempotent — skips if adjustment already completed", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue({
        ...mockAdjustment,
        status: "completed",
      });

      await approveAdjustment(adjustmentId);

      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("is idempotent inside tx — skips if status flipped concurrently", async () => {
      mockDb.inventoryAdjustment.findUniqueOrThrow.mockResolvedValue(mockAdjustment);
      // Inside tx: concurrent approval already completed it
      mockTxPrisma.inventoryAdjustment.findUnique.mockResolvedValue({ status: "completed" });

      await approveAdjustment(adjustmentId);

      // tx was called, but no inventory updates occurred
      expect(mockTxPrisma.inventory.update).not.toHaveBeenCalled();
      expect(mockTxPrisma.inventory.create).not.toHaveBeenCalled();
      expect(mockTxPrisma.inventoryAdjustment.update).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // generatePickTasksForOrder (via updateOrderStatus → "picking")
  // ────────────────────────────────────────────────────────────────────────────

  describe("generatePickTasksForOrder (via updateOrderStatus to picking)", () => {
    const orderId = "order-1";
    const existingOrder = {
      id: orderId,
      status: "allocated",
      orderNumber: "ORD-0001",
      shipToName: "Customer",
      shipToAddress1: "123 Main",
      shipToCity: "Dallas",
      shipToState: "TX",
      shipToZip: "75201",
      lines: [
        { id: "ol-1", productId: "prod-1", quantity: 5, product: { sku: "SKU-1", name: "Widget", weight: 1 } },
        { id: "ol-2", productId: "prod-2", quantity: 3, product: { sku: "SKU-2", name: "Gadget", weight: 2 } },
      ],
    };

    it("uses $transaction for inventory allocation", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(existingOrder);
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      // Inside tx: find bins with stock
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 20 })
        .mockResolvedValueOnce({ id: "inv-2", binId: "bin-B", available: 10 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      await updateOrderStatus(orderId, "picking");

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it("increments allocated and decrements available for each line", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(existingOrder);
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 20 })
        .mockResolvedValueOnce({ id: "inv-2", binId: "bin-B", available: 10 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      await updateOrderStatus(orderId, "picking");

      // Line 1: allocate 5
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: {
            allocated: { increment: 5 },
            available: { decrement: 5 },
          },
        })
      );

      // Line 2: allocate 3
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-2" },
          data: {
            allocated: { increment: 3 },
            available: { decrement: 3 },
          },
        })
      );
    });

    it("writes allocation ledger entries for each line", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(existingOrder);
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 20 })
        .mockResolvedValueOnce({ id: "inv-2", binId: "bin-B", available: 10 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      await updateOrderStatus(orderId, "picking");

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "allocate",
            productId: "prod-1",
            fromBinId: "bin-A",
            quantity: 5,
            referenceType: "order",
            referenceId: orderId,
          }),
        })
      );

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "allocate",
            productId: "prod-2",
            fromBinId: "bin-B",
            quantity: 3,
            referenceType: "order",
            referenceId: orderId,
          }),
        })
      );
    });

    it("skips allocation when no bin has enough stock (no crash)", async () => {
      mockDb.order.findUniqueOrThrow.mockResolvedValue(existingOrder);
      mockDb.order.update.mockResolvedValue({ ...existingOrder, status: "picking" });

      // No inventory found for either line
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });

      // Should not throw — pick task is created with null binIds
      await updateOrderStatus(orderId, "picking");

      expect(mockTxPrisma.pickTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId,
            status: "pending",
            lines: {
              create: expect.arrayContaining([
                expect.objectContaining({ productId: "prod-1", binId: null, quantity: 5 }),
                expect.objectContaining({ productId: "prod-2", binId: null, quantity: 3 }),
              ]),
            },
          }),
        })
      );

      // No inventory updates when stock not found
      expect(mockTxPrisma.inventory.update).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // markShipmentShipped
  // ────────────────────────────────────────────────────────────────────────────

  describe("markShipmentShipped", () => {
    const shipmentId = "ship-1";

    const mockShipment = {
      id: shipmentId,
      orderId: "order-1",
      shipmentNumber: "SHP-0001",
      status: "pending",
      order: { id: "order-1", externalId: null },
      items: [
        { id: "si-1", productId: "prod-1", quantity: 5, lotNumber: null, serialNumber: null },
        { id: "si-2", productId: "prod-2", quantity: 3, lotNumber: "LOT-1", serialNumber: null },
      ],
    };

    it("uses $transaction for the entire ship operation", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});
      mockTxPrisma.pickTask.findFirst.mockResolvedValue({
        lines: [
          { productId: "prod-1", binId: "bin-A" },
          { productId: "prod-2", binId: "bin-B" },
        ],
      });
      // Pre-flight check + decrement phase = 4 calls
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 })
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 });
      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});

      await markShipmentShipped(shipmentId, "1Z999AA10123456784", "UPS");

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it("decrements onHand and deallocates for each shipped item", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});

      // Pick task queried once at the top of the transaction
      const pickTask = {
        lines: [
          { productId: "prod-1", binId: "bin-A" },
          { productId: "prod-2", binId: "bin-B" },
        ],
      };
      mockTxPrisma.pickTask.findFirst.mockResolvedValue(pickTask);

      // Pre-flight stock check (2 items) + decrement phase (2 items) = 4 calls
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 })
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});

      await markShipmentShipped(shipmentId, "1Z999", "UPS");

      // Item 1: onHand 20 -> decr 5, allocated 5 -> decr 5, available = 15 - (5-5) = 15
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: {
            onHand: { decrement: 5 },
            allocated: { decrement: 5 },
            available: 15,
          },
        })
      );

      // Item 2: onHand 10 -> decr 3, allocated 3 -> decr 3, available = 7 - (3-3) = 7
      expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-2" },
          data: {
            onHand: { decrement: 3 },
            allocated: { decrement: 3 },
            available: 7,
          },
        })
      );
    });

    it("writes deallocate ledger entries for each item", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});

      const pickTask = {
        lines: [
          { productId: "prod-1", binId: "bin-A" },
          { productId: "prod-2", binId: "bin-B" },
        ],
      };
      mockTxPrisma.pickTask.findFirst.mockResolvedValue(pickTask);

      // Pre-flight stock check (2 items) + decrement phase (2 items) = 4 calls
      mockTxPrisma.inventory.findFirst
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 })
        .mockResolvedValueOnce({ id: "inv-1", onHand: 20, allocated: 5, available: 15 })
        .mockResolvedValueOnce({ id: "inv-2", onHand: 10, allocated: 3, available: 7 });

      mockTxPrisma.inventory.update.mockResolvedValue({});
      mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});

      await markShipmentShipped(shipmentId, "1Z999", "UPS");

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "deallocate",
            productId: "prod-1",
            fromBinId: "bin-A",
            quantity: 5,
            referenceType: "shipment",
            referenceId: shipmentId,
          }),
        })
      );

      expect(mockTxPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "deallocate",
            productId: "prod-2",
            fromBinId: "bin-B",
            quantity: 3,
            lotNumber: "LOT-1",
            referenceType: "shipment",
            referenceId: shipmentId,
          }),
        })
      );
    });

    it("updates shipment status to shipped inside tx", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});
      mockTxPrisma.pickTask.findFirst.mockResolvedValue({ lines: [] });

      await markShipmentShipped(shipmentId, "TRACK-123", "FedEx");

      expect(mockTxPrisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: shipmentId },
          data: expect.objectContaining({
            trackingNumber: "TRACK-123",
            carrier: "FedEx",
            status: "shipped",
          }),
        })
      );
    });

    it("updates order status to shipped inside tx", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(mockShipment);

      mockTxPrisma.shipment.update.mockResolvedValue({});
      mockTxPrisma.order.update.mockResolvedValue({});
      mockTxPrisma.pickTask.findFirst.mockResolvedValue({ lines: [] });

      await markShipmentShipped(shipmentId, "TRACK-123", "FedEx");

      expect(mockTxPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "order-1" },
          data: expect.objectContaining({
            status: "shipped",
          }),
        })
      );
    });

    it("rejects shipment when stock is insufficient (prevents negative inventory)", async () => {
      // Scenario: onHand is less than shipped quantity due to prior adjustment
      const lowStockShipment = {
        ...mockShipment,
        items: [
          { id: "si-1", productId: "prod-1", quantity: 10, lotNumber: null, serialNumber: null },
        ],
      };
      mockDb.shipment.findUnique.mockResolvedValue(lowStockShipment);

      mockTxPrisma.pickTask.findFirst.mockResolvedValue({
        lines: [{ productId: "prod-1", binId: "bin-A" }],
      });

      // Only 3 onHand — shipping 10 should be rejected
      mockTxPrisma.inventory.findFirst.mockResolvedValueOnce({
        id: "inv-1",
        onHand: 3,
        allocated: 2,
        available: 1,
      });

      const result = await markShipmentShipped(shipmentId, "TRACK-X", "USPS");

      expect(result).toEqual({
        error: expect.stringContaining("Insufficient stock"),
      });

      // Shipment and order should NOT be updated
      expect(mockTxPrisma.shipment.update).not.toHaveBeenCalled();
      expect(mockTxPrisma.order.update).not.toHaveBeenCalled();
    });

    it("returns error object when shipment not found (no throw)", async () => {
      mockDb.shipment.findUnique.mockResolvedValue(null);

      const result = await markShipmentShipped("nonexistent", "TRK", "UPS");

      expect(result).toEqual({ error: "Shipment not found" });
    });
  });
});
