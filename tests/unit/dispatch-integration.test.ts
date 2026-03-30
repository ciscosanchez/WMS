/**
 * @jest-environment node
 *
 * Tests for DispatchPro integration:
 * - Queue job creation when order status transitions to "packed"
 * - Job payload correctness (tenantSlug, orderId, address, items)
 * - No job enqueued for non-packed status transitions
 */

// ── Mock DB primitives ───────────────────────────────────────────────────────

const mockDb = {
  order: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  auditLog: { create: jest.fn() },
};

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockRequireTenantContext = jest.fn();

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
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

jest.mock("@/lib/workflow/transitions", () => ({
  assertTransition: jest.fn(),
  ORDER_TRANSITIONS: [],
}));

jest.mock("@/lib/auth/rbac", () => ({
  getAccessibleWarehouseIds: jest.fn().mockReturnValue(null),
}));

const mockQueueAdd = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/jobs/queue", () => ({
  integrationQueue: { add: mockQueueAdd },
  notificationQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));

beforeAll(() => {
  process.env.TENANT_RESOLUTION = "header";
});
afterAll(() => {
  delete process.env.TENANT_RESOLUTION;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function asTenantContext() {
  mockRequireTenantContext.mockResolvedValue({
    user: { id: "user-1", email: "op@test.com", name: "Operator" },
    tenant: {
      db: mockDb,
      tenantId: "tenant-1",
      slug: "test",
    },
    role: "admin",
    warehouseAccess: [],
  });
}

function mockOrderExists(overrides: Record<string, unknown> = {}) {
  const order = {
    id: "order-1",
    orderNumber: "ORD-001",
    status: "picking_complete",
    shipToName: "Jane Doe",
    shipToAddress1: "123 Main St",
    shipToCity: "Denver",
    shipToState: "CO",
    shipToZip: "80202",
    lines: [
      {
        id: "line-1",
        productId: "prod-1",
        quantity: 5,
        product: { sku: "SKU-A", name: "Widget A", weight: 2.5 },
      },
    ],
    ...overrides,
  };
  mockDb.order.findUniqueOrThrow.mockResolvedValue(order);
  mockDb.order.update.mockResolvedValue({ ...order, status: "packed" });
  mockDb.order.updateMany.mockResolvedValue({ count: 1 });
  mockDb.order.findUnique.mockResolvedValue({ ...order, status: "packed" });
  return order;
}

function resetMocks() {
  jest.clearAllMocks();
  asTenantContext();
}

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { updateOrderStatus } from "@/modules/orders/actions";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DispatchPro queue job creation on order packed", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("enqueues a dispatchpro_create job when order transitions to packed", async () => {
    mockOrderExists();

    await updateOrderStatus("order-1", "packed");

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "dispatchpro_create",
      expect.objectContaining({
        type: "dispatchpro_create",
        tenantSlug: "test",
        tenantId: "tenant-1",
        orderId: "order-1",
        orderNumber: "ORD-001",
      })
    );
  });

  it("includes shipping address in the job payload", async () => {
    mockOrderExists();

    await updateOrderStatus("order-1", "packed");

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "dispatchpro_create",
      expect.objectContaining({
        customer: "Jane Doe",
        address: "123 Main St",
        city: "Denver",
        state: "CO",
        zip: "80202",
      })
    );
  });

  it("includes order line items in the job payload", async () => {
    mockOrderExists();

    await updateOrderStatus("order-1", "packed");

    const payload = mockQueueAdd.mock.calls[0][1];
    expect(payload.items).toEqual([
      {
        sku: "SKU-A",
        description: "Widget A",
        quantity: 5,
        weight: 2.5,
      },
    ]);
  });

  it("does NOT enqueue a job for non-packed status transitions", async () => {
    mockOrderExists({ status: "pending" });

    await updateOrderStatus("order-1", "released");

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("does not fail the status update if queue enqueue fails", async () => {
    mockOrderExists();
    mockQueueAdd.mockRejectedValueOnce(new Error("Queue unavailable"));

    // Should not throw — the error is caught and logged
    const result = await updateOrderStatus("order-1", "packed");
    expect(result).toBeDefined();
  });
});
