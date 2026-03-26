/**
 * @jest-environment node
 */

export {};

const mockRequireTenantContext = jest.fn();
const mockUserUpdate = jest.fn().mockResolvedValue({});
const mockCookieSet = jest.fn();
const mockCookieDelete = jest.fn();

const mockTenantDb = {
  workflowRule: { findMany: jest.fn().mockResolvedValue([]) },
  putawayRule: { findMany: jest.fn().mockResolvedValue([]) },
  bin: { findFirst: jest.fn().mockResolvedValue(null) },
  inventory: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  receivingTransaction: { findMany: jest.fn().mockResolvedValue([]) },
  pickTask: { findMany: jest.fn().mockResolvedValue([]) },
  inventoryAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
  order: {
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  shipment: { findMany: jest.fn().mockResolvedValue([]) },
  product: { findMany: jest.fn().mockResolvedValue([]) },
  salesChannel: { findFirst: jest.fn().mockResolvedValue(null) },
  inboundShipment: { findMany: jest.fn().mockResolvedValue([]) },
};

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

jest.mock("@/lib/config", () => ({
  config: {
    useMockData: false,
  },
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    set: (...args: unknown[]) => mockCookieSet(...args),
    delete: (...args: unknown[]) => mockCookieDelete(...args),
  }),
}));

describe("remaining RBAC contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue({
      user: { id: "user-1" },
      tenant: {
        tenantId: "tenant-1",
        slug: "armstrong",
        db: mockTenantDb,
      },
    });
  });

  it("requires settings:read for workflow rule evaluation", async () => {
    const { evaluateRules } = await import("@/modules/workflow-rules/actions");
    await evaluateRules("order.created", {});
    expect(mockRequireTenantContext).toHaveBeenCalledWith("settings:read");
  });

  it("requires inventory:read for putaway suggestions", async () => {
    const { suggestPutawayLocation } = await import("@/modules/inventory/putaway-engine");
    await suggestPutawayLocation("product-1", 1);
    expect(mockRequireTenantContext).toHaveBeenCalledWith("inventory:read");
  });

  it("requires reports:read for dashboard chart data", async () => {
    const { getDashboardChartData } = await import("@/modules/dashboard/actions");
    await getDashboardChartData();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("reports:read");
  });

  it("requires operator:write for the operator task summary", async () => {
    const { getMyTasksSummary } = await import("@/modules/dashboard/operator-actions");
    await getMyTasksSummary();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("operator:write");
  });

  it("requires reports:read for locale updates", async () => {
    const { updateUserLocale } = await import("@/modules/users/actions");
    await updateUserLocale("en");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("reports:read");
  });

  it("requires orders:write for Shopify order imports", async () => {
    const { syncShopifyOrders } = await import("@/modules/orders/shopify-sync");
    await syncShopifyOrders("client-1");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("orders:write");
  });

  it("requires shipping:write for Shopify fulfillment pushes without an injected db", async () => {
    const { pushShopifyFulfillment } = await import("@/modules/orders/shopify-sync");
    await pushShopifyFulfillment("order-1", "TRACK123", "UPS");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("shipping:write");
  });

  it("requires orders:write for Shopify inventory syncs without an injected db", async () => {
    const { syncInventoryToShopify } = await import("@/modules/orders/shopify-sync");
    await syncInventoryToShopify("client-1");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("orders:write");
  });

  it("requires orders:write for Amazon inventory syncs without an injected db", async () => {
    const { syncInventoryToAmazon } = await import("@/modules/orders/shopify-sync");
    await syncInventoryToAmazon("client-1");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("orders:write");
  });
});
