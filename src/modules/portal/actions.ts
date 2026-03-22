"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { publicDb } from "@/lib/db/public-client";

async function getContext() {
  return requireTenantContext();
}

/**
 * Resolve the portal client for the current user.
 * Priority:
 *   1. Explicit portalClientId on TenantUser (preferred — modeled relationship)
 *   2. Match by user email = client.contactEmail (backward compat)
 *   3. null (fail closed)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePortalClient(db: any, userId: string, tenantId: string, userEmail: string) {
  // 1. Check explicit portal-client binding
  const membership = await publicDb.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { portalClientId: true },
  });

  if (membership?.portalClientId) {
    return db.client.findFirst({
      where: { id: membership.portalClientId, isActive: true },
    });
  }

  // 2. Fall back to email matching (backward compat — will be deprecated)
  if (!userEmail) return null;
  return db.client.findFirst({
    where: { contactEmail: userEmail, isActive: true },
  });
}

export async function getPortalInventory() {
  const { user, tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const client = await resolvePortalClient(db, user.id, tenant.tenantId, user.email ?? "");
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
    allInventory.map((inv: { productId: string; _sum: { onHand: number | null; allocated: number | null; available: number | null } }) => [
      inv.productId,
      {
        onHand: Number(inv._sum.onHand ?? 0),
        allocated: Number(inv._sum.allocated ?? 0),
        available: Number(inv._sum.available ?? 0),
      },
    ])
  );

  return products.map((p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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
  const { user, tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const client = await resolvePortalClient(db, user.id, tenant.tenantId, user.email ?? "");
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

  return orders.map((o: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
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
  const { user, tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const client = await resolvePortalClient(db, user.id, tenant.tenantId, user.email ?? "");
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
  const { user, tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const client = await resolvePortalClient(db, user.id, tenant.tenantId, user.email ?? "");
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
  const { user, tenant } = await getContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const client = await resolvePortalClient(db, user.id, tenant.tenantId, user.email ?? "");
  if (!client) return [];

  const shipments = await db.shipment.findMany({
    where: { order: { clientId: client.id } },
    include: {
      order: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return shipments.map((s: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: s.id,
    shipmentNumber: s.shipmentNumber,
    orderNumber: s.order?.orderNumber ?? "—",
    carrier: s.carrier ?? "—",
    trackingNumber: s.trackingNumber ?? null,
    status: s.status,
    shippedAt: s.shippedAt ?? null,
  }));
}
