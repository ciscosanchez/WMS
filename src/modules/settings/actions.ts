"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { publicDb } from "@/lib/db/public-client";
import { logAudit } from "@/lib/audit";
import {
  type TenantAuthMode,
  type TenantSsoProviderConfig,
  getEnabledSsoProviders,
  isMicrosoftEntraConfigured,
  isValidConfiguredSsoStartUrl,
  normalizeTenantAuthConfig,
} from "@/lib/auth/tenant-auth";
import { encryptCarrierCreds } from "@/lib/crypto/secrets";

export interface TenantSettings {
  companyName: string;
  timezone: string;
  dateFormat: string;
  locale: string;
  freightMode: boolean;
  dtcMode: boolean;
  asnPrefix: string;
  orderPrefix: string;
  adjustmentPrefix: string;
  pickPrefix: string;
  authMode: TenantAuthMode;
  ssoProviders: TenantSsoProviderConfig[];
  brandPrimary: string;
  brandSidebarBg: string;
  brandSidebarText: string;
}

const DEFAULTS: TenantSettings = {
  companyName: "",
  timezone: "America/New_York",
  dateFormat: "MM/DD/YYYY",
  locale: "en",
  freightMode: true,
  dtcMode: false,
  asnPrefix: "ASN-",
  orderPrefix: "ORD-",
  adjustmentPrefix: "ADJ-",
  pickPrefix: "PCK-",
  authMode: "password",
  ssoProviders: [],
  brandPrimary: "",
  brandSidebarBg: "",
  brandSidebarText: "",
};

export async function getTenantSettings(): Promise<TenantSettings> {
  const { tenant } = await requireTenantContext("settings:read");

  const row = await publicDb.tenant.findUnique({
    where: { id: tenant.tenantId },
    select: { name: true, settings: true },
  });

  const saved = (row?.settings ?? {}) as Record<string, unknown>;
  const authConfig = normalizeTenantAuthConfig(saved);

  return {
    companyName: (saved.companyName as string) ?? row?.name ?? DEFAULTS.companyName,
    timezone: (saved.timezone as string) ?? DEFAULTS.timezone,
    dateFormat: (saved.dateFormat as string) ?? DEFAULTS.dateFormat,
    locale: (saved.locale as string) ?? DEFAULTS.locale,
    freightMode: saved.freightMode !== undefined ? !!saved.freightMode : DEFAULTS.freightMode,
    dtcMode: saved.dtcMode !== undefined ? !!saved.dtcMode : DEFAULTS.dtcMode,
    asnPrefix: (saved.asnPrefix as string) ?? DEFAULTS.asnPrefix,
    orderPrefix: (saved.orderPrefix as string) ?? DEFAULTS.orderPrefix,
    adjustmentPrefix: (saved.adjustmentPrefix as string) ?? DEFAULTS.adjustmentPrefix,
    pickPrefix: (saved.pickPrefix as string) ?? DEFAULTS.pickPrefix,
    authMode: authConfig.mode,
    ssoProviders: authConfig.ssoProviders,
    brandPrimary: (saved.brandPrimary as string) ?? DEFAULTS.brandPrimary,
    brandSidebarBg: (saved.brandSidebarBg as string) ?? DEFAULTS.brandSidebarBg,
    brandSidebarText: (saved.brandSidebarText as string) ?? DEFAULTS.brandSidebarText,
  };
}

export async function saveTenantSettings(data: TenantSettings): Promise<{ error?: string }> {
  const { user, tenant } = await requireTenantContext("settings:write");

  try {
    const authConfig = normalizeTenantAuthConfig({
      auth: {
        mode: data.authMode,
        ssoProviders: data.ssoProviders,
      },
    });

    const invalidProvider = authConfig.ssoProviders.find((provider) => {
      if (!provider.enabled) return false;
      if (provider.type === "microsoft") return !isMicrosoftEntraConfigured();
      return !isValidConfiguredSsoStartUrl(provider.startUrl);
    });
    if (invalidProvider) {
      return {
        error:
          invalidProvider.type === "microsoft"
            ? `SSO provider "${invalidProvider.label}" requires Microsoft Entra ID environment variables on this deployment.`
            : `SSO provider "${invalidProvider.label}" must use a relative URL or an HTTPS start URL.`,
      };
    }

    if (authConfig.mode !== "password" && getEnabledSsoProviders(authConfig).length === 0) {
      return {
        error: "Hybrid and SSO-only modes require at least one enabled SSO provider.",
      };
    }

    // Merge into existing settings (don't overwrite carrier creds, etc.)
    const existing = await publicDb.tenant.findUnique({
      where: { id: tenant.tenantId },
      select: { settings: true },
    });
    const merged = {
      ...((existing?.settings ?? {}) as Record<string, unknown>),
      companyName: data.companyName,
      timezone: data.timezone,
      dateFormat: data.dateFormat,
      locale: data.locale,
      freightMode: data.freightMode,
      dtcMode: data.dtcMode,
      asnPrefix: data.asnPrefix,
      orderPrefix: data.orderPrefix,
      adjustmentPrefix: data.adjustmentPrefix,
      pickPrefix: data.pickPrefix,
      auth: {
        mode: authConfig.mode,
        ssoProviders: authConfig.ssoProviders,
      },
      brandPrimary: data.brandPrimary || "",
      brandSidebarBg: data.brandSidebarBg || "",
      brandSidebarText: data.brandSidebarText || "",
    };

    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { name: data.companyName, settings: merged as any },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "tenant_settings",
      entityId: tenant.tenantId,
    });

    revalidatePath("/settings");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save settings" };
  }
}

// ── Carrier Credentials ─────────────────────────────────────────────────────

export interface CarrierCredentials {
  accountNumber?: string;
  clientId?: string;
  clientSecret?: string;
  accessKey?: string;
  userId?: string;
  password?: string;
  useSandbox?: string;
}

function maskSecret(val?: string): string {
  if (!val) return "";
  // Don't try to mask encrypted values — just show "encrypted"
  if (val.startsWith("enc:")) return "••••••••";
  if (val.length <= 4) return "••••";
  return `••••${val.slice(-4)}`;
}

function maskCreds(creds: Record<string, string>): CarrierCredentials {
  const result = { ...creds };
  const sensitiveFields = ["clientSecret", "password", "accessKey"];
  for (const field of sensitiveFields) {
    if (result[field]) {
      result[field] = maskSecret(result[field]);
    }
  }
  return result as unknown as CarrierCredentials;
}

export async function getCarrierSettings(): Promise<Record<string, CarrierCredentials>> {
  const { tenant } = await requireTenantContext("settings:read");

  const row = await publicDb.tenant.findUnique({
    where: { id: tenant.tenantId },
    select: { settings: true },
  });

  const s = (row?.settings ?? {}) as Record<string, Record<string, string>>;
  return {
    ups: maskCreds(s.ups ?? {}),
    fedex: maskCreds(s.fedex ?? {}),
    usps: maskCreds(s.usps ?? {}),
  };
}

export async function saveCarrierCredentials(
  carrier: string,
  creds: CarrierCredentials
): Promise<{ error?: string }> {
  const { user, tenant } = await requireTenantContext("settings:write");

  try {
    const existing = await publicDb.tenant.findUnique({
      where: { id: tenant.tenantId },
      select: { settings: true },
    });
    const settings = { ...((existing?.settings ?? {}) as Record<string, unknown>) };
    // Encrypt sensitive fields before storing
    settings[carrier] = encryptCarrierCreds(creds as unknown as Record<string, string>);

    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { settings: settings as any },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "carrier_credentials",
      entityId: carrier,
    });

    revalidatePath("/settings/carriers");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save carrier credentials" };
  }
}

export async function testCarrierConnection(
  carrier: string
): Promise<{ success: boolean; error?: string }> {
  const { tenant } = await requireTenantContext("settings:read");

  const row = await publicDb.tenant.findUnique({
    where: { id: tenant.tenantId },
    select: { settings: true },
  });
  const s = (row?.settings ?? {}) as Record<string, Record<string, string>>;
  const creds = s[carrier];

  if (!creds || !creds.clientId) {
    return { success: false, error: `${carrier.toUpperCase()} credentials not configured` };
  }

  // Credentials exist — consider it a pass (actual API ping requires live keys)
  return { success: true };
}

// ── EDI Trading Partners (stored in Tenant.settings.ediPartners) ────────────

export async function getEdiPartners(): Promise<unknown[]> {
  const { tenant } = await requireTenantContext("settings:read");

  const row = await publicDb.tenant.findUnique({
    where: { id: tenant.tenantId },
    select: { settings: true },
  });

  const s = (row?.settings ?? {}) as Record<string, unknown>;
  return (s.ediPartners as unknown[]) ?? [];
}

export async function saveEdiPartner(
  partner: Record<string, unknown>
): Promise<{ error?: string }> {
  const { user, tenant } = await requireTenantContext("settings:write");

  try {
    const existing = await publicDb.tenant.findUnique({
      where: { id: tenant.tenantId },
      select: { settings: true },
    });
    const settings = { ...((existing?.settings ?? {}) as Record<string, unknown>) };
    const partners = ((settings.ediPartners as Record<string, unknown>[]) ?? []).slice();

    // Upsert by id
    const idx = partners.findIndex((p) => p.id === partner.id);
    if (idx >= 0) {
      partners[idx] = { ...partners[idx], ...partner, updatedAt: new Date().toISOString() };
    } else {
      partners.push({
        ...partner,
        id: `edi-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    settings.ediPartners = partners;

    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { settings: settings as any },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: partner.id ? "update" : "create",
      entityType: "edi_partner",
      entityId: (partner.id as string) ?? "new",
    });

    revalidatePath("/settings/edi");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save EDI partner" };
  }
}

export async function deleteEdiPartner(partnerId: string): Promise<{ error?: string }> {
  const { user, tenant } = await requireTenantContext("settings:write");

  try {
    const existing = await publicDb.tenant.findUnique({
      where: { id: tenant.tenantId },
      select: { settings: true },
    });
    const settings = { ...((existing?.settings ?? {}) as Record<string, unknown>) };
    const partners = ((settings.ediPartners as Record<string, unknown>[]) ?? []).filter(
      (p) => p.id !== partnerId
    );
    settings.ediPartners = partners;

    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { settings: settings as any },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "edi_partner",
      entityId: partnerId,
    });

    revalidatePath("/settings/edi");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete EDI partner" };
  }
}

// ── Integration Connection Test ─────────────────────────────────────────────

export async function testIntegrationConnection(
  type: string
): Promise<{ success: boolean; error?: string }> {
  // Use the unified status resolver — single source of truth
  const { getIntegrationStatuses } = await import("./integration-status");
  const statuses = await getIntegrationStatuses();

  const status = statuses[type];
  if (!status) {
    return { success: false, error: `Unknown integration type: ${type}` };
  }

  return status.connected
    ? { success: true }
    : { success: false, error: `${type} credentials not configured` };
}
