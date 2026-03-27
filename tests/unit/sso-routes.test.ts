/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

export {};

const mockGetTenantAuthConfigForCurrentRequest = jest.fn();
const mockGetTenantAuthConfigForSlug = jest.fn();
const mockBuildTenantSsoOptions = jest.fn();
const mockGetEnabledSsoProviders = jest.fn();
const mockIsMicrosoftEntraConfigured = jest.fn();
const mockSignIn = jest.fn();
const cookieSet = jest.fn();

jest.mock("@/lib/auth/tenant-auth", () => ({
  DEFAULT_TENANT_AUTH_CONFIG: { mode: "password", ssoProviders: [] },
  WMS_SSO_COOKIE_MAX_AGE_SECONDS: 600,
  WMS_SSO_PROVIDER_COOKIE: "wms-sso-provider",
  WMS_SSO_TENANT_COOKIE: "wms-sso-tenant",
  buildTenantSsoOptions: (...args: unknown[]) => mockBuildTenantSsoOptions(...args),
  getEnabledSsoProviders: (...args: unknown[]) => mockGetEnabledSsoProviders(...args),
  getTenantAuthConfigForCurrentRequest: (...args: unknown[]) =>
    mockGetTenantAuthConfigForCurrentRequest(...args),
  getTenantAuthConfigForSlug: (...args: unknown[]) => mockGetTenantAuthConfigForSlug(...args),
  isMicrosoftEntraConfigured: (...args: unknown[]) => mockIsMicrosoftEntraConfigured(...args),
}));

jest.mock("@/lib/auth/auth-options", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    set: (...args: unknown[]) => cookieSet(...args),
  }),
}));

describe("SSO discovery and start routes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    Reflect.deleteProperty(process.env as Record<string, string | undefined>, "NODE_ENV");
    mockBuildTenantSsoOptions.mockReturnValue([]);
    mockGetEnabledSsoProviders.mockReturnValue([]);
    mockIsMicrosoftEntraConfigured.mockReturnValue(true);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns no SSO options when no tenant is resolved", async () => {
    mockGetTenantAuthConfigForCurrentRequest.mockResolvedValue({
      tenantSlug: null,
      authConfig: { mode: "password", ssoProviders: [] },
    });

    const { POST } = await import("@/app/api/auth/sso/discover/route");
    const req = new NextRequest("http://localhost/api/auth/sso/discover", {
      method: "POST",
      body: JSON.stringify({ callbackUrl: "/dashboard" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(await res.json()).toEqual({
      tenantSlug: null,
      mode: "password",
      sso: [],
    });
  });

  it("builds SSO options for an explicit tenant slug with a safe callback", async () => {
    mockGetTenantAuthConfigForSlug.mockResolvedValue({
      mode: "hybrid",
      ssoProviders: [{ id: "entra", type: "microsoft" }],
    });
    mockBuildTenantSsoOptions.mockReturnValue([
      {
        id: "entra",
        label: "Microsoft Entra ID",
        type: "microsoft",
        startUrl: "/api/auth/sso/start?tenantSlug=acme&providerId=entra",
      },
    ]);

    const { POST } = await import("@/app/api/auth/sso/discover/route");
    const req = new NextRequest("http://localhost/api/auth/sso/discover", {
      method: "POST",
      body: JSON.stringify({ tenantSlug: "acme", callbackUrl: "/platform/tenants/new" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(mockBuildTenantSsoOptions).toHaveBeenCalledWith(
      { mode: "hybrid", ssoProviders: [{ id: "entra", type: "microsoft" }] },
      "acme",
      "/platform/tenants/new"
    );
    expect(await res.json()).toEqual({
      tenantSlug: "acme",
      mode: "hybrid",
      sso: [
        {
          id: "entra",
          label: "Microsoft Entra ID",
          type: "microsoft",
          startUrl: "/api/auth/sso/start?tenantSlug=acme&providerId=entra",
        },
      ],
    });
  });

  it("redirects Microsoft providers through NextAuth and stores the pending SSO cookies", async () => {
    process.env = { ...process.env, NODE_ENV: "production", AUTH_URL: "https://wms.ramola.app" };
    mockGetTenantAuthConfigForSlug.mockResolvedValue({ mode: "hybrid", ssoProviders: [] });
    mockGetEnabledSsoProviders.mockReturnValue([
      {
        id: "entra",
        type: "microsoft",
        startUrl: "",
      },
    ]);
    mockSignIn.mockResolvedValue("https://login.microsoftonline.com/example");

    const { GET } = await import("@/app/api/auth/sso/start/route");
    const req = new NextRequest(
      "https://wms.ramola.app/api/auth/sso/start?tenantSlug=acme&providerId=entra&callbackUrl=/dashboard"
    );

    const res = await GET(req);

    expect(cookieSet).toHaveBeenCalledWith(
      "wms-sso-tenant",
      "acme",
      expect.objectContaining({ domain: ".wms.ramola.app", secure: true, maxAge: 600 })
    );
    expect(cookieSet).toHaveBeenCalledWith(
      "wms-sso-provider",
      "entra",
      expect.objectContaining({ domain: ".wms.ramola.app", secure: true, maxAge: 600 })
    );
    expect(mockSignIn).toHaveBeenCalledWith(
      "microsoft-entra-id",
      { redirect: false, redirectTo: "/dashboard" },
      { prompt: "select_account" }
    );
    expect(res.headers.get("location")).toBe("https://login.microsoftonline.com/example");
  });

  it("redirects non-Microsoft providers to their configured start URL and forwards safe callbacks", async () => {
    mockGetTenantAuthConfigForSlug.mockResolvedValue({ mode: "hybrid", ssoProviders: [] });
    mockGetEnabledSsoProviders.mockReturnValue([
      {
        id: "oidc-main",
        type: "oidc",
        startUrl: "/oidc/start",
      },
    ]);

    const { GET } = await import("@/app/api/auth/sso/start/route");
    const req = new NextRequest(
      "https://wms.ramola.app/api/auth/sso/start?tenantSlug=acme&providerId=oidc-main&callbackUrl=/orders"
    );

    const res = await GET(req);
    expect(res.headers.get("location")).toBe(
      "https://wms.ramola.app/oidc/start?callbackUrl=%2Forders"
    );
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
