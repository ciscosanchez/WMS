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
    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      data: {
        name: data.companyName,
        settings: {
          companyName: data.companyName,
          timezone: data.timezone,
          dateFormat: data.dateFormat,
          freightMode: data.freightMode,
          dtcMode: data.dtcMode,
          asnPrefix: data.asnPrefix,
          orderPrefix: data.orderPrefix,
          adjustmentPrefix: data.adjustmentPrefix,
          pickPrefix: data.pickPrefix,
        },
      },
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
