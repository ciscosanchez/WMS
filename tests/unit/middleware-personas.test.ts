/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from "next/server";

const mockGetToken = jest.fn();
const mockTenantMiddleware = jest.fn(() => NextResponse.next());

jest.mock("next-auth/jwt", () => ({
  getToken: mockGetToken,
}));

jest.mock("@/lib/tenant/middleware", () => ({
  tenantMiddleware: mockTenantMiddleware,
}));

function makeRequest(url: string, host: string) {
  return new NextRequest(url, {
    headers: {
      host,
    },
  });
}

describe("middleware persona routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret";
    process.env.AUTH_URL = "https://wms.ramola.app";
    delete process.env.TENANT_RESOLUTION;
    mockTenantMiddleware.mockReturnValue(NextResponse.next());
  });

  it("redirects superadmins on the base domain to /platform", async () => {
    mockGetToken.mockResolvedValue({
      isSuperadmin: true,
      tenants: [],
    });

    const { middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("https://wms.ramola.app/", "wms.ramola.app"));

    expect(response.headers.get("location")).toBe("https://wms.ramola.app/platform");
  });

  it("redirects unauthenticated base-domain root requests to /login", async () => {
    mockGetToken.mockResolvedValue(null);

    const { middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("https://wms.ramola.app/", "wms.ramola.app"));

    expect(response.headers.get("location")).toBe("https://wms.ramola.app/login");
  });

  it("routes warehouse workers to /my-tasks on tenant root", async () => {
    mockGetToken.mockResolvedValue({
      isSuperadmin: false,
      tenants: [{ slug: "armstrong", role: "warehouse_worker", portalClientId: null }],
    });

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://armstrong.wms.ramola.app/", "armstrong.wms.ramola.app")
    );

    expect(response.headers.get("location")).toBe("https://armstrong.wms.ramola.app/my-tasks");
  });

  it("routes portal-bound users to /portal/inventory from tenant dashboard", async () => {
    mockGetToken.mockResolvedValue({
      isSuperadmin: false,
      tenants: [{ slug: "armstrong", role: "viewer", portalClientId: "client-1" }],
    });

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://armstrong.wms.ramola.app/dashboard", "armstrong.wms.ramola.app")
    );

    expect(response.headers.get("location")).toBe(
      "https://armstrong.wms.ramola.app/portal/inventory"
    );
  });

  it("redirects base-domain tenant users to their first tenant with persona-aware root path", async () => {
    mockGetToken.mockResolvedValue({
      isSuperadmin: false,
      tenants: [{ slug: "armstrong", role: "viewer", portalClientId: "client-1" }],
    });

    const { middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("https://wms.ramola.app/", "wms.ramola.app"));

    expect(response.headers.get("location")).toBe(
      "https://armstrong.wms.ramola.app/portal/inventory"
    );
  });

  it("keeps base-domain tenant redirects local on localhost in dev", async () => {
    mockGetToken.mockResolvedValue({
      isSuperadmin: false,
      tenants: [{ slug: "armstrong", role: "warehouse_worker", portalClientId: null }],
    });

    const { middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("http://localhost:3000/", "localhost:3000"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/my-tasks");
  });
});
