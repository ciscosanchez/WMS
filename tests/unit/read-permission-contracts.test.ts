/**
 * @jest-environment node
 */

export {};

const mockRequireTenantContext = jest.fn();

const mockTenantDb = {
  inboundShipment: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  receivingTransaction: { findMany: jest.fn().mockResolvedValue([]) },
  shipment: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  order: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  salesChannel: { findMany: jest.fn().mockResolvedValue([]) },
  client: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  product: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  inventory: { findMany: jest.fn().mockResolvedValue([]) },
  warehouse: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  rateCard: { findFirst: jest.fn().mockResolvedValue(null) },
  invoice: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  receivingDiscrepancy: { findMany: jest.fn().mockResolvedValue([]) },
  inventoryAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
  pickTask: { findMany: jest.fn().mockResolvedValue([]) },
  bin: { findMany: jest.fn().mockResolvedValue([]) },
};

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

jest.mock("@/lib/config", () => ({
  config: {
    useMockData: false,
  },
}));

describe("read permission contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue({
      tenant: {
        tenantId: "tenant-1",
        slug: "armstrong",
        db: mockTenantDb,
      },
    });
  });

  it("requires reports:read for analytics getters", async () => {
    const { getThroughputTrend } = await import("@/modules/analytics/actions");
    await getThroughputTrend(7);
    expect(mockRequireTenantContext).toHaveBeenCalledWith("reports:read");
  });

  it("requires billing:read for billing reads", async () => {
    const { getRateCard } = await import("@/modules/billing/actions");
    await getRateCard(null);
    expect(mockRequireTenantContext).toHaveBeenCalledWith("billing:read");
  });

  it("requires orders:read for channels", async () => {
    const { getChannels } = await import("@/modules/channels/actions");
    await getChannels();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("orders:read");
  });

  it("requires clients:read for client reads", async () => {
    const { getClients } = await import("@/modules/clients/actions");
    await getClients();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("clients:read");
  });

  it("requires inventory:read for inventory reads", async () => {
    const { getInventory } = await import("@/modules/inventory/actions");
    await getInventory();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("inventory:read");
  });

  it("requires orders:read for order reads", async () => {
    const { getOrders } = await import("@/modules/orders/actions");
    await getOrders();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("orders:read");
  });

  it("requires products:read for product reads", async () => {
    const { getProducts } = await import("@/modules/products/actions");
    await getProducts();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("products:read");
  });

  it("requires receiving:read for receiving reads", async () => {
    const { getShipments } = await import("@/modules/receiving/actions");
    await getShipments();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("receiving:read");
  });

  it("requires shipping:read for shipping reads", async () => {
    const { getShipments } = await import("@/modules/shipping/actions");
    await getShipments();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("shipping:read");
  });

  it("requires warehouse:read for warehouse reads", async () => {
    const { getWarehouses } = await import("@/modules/warehouse/actions");
    await getWarehouses();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("warehouse:read");
  });
});
