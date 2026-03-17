"use server";

import { config } from "@/lib/config";
import { resolveTenant } from "@/lib/tenant/context";
import { requireAuth } from "@/lib/auth/session";

async function getContext() {
  const [user, tenant] = await Promise.all([requireAuth(), resolveTenant()]);
  if (!tenant) throw new Error("Tenant not found");
  return { user, tenant };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getShipments(): Promise<any[]> {
  if (config.useMockData) return [];

  const { tenant } = await getContext();
  return tenant.db.shipment.findMany({
    include: {
      order: { include: { client: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getShipment(id: string): Promise<any | null> {
  if (config.useMockData) return null;

  const { tenant } = await getContext();
  return tenant.db.shipment.findUnique({
    where: { id },
    include: {
      order: { include: { client: true } },
      items: { include: { product: true } },
    },
  });
}
