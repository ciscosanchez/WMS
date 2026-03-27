/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

export {};

const mockRequireTenantContext = jest.fn();

const mockInventoryFindMany = jest.fn().mockResolvedValue([]);
const mockOrderFindMany = jest.fn().mockResolvedValue([]);
const mockInvoiceFindMany = jest.fn().mockResolvedValue([]);
const mockAttributeDefinitionFindMany = jest.fn().mockResolvedValue([]);
const mockAttributeValueFindMany = jest.fn().mockResolvedValue([]);

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

describe("portal export scoping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue({
      tenant: {
        tenantId: "tenant-1",
        slug: "armstrong",
        db: {
          inventory: { findMany: mockInventoryFindMany },
          order: { findMany: mockOrderFindMany },
          invoice: { findMany: mockInvoiceFindMany },
          operationalAttributeDefinition: { findMany: mockAttributeDefinitionFindMany },
          operationalAttributeValue: { findMany: mockAttributeValueFindMany },
        },
      },
      portalClientId: "client-1",
    });
  });

  it("scopes inventory exports to the portal client", async () => {
    const { GET } = await import("@/app/api/export/inventory/route");
    const req = new NextRequest("http://localhost/api/export/inventory");

    await GET(req);

    expect(mockRequireTenantContext).toHaveBeenCalledWith("inventory:read");
    expect(mockInventoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          product: { clientId: "client-1" },
        }),
      })
    );
  });

  it("adds inventory operational-attribute headers to exports when definitions exist", async () => {
    mockInventoryFindMany.mockResolvedValueOnce([
      {
        id: "inv-1",
        product: { sku: "SKU-1", name: "Chair" },
        bin: { barcode: "BIN-A" },
        lotNumber: null,
        onHand: 2,
        allocated: 0,
        available: 2,
      },
    ]);
    mockAttributeDefinitionFindMany.mockResolvedValueOnce([
      { id: "def-1", key: "room_reference", label: "Room Reference", sortOrder: 0 },
    ]);
    mockAttributeValueFindMany.mockResolvedValueOnce([
      {
        entityId: "inv-1",
        definitionId: "def-1",
        textValue: "living_room",
        numberValue: null,
        booleanValue: null,
        dateValue: null,
        jsonValue: null,
      },
    ]);

    const { GET } = await import("@/app/api/export/inventory/route");
    const req = new NextRequest("http://localhost/api/export/inventory");

    const response = await GET(req);
    const csv = await response.text();

    expect(csv).toContain("Room Reference");
    expect(csv).toContain("living_room");
  });

  it("scopes order exports to the portal client", async () => {
    const { GET } = await import("@/app/api/export/orders/route");
    const req = new NextRequest("http://localhost/api/export/orders?status=pending");

    await GET(req);

    expect(mockRequireTenantContext).toHaveBeenCalledWith("orders:read");
    expect(mockOrderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: "client-1",
          status: "pending",
        }),
      })
    );
  });

  it("adds aggregated order-line operational attributes to order exports", async () => {
    mockOrderFindMany.mockResolvedValueOnce([
      {
        id: "ord-1",
        orderNumber: "ORD-1",
        client: { name: "Client A" },
        status: "pending",
        shipToName: "Jane",
        shipToCity: "Dallas",
        shipToState: "TX",
        totalItems: 1,
        orderDate: new Date("2026-03-26"),
        shippedDate: null,
        lines: [{ id: "line-1" }],
      },
    ]);
    mockAttributeDefinitionFindMany.mockResolvedValueOnce([
      { id: "def-1", key: "room_reference", label: "Room Reference", sortOrder: 0 },
    ]);
    mockAttributeValueFindMany.mockResolvedValueOnce([
      {
        entityId: "line-1",
        definitionId: "def-1",
        textValue: "living_room",
        numberValue: null,
        booleanValue: null,
        dateValue: null,
        jsonValue: null,
      },
    ]);

    const { GET } = await import("@/app/api/export/orders/route");
    const req = new NextRequest("http://localhost/api/export/orders");

    const response = await GET(req);
    const csv = await response.text();

    expect(csv).toContain("Room Reference");
    expect(csv).toContain("living_room");
  });

  it("scopes billing exports to the portal client", async () => {
    const { GET } = await import("@/app/api/export/billing/route");
    const req = new NextRequest("http://localhost/api/export/billing");

    await GET(req);

    expect(mockRequireTenantContext).toHaveBeenCalledWith("billing:read");
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: "client-1" },
      })
    );
  });
});
