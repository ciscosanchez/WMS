/**
 * @jest-environment node
 */

export {};

const mockTenantFindUnique = jest.fn();
const mockGetTenantFromHeaders = jest.fn();

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: {
      findUnique: (...args: unknown[]) => mockTenantFindUnique(...args),
    },
  },
}));

jest.mock("@/lib/tenant/context", () => ({
  getTenantFromHeaders: (...args: unknown[]) => mockGetTenantFromHeaders(...args),
}));

describe("tenant auth config helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("normalizes mixed provider config and filters blank disabled placeholders", async () => {
    const { normalizeTenantAuthConfig } = await import("@/lib/auth/tenant-auth");

    const config = normalizeTenantAuthConfig({
      auth: {
        mode: "hybrid",
        ssoProviders: [
          {
            label: " Microsoft Entra ",
            type: "microsoft",
            enabled: true,
            domains: "ACME.COM, subsidiary.acme.com ",
          },
          {
            label: "Warehouse OIDC",
            type: "oidc",
            startUrl: " https://login.example.com/start ",
            enabled: true,
          },
          {
            enabled: false,
            label: "",
            startUrl: "",
          },
        ],
      },
    });

    expect(config).toEqual({
      mode: "hybrid",
      ssoProviders: [
        {
          id: "microsoft-entra",
          label: "Microsoft Entra",
          type: "microsoft",
          startUrl: "",
          enabled: true,
          domains: ["acme.com", "subsidiary.acme.com"],
        },
        {
          id: "warehouse-oidc",
          label: "Warehouse OIDC",
          type: "oidc",
          startUrl: "https://login.example.com/start",
          enabled: true,
          domains: [],
        },
      ],
    });
  });

  it("builds SSO start routes only for ready providers", async () => {
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "client-id";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "client-secret";
    const { buildTenantSsoOptions } = await import("@/lib/auth/tenant-auth");

    const options = buildTenantSsoOptions(
      {
        mode: "hybrid",
        ssoProviders: [
          {
            id: "entra",
            label: "Microsoft Entra ID",
            type: "microsoft",
            startUrl: "",
            enabled: true,
            domains: [],
          },
          {
            id: "oidc-disabled",
            label: "Warehouse OIDC",
            type: "oidc",
            startUrl: "",
            enabled: true,
            domains: [],
          },
        ],
      },
      "armstrong",
      "/orders"
    );

    expect(options).toEqual([
      {
        id: "entra",
        label: "Microsoft Entra ID",
        type: "microsoft",
        startUrl: "/api/auth/sso/start?tenantSlug=armstrong&providerId=entra&callbackUrl=%2Forders",
      },
    ]);
  });

  it("returns the default config for inactive tenants", async () => {
    mockTenantFindUnique.mockResolvedValue({
      status: "suspended",
      settings: {
        auth: {
          mode: "sso_only",
        },
      },
    });

    const { getTenantAuthConfigForSlug } = await import("@/lib/auth/tenant-auth");
    await expect(getTenantAuthConfigForSlug("armstrong")).resolves.toEqual({
      mode: "password",
      ssoProviders: [],
    });
  });

  it("loads auth config for the current tenant request", async () => {
    mockGetTenantFromHeaders.mockResolvedValue("armstrong");
    mockTenantFindUnique.mockResolvedValue({
      status: "active",
      settings: {
        auth: {
          mode: "sso_only",
          ssoProviders: [
            {
              id: "entra",
              label: "Microsoft",
              type: "microsoft",
              enabled: true,
            },
          ],
        },
      },
    });

    const { getTenantAuthConfigForCurrentRequest } = await import("@/lib/auth/tenant-auth");
    await expect(getTenantAuthConfigForCurrentRequest()).resolves.toEqual({
      tenantSlug: "armstrong",
      authConfig: {
        mode: "sso_only",
        ssoProviders: [
          {
            id: "entra",
            label: "Microsoft",
            type: "microsoft",
            startUrl: "",
            enabled: true,
            domains: [],
          },
        ],
      },
    });
  });
});
