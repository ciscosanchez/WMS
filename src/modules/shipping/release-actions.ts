"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAccessibleWarehouseIds } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { markShipmentShipped } from "./ship-actions";
import { startOfDay } from "date-fns";

/**
 * Get outbound shipments that are labeled and awaiting dock release.
 * Used by the operator release gate screen.
 *
 * Outbound Shipment has no warehouseId — scope via pick task → bin → warehouse chain.
 */
export async function getShipmentsReadyForRelease() {
  if (config.useMockData) return [];

  const { tenant, role, warehouseAccess } = await requireTenantContext("shipping:read");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  return tenant.db.shipment.findMany({
    where: {
      status: "label_created",
      releasedAt: null,
      ...(accessibleIds !== null
        ? {
            order: {
              picks: {
                some: {
                  lines: {
                    some: {
                      bin: {
                        shelf: {
                          rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
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
    const { user, tenant, role, warehouseAccess } = await requireTenantContext("shipping:write");

    const shipment = await tenant.db.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true, releasedAt: true, orderId: true },
    });
    if (!shipment) return { error: "Shipment not found" };
    if (shipment.releasedAt) return {}; // Already released — idempotent

    // Warehouse scope guard: scoped actors may only release orders whose pick lines
    // are in their accessible warehouses. Fail-closed: no pick lines found = deny.
    const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
    if (accessibleIds !== null) {
      const pickLine = await tenant.db.pickTaskLine.findFirst({
        where: {
          task: { orderId: shipment.orderId },
          bin: { shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } } },
        },
        select: { id: true },
      });
      if (!pickLine) return { error: "Access denied: shipment is outside your warehouse access" };
    }

    // Call markShipmentShipped FIRST — only stamp releasedAt if it succeeds.
    // Stamping first would leave the shipment in a stuck half-released state on failure.
    const result = await markShipmentShipped(shipmentId, trackingNumber, carrier);
    if (result.error) return result;

    const releasedAt = new Date();
    await tenant.db.shipment.update({
      where: { id: shipmentId },
      data: { releasedAt, releasedBy: user.id },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "shipment",
      entityId: shipmentId,
      changes: {
        releasedAt: { old: null, new: releasedAt.toISOString() },
        releasedBy: { old: null, new: user.id },
      },
    });

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

  const { tenant, role, warehouseAccess } = await requireTenantContext("reports:read");
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  return tenant.db.shipment.findMany({
    where: {
      releasedAt: { gte: startOfDay(new Date()) },
      ...(accessibleIds !== null
        ? {
            order: {
              picks: {
                some: {
                  lines: {
                    some: {
                      bin: {
                        shelf: {
                          rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
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
