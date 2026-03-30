/**
 * @jest-environment node
 *
 * Tests for the storage-billing cron endpoint:
 * - Per-client idempotency (skip already-captured clients)
 * - Skipping zero-inventory clients
 * - Multi-tenant iteration
 */

import { NextRequest } from "next/server";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CRON_SECRET = "test-cron-secret";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/cron/storage-billing", {
    headers: { "x-cron-secret": CRON_SECRET },
  });
}

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv, CRON_SECRET };
});

afterAll(() => {
  process.env = originalEnv;
});

// ── Mock DB factories ────────────────────────────────────────────────────────

function makeMockTenantDb(
  overrides: {
    clients?: Array<{ id: string; name: string }>;
    inventoryCountByClient?: Record<string, number>;
    alreadyCapturedClients?: string[];
  } = {}
) {
  const {
    clients = [
      { id: "c1", name: "Client A" },
      { id: "c2", name: "Client B" },
    ],
    inventoryCountByClient = { c1: 10, c2: 0 },
    alreadyCapturedClients = [],
  } = overrides;

  return {
    client: {
      findMany: jest.fn().mockResolvedValue(clients),
    },
    inventory: {
      count: jest
        .fn()
        .mockImplementation(({ where }: { where: { product: { clientId: string } } }) => {
          const clientId = where?.product?.clientId;
          return Promise.resolve(inventoryCountByClient[clientId] ?? 0);
        }),
    },
    billingEvent: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { clientId: string } }) => {
        const clientId = where?.clientId;
        if (alreadyCapturedClients.includes(clientId)) {
          return Promise.resolve({ id: "existing-evt" });
        }
        return Promise.resolve(null);
      }),
    },
  };
}

const mockPublicDb = {
  tenant: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("storage-billing cron — per-client idempotency", () => {
  it("skips clients that already have a billing event for today", async () => {
    const mockDb = makeMockTenantDb({
      clients: [{ id: "c1", name: "Client A" }],
      inventoryCountByClient: { c1: 5 },
      alreadyCapturedClients: ["c1"],
    });

    const mockCaptureEvent = jest.fn().mockResolvedValue({ id: "evt-1" });

    jest.mock("@/lib/db/public-client", () => ({ publicDb: mockPublicDb }));
    jest.mock("@/lib/db/tenant-client", () => ({
      getTenantDb: jest.fn().mockReturnValue(mockDb),
    }));
    jest.mock("@/lib/integrations/tenant-connectors", () => ({
      getActiveTenants: jest
        .fn()
        .mockResolvedValue([{ id: "t1", slug: "tenant-a", dbSchema: "tenant_a", settings: {} }]),
    }));
    jest.mock("@/modules/billing/capture", () => ({
      captureEvent: mockCaptureEvent,
    }));

    const { GET } = await import("@/app/api/cron/storage-billing/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    // captureEvent should NOT have been called since the client was already captured
    expect(mockCaptureEvent).not.toHaveBeenCalled();
    // The client should still appear in the results but marked as captured
    expect(body.tenants[0].clients[0].captured).toBe(true);
  });
});

describe("storage-billing cron — zero-inventory clients", () => {
  it("skips clients with zero occupied bins", async () => {
    const mockDb = makeMockTenantDb({
      clients: [
        { id: "c1", name: "Client A" },
        { id: "c2", name: "Client B" },
      ],
      inventoryCountByClient: { c1: 8, c2: 0 },
    });

    const mockCaptureEvent = jest.fn().mockResolvedValue({ id: "evt-1" });

    jest.mock("@/lib/db/public-client", () => ({ publicDb: mockPublicDb }));
    jest.mock("@/lib/db/tenant-client", () => ({
      getTenantDb: jest.fn().mockReturnValue(mockDb),
    }));
    jest.mock("@/lib/integrations/tenant-connectors", () => ({
      getActiveTenants: jest
        .fn()
        .mockResolvedValue([{ id: "t1", slug: "tenant-a", dbSchema: "tenant_a", settings: {} }]),
    }));
    jest.mock("@/modules/billing/capture", () => ({
      captureEvent: mockCaptureEvent,
    }));

    const { GET } = await import("@/app/api/cron/storage-billing/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    // captureEvent only called for Client A (c1 has inventory)
    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        clientId: "c1",
        serviceType: "storage_pallet",
        qty: 8,
      })
    );

    // Client B shows 0 pallets, not captured
    const clientB = body.tenants[0].clients.find((c: { clientId: string }) => c.clientId === "c2");
    expect(clientB.pallets).toBe(0);
    expect(clientB.captured).toBe(false);
  });
});

describe("storage-billing cron — multiple tenants", () => {
  it("processes all active tenants and returns per-tenant results", async () => {
    const mockDbA = makeMockTenantDb({
      clients: [{ id: "c1", name: "Client A" }],
      inventoryCountByClient: { c1: 3 },
    });
    const mockDbB = makeMockTenantDb({
      clients: [{ id: "c2", name: "Client B" }],
      inventoryCountByClient: { c2: 7 },
    });

    let callIdx = 0;
    jest.mock("@/lib/db/public-client", () => ({ publicDb: mockPublicDb }));
    jest.mock("@/lib/db/tenant-client", () => ({
      getTenantDb: jest.fn().mockImplementation(() => {
        callIdx++;
        return callIdx === 1 ? mockDbA : mockDbB;
      }),
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
  });
});
