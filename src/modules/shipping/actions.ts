"use server";

import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";

async function getContext() {
  return requireTenantContext();
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
