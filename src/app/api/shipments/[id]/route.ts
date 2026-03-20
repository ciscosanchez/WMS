import { NextRequest, NextResponse } from "next/server";
import { validateDispatchApiKey } from "@/lib/integrations/dispatchpro/auth";
import { publicDb } from "@/lib/db/public-client";
import { getTenantDb } from "@/lib/db/tenant-client";

/**
 * PATCH /api/shipments/:id
 * DispatchPro → WMS: update order status as freight moves through the TMS.
 *
 * Body: { tenantSlug, status: "assigned" | "in_transit" | "delivered" | "failed", trackingNumber? }
 *
 * Mapping:
 *   in_transit  → WMS order "shipped"  (sets shippedDate)
 *   delivered   → WMS order "delivered" (sets deliveredDate)
 *   failed      → WMS order "on_hold"
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateDispatchApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: wmsOrderId } = await params;
    const body = await request.json();
    const { tenantSlug, status: dispatchStatus, trackingNumber } = body;

    if (!tenantSlug || !dispatchStatus) {
      return NextResponse.json({ error: "Missing tenantSlug or status" }, { status: 400 });
    }

    const tenant = await publicDb.tenant.findUnique({ where: { slug: tenantSlug, status: "active" } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const db = getTenantDb(tenant.dbSchema);
    const order = await db.order.findUnique({ where: { id: wmsOrderId } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Map DispatchPro statuses to WMS order statuses
    const statusMap: Record<string, string> = {
      assigned: "shipped", // driver assigned — treat as "in motion"
      in_transit: "shipped",
      delivered: "delivered",
      failed: "on_hold",
    };

    const wmsStatus = statusMap[dispatchStatus];
    if (!wmsStatus) {
      return NextResponse.json({ error: `Unknown status: ${dispatchStatus}` }, { status: 400 });
    }

    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { status: wmsStatus };

    if (dispatchStatus === "in_transit" || dispatchStatus === "assigned") {
      updateData.shippedDate = order.shippedDate ?? now;
    }
    if (dispatchStatus === "delivered") {
      updateData.deliveredDate = order.deliveredDate ?? now;
    }
    // Update the most recent outbound shipment's tracking + lifecycle fields
    const latestShipment = await db.shipment.findFirst({
      where: { orderId: wmsOrderId },
      orderBy: { createdAt: "desc" },
    });
    if (latestShipment) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shipmentUpdate: Record<string, any> = {};
      if (trackingNumber) shipmentUpdate.trackingNumber = trackingNumber;
      if (dispatchStatus === "in_transit" || dispatchStatus === "assigned") {
        shipmentUpdate.status = "shipped";
        shipmentUpdate.shippedAt = latestShipment.shippedAt ?? now;
      }
      if (dispatchStatus === "delivered") {
        shipmentUpdate.status = "delivered";
        shipmentUpdate.deliveredAt = latestShipment.deliveredAt ?? now;
      }
      if (Object.keys(shipmentUpdate).length > 0) {
        await db.shipment.update({ where: { id: latestShipment.id }, data: shipmentUpdate });
      }
    }

    const updated = await db.order.update({
      where: { id: wmsOrderId },
      data: updateData,
    });

    return NextResponse.json({ success: true, order: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error("[API /shipments/:id] error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
