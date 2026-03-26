/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockTxPrisma = {
  inventory: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  operationalAttributeDefinition: { findMany: jest.fn() },
  operationalAttributeValue: { findMany: jest.fn() },
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

const mockTransaction = jest.fn().mockImplementation(async (cb: any) => cb(mockTxPrisma));

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

process.env.TENANT_RESOLUTION = "header";

export function asAdmin() {
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

export function resetInventoryIntegrityMocks() {
  jest.clearAllMocks();
  asAdmin();
  mockTransaction.mockImplementation(async (cb: any) => cb(mockTxPrisma));
}

export { mockDb, mockTxPrisma };

export { moveInventory, approveAdjustment } from "@/modules/inventory/mutations";
export { updateOrderStatus } from "@/modules/orders/actions";
export { markShipmentShipped } from "@/modules/shipping/ship-actions";
