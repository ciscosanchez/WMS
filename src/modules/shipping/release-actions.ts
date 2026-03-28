"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { markShipmentShipped } from "./ship-actions";
import { startOfDay } from "date-fns";

/**
 * Get outbound shipments that are labeled and awaiting dock release.
 * Used by the operator release gate screen.
 */
export async function getShipmentsReadyForRelease() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("shipping:read");
  return tenant.db.shipment.findMany({
    where: { status: "label_created", releasedAt: null },
    include: {
      order: {
        select: {
          orderNumber: true,
          priority: true,
          shipToName: true,
          client: { select: { name: true } },
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              barcode: true,
              caseBarcode: true,
              unitsPerCase: true,
              baseUom: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Verify and release a shipment at the dock.
 * Stamps releasedAt/releasedBy, then delegates to markShipmentShipped
 * for inventory deduction, order status update, and external pushes.
 *
 * Idempotent: if releasedAt is already set, returns success without
 * re-running markShipmentShipped (which has its own idempotency guard).
 */
export async function releaseShipment(
  shipmentId: string,
  trackingNumber: string,
  carrier: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true, releasedAt: true },
    });
    if (!shipment) return { error: "Shipment not found" };
    if (shipment.releasedAt) return {}; // Already released — idempotent

    await tenant.db.shipment.update({
      where: { id: shipmentId },
      data: { releasedAt: new Date(), releasedBy: user.id },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "shipment",
      entityId: shipmentId,
      changes: {
        releasedAt: { old: null, new: new Date().toISOString() },
        releasedBy: { old: null, new: user.id },
      },
    });

    const result = await markShipmentShipped(shipmentId, trackingNumber, carrier);
    if (result.error) return result;

    revalidatePath("/release");
    revalidatePath("/operations");
    revalidatePath("/shipping");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Release failed" };
  }
}

/**
 * Get shipments released today — for the manager operations board.
 */
export async function getReleasedShipmentsToday() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("reports:read");
  return tenant.db.shipment.findMany({
    where: { releasedAt: { gte: startOfDay(new Date()) } },
    include: {
      order: {
        select: {
          orderNumber: true,
          client: { select: { name: true } },
        },
      },
      items: { select: { id: true } },
    },
    orderBy: { releasedAt: "desc" },
  });
}
