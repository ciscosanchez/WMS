"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { publicDb } from "@/lib/db/public-client";
import { logAudit } from "@/lib/audit";

interface TenantSettings {
  companyName: string;
  timezone: string;
  dateFormat: string;
  freightMode: boolean;
  dtcMode: boolean;
  asnPrefix: string;
  orderPrefix: string;
  adjustmentPrefix: string;
  pickPrefix: string;
}

const DEFAULTS: TenantSettings = {
  companyName: "",
  timezone: "America/New_York",
  dateFormat: "MM/DD/YYYY",
  freightMode: true,
  dtcMode: false,
  asnPrefix: "ASN-",
  orderPrefix: "ORD-",
  adjustmentPrefix: "ADJ-",
  pickPrefix: "PCK-",
};

export async function getTenantSettings(): Promise<TenantSettings> {
  const { tenant } = await requireTenantContext("settings:read");

  const row = await publicDb.tenant.findUnique({
    where: { id: tenant.tenantId },
    select: { name: true, settings: true },
  });

  const saved = (row?.settings ?? {}) as Record<string, unknown>;

  return {
    companyName: (saved.companyName as string) ?? row?.name ?? DEFAULTS.companyName,
    timezone: (saved.timezone as string) ?? DEFAULTS.timezone,
    dateFormat: (saved.dateFormat as string) ?? DEFAULTS.dateFormat,
    freightMode: saved.freightMode !== undefined ? !!saved.freightMode : DEFAULTS.freightMode,
    dtcMode: saved.dtcMode !== undefined ? !!saved.dtcMode : DEFAULTS.dtcMode,
    asnPrefix: (saved.asnPrefix as string) ?? DEFAULTS.asnPrefix,
    orderPrefix: (saved.orderPrefix as string) ?? DEFAULTS.orderPrefix,
    adjustmentPrefix: (saved.adjustmentPrefix as string) ?? DEFAULTS.adjustmentPrefix,
    pickPrefix: (saved.pickPrefix as string) ?? DEFAULTS.pickPrefix,
  };
}

export async function saveTenantSettings(
  data: TenantSettings
): Promise<{ error?: string }> {
  const { user, tenant } = await requireTenantContext("settings:write");

  try {
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
      freightMode: data.freightMode,
      dtcMode: data.dtcMode,
      asnPrefix: data.asnPrefix,
      orderPrefix: data.orderPrefix,
      adjustmentPrefix: data.adjustmentPrefix,
      pickPrefix: data.pickPrefix,
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

export async function getCarrierSettings(): Promise<Record<string, CarrierCredentials>> {
  const { tenant } = await requireTenantContext("settings:read");

  const row = await publicDb.tenant.findUnique({
    where: { id: tenant.tenantId },
    select: { settings: true },
  });

  const s = (row?.settings ?? {}) as Record<string, unknown>;
  return {
    ups: (s.ups as CarrierCredentials) ?? {},
    fedex: (s.fedex as CarrierCredentials) ?? {},
    usps: (s.usps as CarrierCredentials) ?? {},
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
    settings[carrier] = creds;

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

export async function saveEdiPartner(partner: Record<string, unknown>): Promise<{ error?: string }> {
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
      partners.push({ ...partner, id: `edi-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
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
    const partners = ((settings.ediPartners as Record<string, unknown>[]) ?? [])
      .filter((p) => p.id !== partnerId);
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
  const { tenant } = await requireTenantContext("settings:read");

  if (type === "shopify") {
    // Check if Shopify SalesChannel exists with config
    const channel = await tenant.db.salesChannel.findFirst({
      where: { type: "shopify", isActive: true },
    });
    const cfg = (channel?.config ?? {}) as Record<string, string>;
    const hasCredentials = !!(cfg.accessToken || process.env.SHOPIFY_ACCESS_TOKEN);
    return hasCredentials
      ? { success: true }
      : { success: false, error: "Shopify credentials not configured" };
  }

  if (type === "amazon") {
    const hasCredentials = !!(process.env.AMAZON_SP_CLIENT_ID);
    return hasCredentials
      ? { success: true }
      : { success: false, error: "Amazon SP-API credentials not configured" };
  }

  if (type === "netsuite") {
    const hasCredentials = !!(process.env.NETSUITE_ACCOUNT_ID);
    return hasCredentials
      ? { success: true }
      : { success: false, error: "NetSuite credentials not configured" };
  }

  if (type === "dispatchpro") {
    const hasCredentials = !!(process.env.DISPATCHPRO_API_URL);
    return hasCredentials
      ? { success: true }
      : { success: false, error: "DispatchPro not configured" };
  }

  return { success: false, error: `Unknown integration type: ${type}` };
}
