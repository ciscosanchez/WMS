"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { pushShopifyFulfillment } from "@/modules/orders/shopify-sync";

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

/**
 * Mark a shipment as shipped and update the parent order status.
 * Pushes tracking info back to Shopify if the order came from that channel.
 */
export async function markShipmentShipped(
  shipmentId: string,
  trackingNumber: string,
  carrier: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await getContext();

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });
    if (!shipment) throw new Error("Shipment not found");

    // Update shipment
    await tenant.db.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingNumber,
        carrier,
        status: "shipped",
        shippedAt: new Date(),
      },
    });

    // Update order status to shipped
    await tenant.db.order.update({
      where: { id: shipment.orderId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: "shipped" as any, shippedDate: new Date() },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "shipment",
      entityId: shipmentId,
      changes: { status: { old: "pending", new: "shipped" }, trackingNumber: { old: null, new: trackingNumber } },
    });

    // Push tracking to Shopify (fire-and-forget — don't block on error)
    if (shipment.order.externalId) {
      pushShopifyFulfillment(shipment.orderId, trackingNumber, carrier).catch((err) => {
        console.error("[Shopify] Failed to push fulfillment:", err);
      });
    }

    revalidatePath("/shipping");
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark shipment shipped" };
  }
}
