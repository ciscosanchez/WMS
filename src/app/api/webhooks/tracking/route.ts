/**
 * Carrier Tracking Webhook Receiver
 *
 * Accepts tracking status updates from any carrier in a generic format.
 * Validates via timing-safe comparison of `x-webhook-secret` header
 * against TRACKING_WEBHOOK_SECRET env var.
 *
 * Looks up the Shipment by trackingNumber across all active tenants,
 * then updates shipment + order status accordingly.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrackingPayload {
  carrier: string;
  trackingNumber: string;
  status: "in_transit" | "out_for_delivery" | "delivered" | "exception";
  timestamp: string;
  location?: string;
}

const VALID_STATUSES = new Set(["in_transit", "out_for_delivery", "delivered", "exception"]);

// ─── Signature verification ──────────────────────────────────────────────────

function verifyWebhookSecret(headerValue: string, secret: string): boolean {
  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.TRACKING_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Tracking Webhook] TRACKING_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const headerSecret = req.headers.get("x-webhook-secret") ?? "";
  if (!headerSecret || !verifyWebhookSecret(headerSecret, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: TrackingPayload;
  try {
    const body = await req.json();
    payload = body as TrackingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required fields
  if (!payload.carrier || !payload.trackingNumber || !payload.status || !payload.timestamp) {
    return NextResponse.json(
      { error: "Missing required fields: carrier, trackingNumber, status, timestamp" },
      { status: 400 }
    );
  }

  if (!VALID_STATUSES.has(payload.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const result = await processTrackingUpdate(payload);
    if (!result) {
      return NextResponse.json({ ok: false, reason: "shipment_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, shipmentId: result.shipmentId });
  } catch (err) {
    console.error("[Tracking Webhook] Processing error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── Processing ──────────────────────────────────────────────────────────────

async function processTrackingUpdate(
  payload: TrackingPayload
): Promise<{ shipmentId: string } | null> {
  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");
  const { logAudit } = await import("@/lib/audit");

  // Get all active tenants
  const tenants = await publicDb.tenant.findMany({
    where: { status: "active" },
    select: { id: true, dbSchema: true },
  });

  // Search for the shipment across all tenants
  for (const tenant of tenants) {
    const db = getTenantDb(tenant.dbSchema);

    const shipment = await db.shipment.findFirst({
      where: { trackingNumber: payload.trackingNumber },
      include: { order: true },
    });

    if (!shipment) continue;

    // Map carrier status to shipment status
    const shipmentStatus = mapCarrierStatus(payload.status);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shipmentUpdate: Record<string, any> = { status: shipmentStatus };

    if (payload.status === "delivered") {
      shipmentUpdate.deliveredAt = new Date(payload.timestamp);
    }

    await db.shipment.update({
      where: { id: shipment.id },
      data: shipmentUpdate,
    });

    // On delivered: also update the order
    if (payload.status === "delivered" && shipment.order) {
      await db.order.update({
        where: { id: shipment.order.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: "delivered" as any,
          deliveredDate: new Date(payload.timestamp),
        },
      });
    }

    await logAudit(db, {
      userId: "webhook",
      action: "update",
      entityType: "shipment",
      entityId: shipment.id,
      changes: {
        status: { old: shipment.status, new: shipmentStatus },
        ...(payload.location ? { location: { old: null, new: payload.location } } : {}),
        source: { old: null, new: `tracking_webhook:${payload.carrier}` },
      },
    });

    return { shipmentId: shipment.id };
  }

  return null;
}

function mapCarrierStatus(status: TrackingPayload["status"]): string {
  switch (status) {
    case "in_transit":
      return "shipped";
    case "out_for_delivery":
      return "shipped";
    case "delivered":
      return "delivered";
    case "exception":
      return "shipped"; // Keep as shipped; the audit log captures the exception
  }
}
