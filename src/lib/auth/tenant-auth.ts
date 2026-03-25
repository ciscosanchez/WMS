import { publicDb } from "@/lib/db/public-client";
import { getTenantFromHeaders } from "@/lib/tenant/context";

export const TENANT_AUTH_MODES = ["password", "hybrid", "sso_only"] as const;
export type TenantAuthMode = (typeof TENANT_AUTH_MODES)[number];

export const WMS_SSO_TENANT_COOKIE = "wms-sso-tenant";
export const WMS_SSO_PROVIDER_COOKIE = "wms-sso-provider";
export const WMS_SSO_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export type TenantSsoProviderType = "microsoft" | "oidc" | "saml";

export interface TenantSsoProviderConfig {
  id: string;
  label: string;
  type: TenantSsoProviderType;
  startUrl: string;
  enabled: boolean;
  domains: string[];
}

export interface TenantAuthConfig {
  mode: TenantAuthMode;
  ssoProviders: TenantSsoProviderConfig[];
}

export interface TenantSsoOption {
  id: string;
  label: string;
  type: TenantSsoProviderType;
  startUrl: string;
}

export const DEFAULT_TENANT_AUTH_CONFIG: TenantAuthConfig = {
  mode: "password",
  ssoProviders: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMode(value: unknown): TenantAuthMode {
  return TENANT_AUTH_MODES.includes(value as TenantAuthMode)
    ? (value as TenantAuthMode)
    : DEFAULT_TENANT_AUTH_CONFIG.mode;
}

function normalizeProviderType(value: unknown): TenantSsoProviderType {
  if (value === "microsoft") return "microsoft";
  return value === "saml" ? "saml" : "oidc";
}

function normalizeDomains(value: unknown): string[] {
  const rawValues =
    typeof value === "string"
      ? value.split(",")
      : Array.isArray(value)
        ? value
        : [];

  return rawValues
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function toProviderId(value: string, fallbackIndex: number): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `sso-${fallbackIndex + 1}`;
}

export function isValidConfiguredSsoStartUrl(startUrl: string): boolean {
  const trimmed = startUrl.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return true;
    if (
      process.env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function isMicrosoftEntraConfigured(): boolean {
  return Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  );
}

export function isSsoProviderReady(provider: TenantSsoProviderConfig): boolean {
  if (!provider.enabled) return false;
  if (provider.type === "microsoft") return isMicrosoftEntraConfigured();
  return isValidConfiguredSsoStartUrl(provider.startUrl);
}

export function isSsoEmailAllowed(
  provider: TenantSsoProviderConfig,
  email: string | null | undefined
): boolean {
  if (!email) return false;
  if (provider.domains.length === 0) return true;

  const normalizedEmail = email.toLowerCase().trim();
  return provider.domains.some((domain) => normalizedEmail.endsWith(`@${domain}`));
}

export function normalizeTenantAuthConfig(settings: unknown): TenantAuthConfig {
  const root = isRecord(settings) ? settings : {};
  const auth = isRecord(root.auth) ? root.auth : {};
  const rawProviders = Array.isArray(auth.ssoProviders) ? auth.ssoProviders : [];

  return {
    mode: normalizeMode(auth.mode),
    ssoProviders: rawProviders
      .map((value, index) => {
        const provider = isRecord(value) ? value : {};
        const label = typeof provider.label === "string" ? provider.label.trim() : "";
        const startUrl = typeof provider.startUrl === "string" ? provider.startUrl.trim() : "";

        return {
          id: toProviderId(
            typeof provider.id === "string" && provider.id.trim() ? provider.id : label,
            index
          ),
          label: label || `Sign in with SSO ${index + 1}`,
          type: normalizeProviderType(provider.type),
          startUrl,
          enabled: provider.enabled !== false,
          domains: normalizeDomains(provider.domains),
        };
      })
      .filter((provider) => provider.enabled || provider.label || provider.startUrl),
  };
}

export function isPasswordLoginAllowed(config: TenantAuthConfig): boolean {
  return config.mode !== "sso_only";
}

export function getEnabledSsoProviders(config: TenantAuthConfig): TenantSsoProviderConfig[] {
  return config.ssoProviders.filter((provider) => isSsoProviderReady(provider));
}

export function buildTenantSsoOptions(
  config: TenantAuthConfig,
  tenantSlug: string,
  callbackUrl?: string | null
): TenantSsoOption[] {
  return getEnabledSsoProviders(config).map((provider) => {
    const searchParams = new URLSearchParams({
      tenantSlug,
      providerId: provider.id,
    });

    if (callbackUrl && callbackUrl.startsWith("/")) {
      searchParams.set("callbackUrl", callbackUrl);
    }

    return {
      id: provider.id,
      label: provider.label,
      type: provider.type,
      startUrl: `/api/auth/sso/start?${searchParams.toString()}`,
    };
  });
}

export async function getTenantAuthConfigForSlug(slug: string): Promise<TenantAuthConfig> {
  const tenant = await publicDb.tenant.findUnique({
    where: { slug },
    select: { status: true, settings: true },
  });

  if (!tenant || tenant.status !== "active") {
    return DEFAULT_TENANT_AUTH_CONFIG;
  }

  return normalizeTenantAuthConfig(tenant.settings);
}

export async function getTenantAuthConfigForCurrentRequest(): Promise<{
  tenantSlug: string | null;
  authConfig: TenantAuthConfig;
}> {
  const tenantSlug = await getTenantFromHeaders();
  if (!tenantSlug) {
    return {
      tenantSlug: null,
      authConfig: DEFAULT_TENANT_AUTH_CONFIG,
    };
  }

  return {
    tenantSlug,
    authConfig: await getTenantAuthConfigForSlug(tenantSlug),
  };
}
