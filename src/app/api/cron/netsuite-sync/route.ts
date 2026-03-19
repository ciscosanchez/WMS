/**
 * NetSuite Daily Sync Cron Endpoint
 *
 * Called daily at 3 AM by the Docker cron container.
 * Protected by CRON_SECRET env var.
 *
 * Pushes:
 *   1. Uninvoiced billing events → NetSuite invoices (for current month)
 *   2. Shipment fulfillments created today → NetSuite item fulfillments
 *
 * Silently skips if NETSUITE_* env vars are not configured.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getNetSuiteClient } = await import("@/lib/integrations/netsuite/client");
  const ns = getNetSuiteClient();
  if (!ns) {
    return NextResponse.json({ skipped: "NetSuite credentials not configured" });
  }

  const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!tenantSlug) {
    return NextResponse.json({ skipped: "No tenant slug configured" });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");

    const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenantRecord) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const db = getTenantDb(tenantRecord.dbSchema);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbAny = db as any;

    const results: Record<string, unknown> = {};

    // ── 1. Push uninvoiced billing events to NetSuite ─────────────────────────
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const clients = await dbAny.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    let invoicesPushed = 0;
    let invoiceErrors = 0;

    for (const client of clients) {
      const events = await dbAny.billingEvent.findMany({
        where: {
          clientId: client.id,
          invoiceId: null,
          occurredAt: { gte: monthStart, lte: now },
        },
      });

      if (events.length === 0) continue;

      try {
        const { invoiceId } = await ns.pushBillableEvents(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          events.map((e: any) => ({
            clientId: e.clientId,
            eventType: e.serviceType.split("_")[0] as "receiving" | "storage" | "handling" | "shipping" | "value_add",
            description: e.serviceType,
            quantity: Number(e.qty),
            unitRate: Number(e.unitRate),
            total: Number(e.amount),
            referenceType: e.referenceType ?? "billing_event",
            referenceId: e.referenceId ?? e.id,
            occurredAt: e.occurredAt,
          }))
        );

        // Mark events as synced to NetSuite (use referenceId to track)
        await dbAny.billingEvent.updateMany({
          where: { id: { in: events.map((e: any) => e.id) } }, // eslint-disable-line @typescript-eslint/no-explicit-any
          data: { referenceId: `netsuite:${invoiceId}` },
        });

        invoicesPushed++;
        console.log(`[NetSuite Cron] Pushed ${events.length} events for ${client.name} → NS invoice ${invoiceId}`);
      } catch (err) {
        invoiceErrors++;
        console.error(`[NetSuite Cron] Failed to push events for ${client.name}:`, err);
      }
    }

    results.billing = { invoicesPushed, invoiceErrors };

    // ── 2. Push today's shipments to NetSuite as item fulfillments ─────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const shippedToday = await db.shipment.findMany({
      where: {
        status: "shipped",
        shippedAt: { gte: todayStart },
        trackingNumber: { not: null },
      },
      include: { order: true },
    });

    let fulfillmentsPushed = 0;
    let fulfillmentErrors = 0;

    for (const shipment of shippedToday) {
      if (!shipment.order.externalId) continue; // No NetSuite order to fulfill

      try {
        await ns.pushShipmentFulfillment(
          shipment.order.externalId,
          shipment.trackingNumber!,
          shipment.carrier ?? "Unknown"
        );
        fulfillmentsPushed++;
      } catch (err) {
        fulfillmentErrors++;
        console.error(`[NetSuite Cron] Failed to push fulfillment ${shipment.shipmentNumber}:`, err);
      }
    }

    results.fulfillments = { fulfillmentsPushed, fulfillmentErrors };

    console.log("[NetSuite Cron] Complete:", results);
    return NextResponse.json(results);
  } catch (err) {
    console.error("[NetSuite Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
