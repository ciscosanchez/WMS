/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

export {};

const mockRequireTenantContext = jest.fn();

const mockInventoryFindMany = jest.fn().mockResolvedValue([]);
const mockOrderFindMany = jest.fn().mockResolvedValue([]);
const mockInvoiceFindMany = jest.fn().mockResolvedValue([]);

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
