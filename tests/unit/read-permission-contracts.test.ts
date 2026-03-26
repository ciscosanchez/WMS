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
  salesChannel: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
  client: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  product: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  inventory: { findMany: jest.fn().mockResolvedValue([]) },
  warehouse: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  rateCard: { findFirst: jest.fn().mockResolvedValue(null) },
  invoice: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  receivingDiscrepancy: { findMany: jest.fn().mockResolvedValue([]) },
  inventoryAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
  pickTask: { findMany: jest.fn().mockResolvedValue([]) },
  bin: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  lpn: { findMany: jest.fn().mockResolvedValue([]) },
  transferOrder: { findMany: jest.fn().mockResolvedValue([]) },
  replenishmentRule: { findMany: jest.fn().mockResolvedValue([]) },
  operatorShift: { findMany: jest.fn().mockResolvedValue([]) },
  laborRate: { findMany: jest.fn().mockResolvedValue([]) },
  documentProcessingJob: { findUnique: jest.fn().mockResolvedValue(null) },
};

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

const mockTenantUserUpdate = jest.fn().mockResolvedValue({});

jest.mock("@/lib/config", () => ({
  config: {
    useMockData: false,
  },
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: "tenant-1",
        settings: {},
      }),
    },
    tenantUser: {
      update: (...args: unknown[]) => mockTenantUserUpdate(...args),
    },
  },
}));

jest.mock("@/lib/s3/client", () => ({
  getPresignedDownloadUrl: jest.fn().mockResolvedValue("https://example.com/label.pdf"),
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

  it("requires inventory:read for LPN reads", async () => {
    const { getLpns } = await import("@/modules/lpn/actions");
    await getLpns();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("inventory:read");
  });

  it("requires inventory:read for transfer reads", async () => {
    const { getTransferOrders } = await import("@/modules/transfers/actions");
    await getTransferOrders();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("inventory:read");
  });

  it("requires shipping:read for picking reads", async () => {
    const { getPickTasks } = await import("@/modules/picking/actions");
    await getPickTasks();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("shipping:read");
  });

  it("requires inventory:read for replenishment reads", async () => {
    const { getReplenishmentRules } = await import("@/modules/replenishment/actions");
    await getReplenishmentRules();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("inventory:read");
  });

  it("requires operator:read for labor shift reads", async () => {
    const { getShifts } = await import("@/modules/labor/queries");
    await getShifts();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("operator:read");
  });

  it("requires settings:read for labor rate reads", async () => {
    const { getLaborRates } = await import("@/modules/labor/queries");
    await getLaborRates();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("settings:read");
  });

  it("requires operator:write for operator barcode lookups", async () => {
    const { getBinByBarcode } = await import("@/modules/operator/actions");
    await getBinByBarcode("BIN-001");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("operator:write");
  });

  it("requires receiving:read for docai job reads", async () => {
    const { getProcessingJob } = await import("@/modules/receiving/docai-actions");
    await getProcessingJob("job-1");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("receiving:read");
  });

  it("requires shipping:read for shipment label downloads", async () => {
    const { getLabelDownloadUrl } = await import("@/modules/shipping/ship-actions");
    await getLabelDownloadUrl("shipment-1");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("shipping:read");
  });

  it("requires settings:read for integration status reads", async () => {
    const { getIntegrationStatuses } = await import("@/modules/settings/integration-status");
    await getIntegrationStatuses();
    expect(mockRequireTenantContext).toHaveBeenCalledWith("settings:read");
  });

  it("requires users:write for tenant user role updates", async () => {
    const { updateUserRole } = await import("@/modules/users/actions");
    await updateUserRole("user-1", "manager");
    expect(mockRequireTenantContext).toHaveBeenCalledWith("users:write");
  });
});
