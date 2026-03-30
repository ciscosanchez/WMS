/**
 * @jest-environment node
 *
 * Integration-style test for the backorder flow:
 * order created -> pick fails (no inventory) -> order backordered ->
 * inventory added -> retry succeeds -> order moves to picking
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
  pickTask: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  operationalAttributeDefinition: { findMany: jest.fn() },
  operationalAttributeValue: { findMany: jest.fn() },
  bin: { findMany: jest.fn().mockResolvedValue([]) },
  order: { update: jest.fn() },
  shipment: { update: jest.fn() },
  inventoryAdjustment: { findUnique: jest.fn(), update: jest.fn() },
};

const mockTransaction = jest.fn().mockImplementation(async (cb: any) => cb(mockTxPrisma));

const mockDb = {
  $transaction: mockTransaction,
  order: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  orderLine: { deleteMany: jest.fn() },
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
  pickTask: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  shipment: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  sequence: { upsert: jest.fn().mockResolvedValue({ value: 1 }) },
};

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockRequireTenantAccess = jest.fn();
const mockRequireTenantContext = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

jest.mock("@/lib/tenant/db-types", () => ({
  asTenantDb: jest.fn().mockImplementation((db: any) => db),
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
  TRANSFER_ORDER_TRANSITIONS: {},
}));

process.env.TENANT_RESOLUTION = "header";

function asAdmin() {
  const session = {
    user: {
      id: "user-1",
      email: "admin@test.com",
      name: "Admin",
      isSuperadmin: false,
      tenants: [{ tenantId: "tenant-1", slug: "test", role: "admin", portalClientId: null }],
    },
    role: "admin",
  };
  mockRequireTenantAccess.mockResolvedValue(session);
  mockRequireTenantContext.mockResolvedValue({
    ...session,
    tenant: { db: mockDb },
  });
}

function resetMocks() {
  jest.clearAllMocks();
  asAdmin();
  mockTransaction.mockImplementation(async (cb: any) => cb(mockTxPrisma));
}

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { updateOrderStatus } from "@/modules/orders/actions";
import { retryBackorderAllocation } from "@/modules/orders/backorder-actions";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Backorder E2E flow", () => {
  beforeEach(() => {
    resetMocks();
  });

  const orderId = "order-1";

  const baseOrder = {
    id: orderId,
    orderNumber: "ORD-0001",
    status: "allocated",
    shipToName: "Customer",
    shipToAddress1: "123 Main St",
    shipToCity: "Dallas",
    shipToState: "TX",
    shipToZip: "75201",
    lines: [
      {
        id: "ol-1",
        productId: "prod-1",
        quantity: 10,
        product: { sku: "SKU-1", name: "Widget", weight: 1 },
      },
    ],
  };

  it("full flow: pick fails -> backordered -> inventory arrives -> retry -> picking", async () => {
    // ── Step 1: Try to move allocated order to picking ──
    // No inventory available, so pick task creation should fail
    mockDb.order.findUniqueOrThrow.mockResolvedValue(baseOrder);
    mockDb.order.update.mockResolvedValue({ ...baseOrder, status: "picking" });

    // Simulate no inventory in any bin
    mockTxPrisma.inventory.findFirst
      .mockResolvedValueOnce(null); // no stock for prod-1

    await expect(updateOrderStatus(orderId, "picking")).rejects.toThrow(
      "No inventory available for any order lines"
    );

    // ── Step 2: Order is moved to backordered status ──
    resetMocks();
    mockDb.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder,
      status: "allocated",
    });
    mockDb.order.update.mockResolvedValue({
      ...baseOrder,
      status: "backordered",
    });

    const backorderResult = await updateOrderStatus(orderId, "backordered");
    expect(backorderResult).toBeDefined();
    expect(mockDb.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "backordered" }),
      })
    );

    // ── Step 3: Inventory arrives (simulated by mocking available stock) ──
    // ── Step 4: Retry backorder allocation ──
    resetMocks();
    mockDb.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder,
      status: "backordered",
      picks: [],
    });

    // Now inventory is available
    mockTxPrisma.inventory.findFirst.mockResolvedValue({
      id: "inv-1",
      binId: "bin-A",
      available: 15,
    });

    mockTxPrisma.inventory.update.mockResolvedValue({});
    mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
    mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });
    mockDb.order.update.mockResolvedValue({
      ...baseOrder,
      status: "picking",
    });

    const retryResult = await retryBackorderAllocation(orderId);

    expect(retryResult.status).toBe("picking");
    expect(retryResult.newlyAllocated).toBe(1);
    expect(retryResult.stillBackordered).toBe(0);

    // Verify inventory was allocated
    expect(mockTxPrisma.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: {
          allocated: { increment: 10 },
          available: { decrement: 10 },
        },
      })
    );

    // Verify pick task was created
    expect(mockTxPrisma.pickTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId,
        method: "single_order",
        status: "pending",
      }),
    });

    // Verify order was moved to picking
    expect(mockDb.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        data: { status: "picking" },
      })
    );
  });

  it("partial flow: retry with partial inventory keeps order backordered", async () => {
    const twoLineOrder = {
      ...baseOrder,
      status: "backordered",
      lines: [
        {
          id: "ol-1",
          productId: "prod-1",
          quantity: 10,
          product: { sku: "SKU-1", name: "Widget", weight: 1 },
        },
        {
          id: "ol-2",
          productId: "prod-2",
          quantity: 5,
          product: { sku: "SKU-2", name: "Gadget", weight: 2 },
        },
      ],
      picks: [],
    };

    mockDb.order.findUniqueOrThrow.mockResolvedValue(twoLineOrder);

    // Only prod-1 has inventory, prod-2 does not
    mockTxPrisma.inventory.findFirst
      .mockResolvedValueOnce({ id: "inv-1", binId: "bin-A", available: 15 })
      .mockResolvedValueOnce(null);

    mockTxPrisma.inventory.update.mockResolvedValue({});
    mockTxPrisma.inventoryTransaction.create.mockResolvedValue({});
    mockTxPrisma.pickTask.create.mockResolvedValue({ id: "pick-1" });
    mockDb.order.update.mockResolvedValue({});

    const result = await retryBackorderAllocation(orderId);

    expect(result.status).toBe("backordered");
    expect(result.newlyAllocated).toBe(1);
    expect(result.stillBackordered).toBe(1);

    // Order stays backordered
    expect(mockDb.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "backordered" },
      })
    );
  });
});
