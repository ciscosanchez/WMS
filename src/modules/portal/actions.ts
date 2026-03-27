"use server";

import { requirePortalContext } from "@/lib/tenant/context";
import type { PrismaClient as TenantClient } from "../../../node_modules/.prisma/tenant-client";

type PortalClientRecord = {
  id: string;
  name: string;
};

type PortalInventoryProduct = {
  id: string;
  sku: string;
  name: string;
  baseUom: string;
  inventory: Array<{ bin: { code: string } | null }>;
};

type PortalOrderRecord = {
  id: string;
  orderNumber: string;
  status: string;
  shipToName: string;
  shipToCity: string | null;
  shipToState: string | null;
  totalItems: number | null;
  shipByDate: Date | null;
  orderDate: Date;
  shipments: Array<{ trackingNumber: string | null; carrier: string | null }>;
};

type PortalShipmentRecord = {
  id: string;
  shipmentNumber: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: string;
  shippedAt: Date | null;
  order: { orderNumber: string } | null;
};

async function getContext() {
  return requirePortalContext();
}

/**
 * Resolve the portal client for the current user.
 * Uses portalClientId from JWT (set via TenantUser.portalClientId).
 * Returns null (fail-closed) if no portalClientId is bound.
 */
async function resolvePortalClient(
  db: TenantClient,
  portalClientId: string | null | undefined
): Promise<PortalClientRecord | null> {
  if (!portalClientId) return null;
  return db.client.findFirst({
    where: { id: portalClientId, isActive: true },
  });
}

export async function getPortalInventory() {
  const { tenant, portalClientId } = await getContext();
  const db = tenant.db as TenantClient;

  const client = await resolvePortalClient(db, portalClientId);
  if (!client) return [];

  const products = await db.product.findMany({
    where: { clientId: client.id, isActive: true },
    include: {
      inventory: {
        where: { onHand: { gt: 0 } },
        include: { bin: true },
        take: 1, // primary bin for location display
      },
    },
    orderBy: { sku: "asc" },
  });

  // Aggregate inventory across all bins per product
  const allInventory = await db.inventory.groupBy({
    by: ["productId"],
    where: {
      product: { clientId: client.id },
    },
    _sum: { onHand: true, allocated: true, available: true },
  });

  const invMap = Object.fromEntries(
    allInventory.map(
      (inv: {
        productId: string;
        _sum: { onHand: number | null; allocated: number | null; available: number | null };
      }) => [
        inv.productId,
        {
          onHand: Number(inv._sum.onHand ?? 0),
          allocated: Number(inv._sum.allocated ?? 0),
          available: Number(inv._sum.available ?? 0),
        },
      ]
    )
  );

  return (products as PortalInventoryProduct[]).map((p) => {
    const inv = invMap[p.id] ?? { onHand: 0, allocated: 0, available: 0 };
    const primaryBin = p.inventory[0]?.bin;
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      uom: p.baseUom,
      onHand: inv.onHand,
      allocated: inv.allocated,
      available: inv.available,
      location: primaryBin ? primaryBin.code : inv.onHand > 0 ? "In Stock" : "—",
    };
  });
}

export async function getPortalOrders() {
  const { tenant, portalClientId } = await getContext();
  const db = tenant.db as TenantClient;

  const client = await resolvePortalClient(db, portalClientId);
  if (!client) return [];

  const orders = await db.order.findMany({
    where: { clientId: client.id },
    include: {
      shipments: {
        select: { trackingNumber: true, carrier: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { orderDate: "desc" },
    take: 100,
  });

  return (orders as PortalOrderRecord[]).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    shipToName: o.shipToName,
    shipToCity: o.shipToCity ?? "",
    shipToState: o.shipToState ?? "",
    totalItems: o.totalItems ?? 0,
    trackingNumber: o.shipments[0]?.trackingNumber ?? null,
    carrier: o.shipments[0]?.carrier ?? null,
    orderDate: o.orderDate,
    shipByDate: o.shipByDate ?? null,
  }));
}

export async function getPortalProducts() {
  const { tenant, portalClientId } = await getContext();
  const db = tenant.db as TenantClient;

  const client = await resolvePortalClient(db, portalClientId);
  if (!client) return [];

  return db.product.findMany({
    where: { clientId: client.id, isActive: true },
    select: { id: true, sku: true, name: true, baseUom: true },
    orderBy: { sku: "asc" },
  }) as Promise<{ id: string; sku: string; name: string; baseUom: string }[]>;
}

export async function createPortalOrder(data: {
  shipToName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  shippingMethod: string;
  lineItems: Array<{ productId: string; quantity: number }>;
}): Promise<{ orderNumber?: string; error?: string }> {
  const { user, tenant, portalClientId } = await getContext();
  const db = tenant.db as TenantClient;

  const client = await resolvePortalClient(db, portalClientId);
  if (!client) return { error: "No client account found" };

  try {
    const { nextSequence } = await import("@/lib/sequences");
    const { logAudit } = await import("@/lib/audit");

    // Validate all productIds belong to this client — prevent cross-client orders
    const productIds = data.lineItems.map((li) => li.productId);
    const validProducts = await db.product.findMany({
      where: { id: { in: productIds }, clientId: client.id, isActive: true },
      select: { id: true },
    });
    const validIds = new Set(validProducts.map((p: { id: string }) => p.id));
    const invalidIds = productIds.filter((id: string) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return { error: "One or more products are not available" };
    }

    // Find or create manual sales channel
    let channel = await db.salesChannel.findFirst({
      where: { type: "manual", isActive: true },
    });
    if (!channel) {
      channel = await db.salesChannel.create({
        data: { name: "Portal", type: "manual", isActive: true, config: {} },
      });
    }

    const orderNumber = await nextSequence(db, "ORD");

    const order = await db.order.create({
      data: {
        orderNumber,
        clientId: client.id,
        channelId: channel.id,
        status: "pending",
        priority: "standard",
        shipToName: data.shipToName,
        shipToAddress1: data.address,
        shipToCity: data.city,
        shipToState: data.state,
        shipToZip: data.zip,
        shipToCountry: "US",
        shippingMethod: data.shippingMethod || null,
        orderDate: new Date(),
        totalItems: data.lineItems.reduce((s, li) => s + li.quantity, 0),
        lines: {
          create: data.lineItems.map((li) => ({
            productId: li.productId,
            quantity: li.quantity,
            uom: "EA",
          })),
        },
      },
    });

    await logAudit(db, {
      userId: user.id,
      action: "create",
      entityType: "order",
      entityId: order.id,
      changes: { source: { old: null, new: "portal" } },
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/portal/orders");

    return { orderNumber };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create order" };
  }
}

export async function getPortalShipments() {
  const { tenant, portalClientId } = await getContext();
  const db = tenant.db as TenantClient;

  const client = await resolvePortalClient(db, portalClientId);
  if (!client) return [];

  const shipments = await db.shipment.findMany({
    where: { order: { clientId: client.id } },
    include: {
      order: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (shipments as PortalShipmentRecord[]).map((s) => ({
    id: s.id,
    shipmentNumber: s.shipmentNumber,
    orderNumber: s.order?.orderNumber ?? "—",
    carrier: s.carrier ?? "—",
    trackingNumber: s.trackingNumber ?? null,
    status: s.status,
    shippedAt: s.shippedAt ?? null,
  }));
}
