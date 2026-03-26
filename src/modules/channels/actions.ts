"use server";

import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";

async function getReadContext() {
  return requireTenantContext("orders:read");
}

export async function getChannels() {
  if (config.useMockData) return [];

  const { tenant } = await getReadContext();

  const channels = await tenant.db.salesChannel.findMany({
    include: {
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return channels.map(
    (ch: {
      id: string;
      name: string;
      type: string;
      isActive: boolean;
      _count: { orders: number };
      updatedAt: Date;
    }) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      isActive: ch.isActive,
      orderCount: ch._count.orders,
      updatedAt: ch.updatedAt,
    })
  );
}
