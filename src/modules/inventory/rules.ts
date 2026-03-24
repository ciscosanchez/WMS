"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";

async function getContext() {
  return requireTenantContext();
}

// ── Putaway Rules ───────────────────────────────────────────────────────────

export async function getPutawayRules() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  const rules = await tenant.db.putawayRule.findMany({
    include: {
      product: { select: { sku: true, name: true } },
    },
    orderBy: { priority: "asc" },
  });

  return rules.map(
    (r: {
      id: string;
      productId: string | null;
      product: { sku: string; name: string } | null;
      zoneCode: string | null;
      strategy: string;
      priority: number;
      isActive: boolean;
    }) => ({
      id: r.id,
      productId: r.productId,
      productSku: r.product?.sku ?? null,
      productName: r.product?.name ?? null,
      zoneCode: r.zoneCode,
      strategy: r.strategy,
      priority: r.priority,
      isActive: r.isActive,
    })
  );
}

export async function createPutawayRule(data: {
  productId: string | null;
  zoneCode: string | null;
  strategy: string;
  priority: number;
}) {
  if (config.useMockData) return { id: "mock" };

  const { user, tenant } = await requireTenantContext("inventory:write");

  const rule = await tenant.db.putawayRule.create({
    data: {
      productId: data.productId || null,
      zoneCode: data.zoneCode || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      strategy: data.strategy as any,
      priority: data.priority,
      isActive: true,
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "putaway_rule",
    entityId: rule.id,
  });

  revalidatePath("/inventory/putaway/rules");
  return rule;
}

export async function deletePutawayRule(id: string) {
  if (config.useMockData) return { deleted: true };

  const { user, tenant } = await requireTenantContext("inventory:write");

  await tenant.db.putawayRule.delete({ where: { id } });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "putaway_rule",
    entityId: id,
  });

  revalidatePath("/inventory/putaway/rules");
  return { deleted: true };
}

export async function getZonesForDropdown() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.zone.findMany({
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
}
