/**
 * @jest-environment node
 *
 * Portal client isolation tests.
 *
 * Verifies that resolvePortalClient (private) correctly isolates data
 * by contactEmail with no fallback, tested through the public functions:
 * getPortalInventory, getPortalOrders, createPortalOrder.
 */

// ── Mock DB ──────────────────────────────────────────────────────────────────

const mockClientFindFirst = jest.fn();
const mockProductFindMany = jest.fn();
const mockInventoryGroupBy = jest.fn().mockResolvedValue([]);
const mockOrderFindMany = jest.fn().mockResolvedValue([]);
const mockOrderCreate = jest.fn();
const mockShipmentFindMany = jest.fn().mockResolvedValue([]);
const mockSalesChannelFindFirst = jest.fn();
const mockSalesChannelCreate = jest.fn();

const mockDb = {
  client: { findFirst: mockClientFindFirst },
  product: { findMany: mockProductFindMany },
  inventory: { groupBy: mockInventoryGroupBy },
  order: { findMany: mockOrderFindMany, create: mockOrderCreate },
  shipment: { findMany: mockShipmentFindMany },
  salesChannel: { findFirst: mockSalesChannelFindFirst, create: mockSalesChannelCreate },
};

// ── Mocks ────────────────────────────────────────────────────────────────────

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

// Use a getter so the mock factory doesn't capture mockDb before initialization
jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: jest.fn().mockImplementation(() =>
    Promise.resolve({
      user: {
        id: "user-1",
        email: "portal@client.com",
        name: "Portal User",
        isSuperadmin: false,
        tenants: [{ tenantId: "tenant-1", slug: "test", role: "viewer" }],
      },
      role: "viewer",
      tenant: {
        tenantId: "tenant-1",
        slug: "test",
        dbSchema: "test_schema",
        get db() {
          // Lazy reference to avoid hoisting issues
          return require("@/lib/db/tenant-client").getTenantDb();
        },
      },
    })
  ),
}));

jest.mock("@/lib/sequences", () => ({
  nextSequence: jest.fn().mockResolvedValue("ORD-0001"),
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  getPortalInventory,
  getPortalOrders,
  createPortalOrder,
} from "@/modules/portal/actions";
import { requireTenantContext } from "@/lib/tenant/context";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CLIENT = { id: "client-1", name: "Acme Corp", contactEmail: "portal@client.com", isActive: true };

function setUserEmail(email: string) {
  (requireTenantContext as jest.Mock).mockImplementation(() =>
    Promise.resolve({
      user: {
        id: "user-1",
        email,
        name: "Portal User",
        isSuperadmin: false,
        tenants: [{ tenantId: "tenant-1", slug: "test", role: "viewer" }],
      },
      role: "viewer",
      tenant: { tenantId: "tenant-1", slug: "test", dbSchema: "test_schema", db: mockDb },
    })
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: user email matches client
  setUserEmail("portal@client.com");
});

describe("Portal client isolation (resolvePortalClient)", () => {
  // ── getPortalInventory ───────────────────────────────────────────────────

  describe("getPortalInventory", () => {
    it("returns [] when user email does not match any client", async () => {
      mockClientFindFirst.mockResolvedValue(null);

      const result = await getPortalInventory();

      expect(result).toEqual([]);
      expect(mockClientFindFirst).toHaveBeenCalledWith({
        where: { contactEmail: "portal@client.com", isActive: true },
      });
      // Should NOT query products or inventory when no client found
      expect(mockProductFindMany).not.toHaveBeenCalled();
      expect(mockInventoryGroupBy).not.toHaveBeenCalled();
    });

    it("returns [] when user email is empty", async () => {
      setUserEmail("");
      mockClientFindFirst.mockResolvedValue(null);

      const result = await getPortalInventory();

      expect(result).toEqual([]);
      // resolvePortalClient short-circuits on empty email — no DB call
      expect(mockClientFindFirst).not.toHaveBeenCalled();
    });

    it("returns inventory data when email matches a client", async () => {
      mockClientFindFirst.mockResolvedValue(CLIENT);
      mockProductFindMany.mockResolvedValue([
        {
          id: "prod-1",
          sku: "SKU-001",
          name: "Widget",
          baseUom: "EA",
          inventory: [{ bin: { code: "A-01" } }],
        },
      ]);
      mockInventoryGroupBy.mockResolvedValue([
        { productId: "prod-1", _sum: { onHand: 50, allocated: 10, available: 40 } },
      ]);

      const result = await getPortalInventory();

      expect(result).toEqual([
        {
          id: "prod-1",
          sku: "SKU-001",
          name: "Widget",
          uom: "EA",
          onHand: 50,
          allocated: 10,
          available: 40,
          location: "A-01",
        },
      ]);
      expect(mockClientFindFirst).toHaveBeenCalledWith({
        where: { contactEmail: "portal@client.com", isActive: true },
      });
    });
  });

  // ── getPortalOrders ──────────────────────────────────────────────────────

  describe("getPortalOrders", () => {
    it("returns [] when user email does not match any client", async () => {
      mockClientFindFirst.mockResolvedValue(null);

      const result = await getPortalOrders();

      expect(result).toEqual([]);
      expect(mockOrderFindMany).not.toHaveBeenCalled();
    });

    it("returns orders when email matches a client", async () => {
      mockClientFindFirst.mockResolvedValue(CLIENT);
      mockOrderFindMany.mockResolvedValue([
        {
          id: "ord-1",
          orderNumber: "ORD-0001",
          status: "shipped",
          shipToName: "John Doe",
          shipToCity: "Dallas",
          shipToState: "TX",
          totalItems: 5,
          orderDate: new Date("2026-03-01"),
          shipByDate: null,
          shipments: [{ trackingNumber: "1Z999", carrier: "UPS" }],
        },
      ]);

      const result = await getPortalOrders();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        orderNumber: "ORD-0001",
        trackingNumber: "1Z999",
        carrier: "UPS",
      });
    });
  });

  // ── createPortalOrder ────────────────────────────────────────────────────

  describe("createPortalOrder", () => {
    const validOrderData = {
      shipToName: "Jane Doe",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      shippingMethod: "ground",
      lineItems: [{ productId: "prod-1", quantity: 2 }],
    };

    it("returns error when user email does not match any client", async () => {
      mockClientFindFirst.mockResolvedValue(null);

      const result = await createPortalOrder(validOrderData);

      expect(result).toEqual({ error: "No client account found" });
      expect(mockOrderCreate).not.toHaveBeenCalled();
    });

    it("returns error when productIds do not belong to the resolved client", async () => {
      mockClientFindFirst.mockResolvedValue(CLIENT);
      // Product lookup returns empty — none of the IDs belong to client
      mockProductFindMany.mockResolvedValue([]);

      const result = await createPortalOrder(validOrderData);

      expect(result).toEqual({ error: "One or more products are not available" });
      expect(mockProductFindMany).toHaveBeenCalledWith({
        where: { id: { in: ["prod-1"] }, clientId: CLIENT.id, isActive: true },
        select: { id: true },
      });
      expect(mockOrderCreate).not.toHaveBeenCalled();
    });

    it("returns error when some productIds belong to a different client", async () => {
      mockClientFindFirst.mockResolvedValue(CLIENT);
      // Only prod-1 is valid; prod-other is not returned
      mockProductFindMany.mockResolvedValue([{ id: "prod-1" }]);

      const data = {
        ...validOrderData,
        lineItems: [
          { productId: "prod-1", quantity: 1 },
          { productId: "prod-other", quantity: 1 },
        ],
      };

      const result = await createPortalOrder(data);

      expect(result).toEqual({ error: "One or more products are not available" });
      expect(mockOrderCreate).not.toHaveBeenCalled();
    });

    it("creates order successfully when all products belong to the client", async () => {
      mockClientFindFirst.mockResolvedValue(CLIENT);
      mockProductFindMany.mockResolvedValue([{ id: "prod-1" }]);
      mockSalesChannelFindFirst.mockResolvedValue({ id: "ch-1", type: "manual" });
      mockOrderCreate.mockResolvedValue({ id: "ord-new", orderNumber: "ORD-0001" });

      const result = await createPortalOrder(validOrderData);

      expect(result).toEqual({ orderNumber: "ORD-0001" });
      expect(mockOrderCreate).toHaveBeenCalledTimes(1);
      expect(mockOrderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientId: CLIENT.id,
            channelId: "ch-1",
            status: "pending",
            shipToName: "Jane Doe",
          }),
        })
      );
    });
  });

  // ── resolvePortalClient query shape ──────────────────────────────────────

  describe("client lookup query shape", () => {
    it("queries with contactEmail and isActive — no fallback to first client", async () => {
      setUserEmail("unknown@other.com");
      mockClientFindFirst.mockResolvedValue(null);

      await getPortalInventory();

      expect(mockClientFindFirst).toHaveBeenCalledTimes(1);
      expect(mockClientFindFirst).toHaveBeenCalledWith({
        where: { contactEmail: "unknown@other.com", isActive: true },
      });
      // Verify there was only ONE call — no second fallback query
      expect(mockClientFindFirst).toHaveBeenCalledTimes(1);
    });

    it("does not call findFirst at all when email is empty string", async () => {
      setUserEmail("");

      await getPortalOrders();

      expect(mockClientFindFirst).not.toHaveBeenCalled();
    });
  });
});
