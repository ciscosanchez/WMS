/**
 * @jest-environment node
 */

export {};

const mockRequireTenantContext = jest.fn();
const mockTenantFindUnique = jest.fn();
const mockTenantUpdate = jest.fn();
const mockLogAudit = jest.fn();
const mockRevalidatePath = jest.fn();
const mockEncryptCarrierCreds = jest.fn();

jest.mock("@/lib/tenant/context", () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: {
      findUnique: (...args: unknown[]) => mockTenantFindUnique(...args),
      update: (...args: unknown[]) => mockTenantUpdate(...args),
    },
  },
}));

jest.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

jest.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

jest.mock("@/lib/crypto/secrets", () => ({
  encryptCarrierCreds: (...args: unknown[]) => mockEncryptCarrierCreds(...args),
}));

describe("tenant settings auth validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
    mockRequireTenantContext.mockResolvedValue({
      user: { id: "user-1" },
      tenant: {
        tenantId: "tenant-1",
        db: {},
      },
    });
    mockTenantFindUnique.mockResolvedValue({
      settings: {
        existing: true,
      },
    });
    mockTenantUpdate.mockResolvedValue({});
    mockLogAudit.mockResolvedValue({});
    mockEncryptCarrierCreds.mockImplementation((value: unknown) => value);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects enabled Microsoft SSO providers when env is not configured", async () => {
    const { saveTenantSettings } = await import("@/modules/settings/actions");

    const result = await saveTenantSettings({
      companyName: "Acme",
      timezone: "America/New_York",
      dateFormat: "MM/DD/YYYY",
      locale: "en",
      freightMode: true,
      dtcMode: false,
      asnPrefix: "ASN-",
      orderPrefix: "ORD-",
      adjustmentPrefix: "ADJ-",
      pickPrefix: "PCK-",
      authMode: "hybrid",
      ssoProviders: [
        {
          id: "entra",
          label: "Microsoft Entra ID",
          type: "microsoft",
          startUrl: "",
          enabled: true,
          domains: [],
        },
      ],
    });

    expect(result).toEqual({
      error:
        'SSO provider "Microsoft Entra ID" requires Microsoft Entra ID environment variables on this deployment.',
    });
    expect(mockTenantUpdate).not.toHaveBeenCalled();
  });

  it("rejects hybrid mode when no enabled SSO providers are valid", async () => {
    const { saveTenantSettings } = await import("@/modules/settings/actions");

    const result = await saveTenantSettings({
      companyName: "Acme",
      timezone: "America/New_York",
      dateFormat: "MM/DD/YYYY",
      locale: "en",
      freightMode: true,
      dtcMode: false,
      asnPrefix: "ASN-",
      orderPrefix: "ORD-",
      adjustmentPrefix: "ADJ-",
      pickPrefix: "PCK-",
      authMode: "hybrid",
      ssoProviders: [],
    });

    expect(result).toEqual({
      error: "Hybrid and SSO-only modes require at least one enabled SSO provider.",
    });
    expect(mockTenantUpdate).not.toHaveBeenCalled();
  });

  it("accepts redirect-based OIDC providers with safe start URLs and persists merged settings", async () => {
    const { saveTenantSettings } = await import("@/modules/settings/actions");

    const result = await saveTenantSettings({
      companyName: "Acme",
      timezone: "America/New_York",
      dateFormat: "MM/DD/YYYY",
      locale: "en",
      freightMode: true,
      dtcMode: false,
      asnPrefix: "ASN-",
      orderPrefix: "ORD-",
      adjustmentPrefix: "ADJ-",
      pickPrefix: "PCK-",
      authMode: "hybrid",
      ssoProviders: [
        {
          id: "warehouse-oidc",
          label: "Warehouse OIDC",
          type: "oidc",
          startUrl: "https://login.example.com/start",
          enabled: true,
          domains: ["acme.com"],
        },
      ],
    });

    expect(result).toEqual({});
    expect(mockTenantUpdate).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: {
        name: "Acme",
        settings: {
          existing: true,
          companyName: "Acme",
          timezone: "America/New_York",
          dateFormat: "MM/DD/YYYY",
          locale: "en",
          freightMode: true,
          dtcMode: false,
          asnPrefix: "ASN-",
          orderPrefix: "ORD-",
          adjustmentPrefix: "ADJ-",
          pickPrefix: "PCK-",
          auth: {
            mode: "hybrid",
            ssoProviders: [
              {
                id: "warehouse-oidc",
                label: "Warehouse OIDC",
                type: "oidc",
                startUrl: "https://login.example.com/start",
                enabled: true,
                domains: ["acme.com"],
              },
            ],
          },
        },
      },
    });
    expect(mockLogAudit).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings");
  });
});
