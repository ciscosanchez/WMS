"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { notificationQueue, integrationQueue, emailQueue } from "@/lib/jobs/queue";

export async function getLabelDownloadUrl(
  shipmentId: string
): Promise<{ url?: string; error?: string }> {
  try {
    const { tenant } = await requireTenantContext("shipping:read");
    const { getPresignedDownloadUrl } = await import("@/lib/s3/client");

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      select: { labelUrl: true },
    });

    if (!shipment?.labelUrl) return { error: "No label on file" };

    const url = await getPresignedDownloadUrl(shipment.labelUrl, 300); // 5 min
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to get label URL" };
  }
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
    const { user, tenant } = await requireTenantContext("shipping:write");

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true, items: true },
    });
    if (!shipment) throw new Error("Shipment not found");

    // Idempotency guard: if already shipped, return success (no double-decrement)
    if (shipment.status === "shipped") return {};

    // Atomic: update shipment + order status + decrement inventory + write ledger
    await tenant.db.$transaction(
      async (prisma: Parameters<Parameters<typeof tenant.db.$transaction>[0]>[0]) => {
        // Pre-flight: verify ALL lines have sufficient stock before any mutations.
        // Abort the entire transaction if any line is short.
        const pickTask = await prisma.pickTask.findFirst({
          where: { orderId: shipment.orderId },
          include: { lines: true },
        });

        const shortItems: string[] = [];
        for (const item of shipment.items) {
          const pickLine = pickTask?.lines.find(
            (l: { productId: string }) => l.productId === item.productId
          );
          if (pickLine?.binId) {
            const inv = await prisma.inventory.findFirst({
              where: {
                productId: item.productId,
                binId: pickLine.binId,
                lotNumber: item.lotNumber,
                serialNumber: item.serialNumber,
              },
            });
            if (!inv || inv.onHand < item.quantity) {
              shortItems.push(`${item.productId}: need ${item.quantity}, have ${inv?.onHand ?? 0}`);
            }
          }
        }

        if (shortItems.length > 0) {
          throw new Error(`Insufficient stock for shipment. Short items: ${shortItems.join("; ")}`);
        }

        // Update shipment
        await prisma.shipment.update({
          where: { id: shipmentId },
          data: {
            trackingNumber,
            carrier,
            status: "shipped",
            shippedAt: new Date(),
          },
        });

        // Update order status to shipped
        await prisma.order.update({
          where: { id: shipment.orderId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { status: "shipped" as any, shippedDate: new Date() },
        });

        // Decrement inventory: release allocation and reduce onHand for each shipped item
        for (const item of shipment.items) {
          const pickLine = pickTask?.lines.find(
            (l: { productId: string }) => l.productId === item.productId
          );

          if (pickLine?.binId) {
            const inv = await prisma.inventory.findFirst({
              where: {
                productId: item.productId,
                binId: pickLine.binId,
                lotNumber: item.lotNumber,
                serialNumber: item.serialNumber,
              },
            });

            if (inv) {
              await prisma.inventory.update({
                where: { id: inv.id },
                data: {
                  onHand: { decrement: item.quantity },
                  allocated: { decrement: Math.min(item.quantity, inv.allocated) },
                  available:
                    inv.available - (item.quantity - Math.min(item.quantity, inv.allocated)),
                },
              });

              // Write ledger entry
              await prisma.inventoryTransaction.create({
                data: {
                  type: "deallocate",
                  productId: item.productId,
                  fromBinId: pickLine.binId,
                  quantity: item.quantity,
                  lotNumber: item.lotNumber,
                  serialNumber: item.serialNumber,
                  referenceType: "shipment",
                  referenceId: shipmentId,
                  performedBy: user.id,
                },
              });
            }
          }
        }
      }
    );

    // Post-commit side-effects: audit + queues.
    // These must NOT throw — a failure here should not cause a retry
    // (which would double-decrement inventory since the tx already committed).
    try {
      await logAudit(tenant.db, {
        userId: user.id,
        action: "update",
        entityType: "shipment",
        entityId: shipmentId,
        changes: {
          status: { old: "pending", new: "shipped" },
          trackingNumber: { old: null, new: trackingNumber },
        },
      });

      const orderNumber = shipment.order?.orderNumber ?? shipment.shipmentNumber;

      if (shipment.order.externalId) {
        await integrationQueue.add("shopify_fulfillment", {
          type: "shopify_fulfillment",
          tenantId: tenant.tenantId,
          orderId: shipment.orderId,
          trackingNumber,
          carrier,
        });
      }

      await notificationQueue.add("order_shipped", {
        type: "warehouse_team",
        tenantId: tenant.tenantId,
        title: "Order Shipped",
        message: `${orderNumber} shipped via ${carrier} — ${trackingNumber}`,
        link: `/shipping/${shipmentId}`,
      });

      const customerEmail = shipment.order?.shipToEmail;
      if (customerEmail) {
        await emailQueue.add("order_shipped_customer", {
          template: "order_shipped_customer",
          to: customerEmail,
          customerName: shipment.order?.shipToName ?? "Customer",
          orderNumber,
          trackingNumber,
          carrier,
        });
      }
    } catch (postCommitErr) {
      // Log but do NOT propagate — the shipment is already shipped
      console.error("[markShipmentShipped] post-commit side-effect failed:", postCommitErr);
    }

    revalidatePath("/shipping");
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark shipment shipped" };
  }
}
