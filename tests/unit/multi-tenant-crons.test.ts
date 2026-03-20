/**
 * @jest-environment node
 *
 * Verifies that each cron endpoint correctly iterates ALL active tenants,
 * not just a single hardcoded one. Each test mocks the import chain and
 * confirms the response body includes results for every tenant.
 */

import { NextRequest } from "next/server";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CRON_SECRET = "test-cron-secret";

function makeRequest(): NextRequest {
  const url = "http://localhost/api/cron/test";
  return new NextRequest(url, { headers: { "x-cron-secret": CRON_SECRET } });
}

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv, CRON_SECRET };
});

afterAll(() => {
  process.env = originalEnv;
});

// ── Shared mock DB factories ─────────────────────────────────────────────────

function makeMockTenantDb() {
  return {
    client: {
      findFirst: jest.fn().mockResolvedValue({ id: "c1", code: "CLT", name: "Client A" }),
      findMany: jest.fn().mockResolvedValue([
        { id: "c1", name: "Client A" },
        { id: "c2", name: "Client B" },
      ]),
    },
    salesChannel: {
      findFirst: jest.fn().mockResolvedValue({ id: "ch1", type: "shopify" }),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    billingEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    inventory: {
      count: jest.fn().mockResolvedValue(5),
    },
    shipment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

const mockPublicDb = {
  tenant: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

// ── 1. Shopify sync iterates all tenants ─────────────────────────────────────

describe("shopify-sync cron — multi-tenant iteration", () => {
  it("processes every tenant returned by getShopifyConnectors", async () => {
    const mockDbA = makeMockTenantDb();
    const mockDbB = makeMockTenantDb();

    jest.mock("@/lib/db/public-client", () => ({ publicDb: mockPublicDb }));
    jest.mock("@/lib/db/tenant-client", () => ({
      getTenantDb: jest.fn().mockReturnValue(makeMockTenantDb()),
    }));
    jest.mock("@/lib/integrations/tenant-connectors", () => ({
      getShopifyConnectors: jest.fn().mockResolvedValue([
        {
          tenant: { id: "t1", slug: "tenant-a", dbSchema: "tenant_a" },
          db: mockDbA,
          clientCode: "CLT",
          shopDomain: "tenant-a.myshopify.com",
          accessToken: "tok-a",
          apiVersion: "2024-01",
          locationId: "loc-a",
        },
        {
          tenant: { id: "t2", slug: "tenant-b", dbSchema: "tenant_b" },
          db: mockDbB,
          clientCode: "CLT",
          shopDomain: "tenant-b.myshopify.com",
          accessToken: "tok-b",
          apiVersion: "2024-01",
          locationId: "loc-b",
        },
      ]),
    }));
    jest.mock("@/lib/integrations/marketplaces/shopify", () => ({
      ShopifyAdapter: jest.fn().mockImplementation(() => ({
        fetchOrders: jest.fn().mockResolvedValue([]),
      })),
    }));
    jest.mock("@/lib/sequences", () => ({ nextSequence: jest.fn() }));
    jest.mock("@/lib/audit", () => ({ logAudit: jest.fn() }));
    jest.mock("@/modules/orders/shopify-sync", () => ({
      syncInventoryToShopify: jest.fn().mockResolvedValue({ synced: 0 }),
    }));

    const { GET } = await import("@/app/api/cron/shopify-sync/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tenants).toHaveLength(2);
    expect(body.tenants[0].tenant).toBe("tenant-a");
    expect(body.tenants[1].tenant).toBe("tenant-b");
  });
});

// ── 2. Storage billing iterates all tenants ──────────────────────────────────

describe("storage-billing cron — multi-tenant iteration", () => {
  it("captures billing events for every active tenant", async () => {
    const mockTenantDb = makeMockTenantDb();

    jest.mock("@/lib/db/public-client", () => ({ publicDb: mockPublicDb }));
    jest.mock("@/lib/db/tenant-client", () => ({
      getTenantDb: jest.fn().mockReturnValue(mockTenantDb),
    }));
    jest.mock("@/lib/integrations/tenant-connectors", () => ({
      getActiveTenants: jest.fn().mockResolvedValue([
        { id: "t1", slug: "tenant-a", dbSchema: "tenant_a", settings: {} },
        { id: "t2", slug: "tenant-b", dbSchema: "tenant_b", settings: {} },
      ]),
    }));
    jest.mock("@/modules/billing/capture", () => ({
      captureEvent: jest.fn().mockResolvedValue({ id: "evt-1" }),
    }));

    const { GET } = await import("@/app/api/cron/storage-billing/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tenants).toHaveLength(2);
    expect(body.tenants[0].tenant).toBe("tenant-a");
    expect(body.tenants[1].tenant).toBe("tenant-b");
    // Each tenant should have client results (billing was captured)
    for (const t of body.tenants) {
      expect(t.clients).toBeDefined();
    }
  });
});

// ── 3. Tracking update uses per-tenant carrier credentials ───────────────────

describe("tracking-update cron — per-tenant carrier credentials", () => {
  it("builds carrier adapters from each tenant's credentials", async () => {
    const mockTenantDb = makeMockTenantDb();
    // Return a shipment so the tracking adapter gets called
    mockTenantDb.shipment.findMany.mockResolvedValue([
      { id: "s1", trackingNumber: "1Z999", carrier: "UPS", shipmentNumber: "SHP-001" },
    ]);

    const mockGetTracking = jest.fn().mockResolvedValue({ status: "in_transit" });

    jest.mock("@/lib/db/public-client", () => ({ publicDb: mockPublicDb }));
    jest.mock("@/lib/db/tenant-client", () => ({
      getTenantDb: jest.fn().mockReturnValue(mockTenantDb),
    }));
    jest.mock("@/lib/integrations/tenant-connectors", () => ({
      getActiveTenants: jest.fn().mockResolvedValue([
        { id: "t1", slug: "tenant-a", dbSchema: "tenant_a", settings: {} },
        { id: "t2", slug: "tenant-b", dbSchema: "tenant_b", settings: {} },
      ]),
      getCarrierCredentials: jest.fn()
        .mockReturnValueOnce({ ups: { accountNumber: "UPS-A", apiKey: "key-a" } })
        .mockReturnValueOnce({ ups: { accountNumber: "UPS-B", apiKey: "key-b" } }),
    }));
    jest.mock("@/lib/integrations/carriers", () => ({
      UPSAdapter: jest.fn().mockImplementation(() => ({ getTracking: mockGetTracking })),
      FedExAdapter: jest.fn().mockImplementation(() => ({ getTracking: mockGetTracking })),
      USPSAdapter: jest.fn().mockImplementation(() => ({ getTracking: mockGetTracking })),
    }));

    const { GET } = await import("@/app/api/cron/tracking-update/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tenants).toHaveLength(2);
    expect(body.tenants[0].tenant).toBe("tenant-a");
    expect(body.tenants[1].tenant).toBe("tenant-b");

    // Verify per-tenant carrier credentials were requested
    const { getCarrierCredentials } = await import("@/lib/integrations/tenant-connectors");
    expect(getCarrierCredentials).toHaveBeenCalledTimes(2);
  });
});

// ── 4. NetSuite sync skips tenants without NetSuite configured ───────────────

describe("netsuite-sync cron — skips unconfigured tenants", () => {
  it("only processes tenants that have netsuite settings", async () => {
    const mockTenantDb = makeMockTenantDb();

    jest.mock("@/lib/db/public-client", () => ({ publicDb: mockPublicDb }));
    jest.mock("@/lib/db/tenant-client", () => ({
      getTenantDb: jest.fn().mockReturnValue(mockTenantDb),
    }));
    jest.mock("@/lib/integrations/tenant-connectors", () => ({
      getActiveTenants: jest.fn().mockResolvedValue([
        {
          id: "t1",
          slug: "tenant-a",
          dbSchema: "tenant_a",
          settings: {
            netsuite: {
              accountId: "NS-123",
              consumerKey: "ck-a",
              consumerSecret: "cs-a",
              tokenId: "tid-a",
              tokenSecret: "ts-a",
            },
          },
        },
        {
          id: "t2",
          slug: "tenant-b",
          dbSchema: "tenant_b",
          settings: {},  // No NetSuite configured
        },
      ]),
    }));

    const mockNsClient = {
      pushBillableEvents: jest.fn().mockResolvedValue({ invoiceId: "INV-001" }),
      pushShipmentFulfillment: jest.fn().mockResolvedValue({}),
    };
    jest.mock("@/lib/integrations/netsuite/client", () => ({
      getNetSuiteClient: jest.fn().mockImplementation((settings?: Record<string, string>) => {
        // Return client only when settings are provided (tenant-a)
        if (settings) return mockNsClient;
        return null;
      }),
    }));

    // Make sure ARMSTRONG_TENANT_SLUG does not match tenant-b
    delete process.env.ARMSTRONG_TENANT_SLUG;

    const { GET } = await import("@/app/api/cron/netsuite-sync/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    // Only tenant-a should appear in results (tenant-b was skipped)
    expect(body.tenants).toHaveLength(1);
    expect(body.tenants[0].tenant).toBe("tenant-a");
  });
});
