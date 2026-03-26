/**
 * @jest-environment node
 */

export {};

const mockRequireTenantAccess = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: "tenant-1",
        slug: "armstrong",
        dbSchema: "tenant_armstrong",
        status: "active",
      }),
    },
  },
}));

jest.mock("@/lib/db/tenant-client", () => ({
  getTenantDb: jest.fn().mockReturnValue({}),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: (key: string) => (key === "x-tenant-slug" ? "armstrong" : null),
  }),
}));

describe("requirePortalContext", () => {
  beforeAll(() => {
    process.env.TENANT_RESOLUTION = "header";
  });

  afterAll(() => {
    delete process.env.TENANT_RESOLUTION;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns tenant context when portalClientId is present", async () => {
    mockRequireTenantAccess.mockResolvedValue({
      user: {
        id: "user-1",
        email: "portal@arteriors.com",
        name: "Portal User",
        isSuperadmin: false,
        tenants: [
          {
            tenantId: "tenant-1",
            slug: "armstrong",
            role: "viewer",
            portalClientId: "client-1",
          },
        ],
      },
      role: "viewer",
    });

    const { requirePortalContext } = await import("@/lib/tenant/context");
    await expect(requirePortalContext()).resolves.toMatchObject({
      role: "viewer",
      portalClientId: "client-1",
      tenant: { slug: "armstrong" },
    });
  });

  it("rejects tenant members without a portal binding", async () => {
    mockRequireTenantAccess.mockResolvedValue({
      user: {
        id: "user-1",
        email: "viewer@armstrong.com",
        name: "Viewer User",
        isSuperadmin: false,
        tenants: [
          {
            tenantId: "tenant-1",
            slug: "armstrong",
            role: "viewer",
            portalClientId: null,
          },
        ],
      },
      role: "viewer",
    });

    const { requirePortalContext } = await import("@/lib/tenant/context");
    await expect(requirePortalContext()).rejects.toThrow("Forbidden: portal client binding required");
  });
});
