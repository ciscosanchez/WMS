/**
 * Tracking Auto-Update Cron Endpoint
 *
 * Called every hour by the Docker cron container.
 * Protected by CRON_SECRET env var.
 *
 * Queries all "shipped" shipments with tracking numbers,
 * checks carrier status, and marks "delivered" when appropriate.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!tenantSlug) {
    return NextResponse.json({ skipped: "No tenant slug configured" });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { UPSAdapter, FedExAdapter, USPSAdapter } = await import("@/lib/integrations/carriers");

    // Build available adapters from env vars
    const adapters: Record<string, { getTracking: (n: string) => Promise<{ status: string; deliveredAt?: Date | null }> }> = {};
    if (process.env.UPS_CLIENT_ID) {
      adapters["UPS"] = new UPSAdapter({
        accountNumber: process.env.UPS_ACCOUNT_NUMBER ?? "",
        clientId: process.env.UPS_CLIENT_ID ?? "",
        clientSecret: process.env.UPS_CLIENT_SECRET ?? "",
      });
    }
    if (process.env.FEDEX_CLIENT_ID) {
      adapters["FedEx"] = new FedExAdapter({
        clientId: process.env.FEDEX_CLIENT_ID ?? "",
        clientSecret: process.env.FEDEX_CLIENT_SECRET ?? "",
        accountNumber: process.env.FEDEX_ACCOUNT_NUMBER ?? "",
      });
    }
    if (process.env.USPS_CLIENT_ID) {
      adapters["USPS"] = new USPSAdapter({
        clientId: process.env.USPS_CLIENT_ID ?? "",
        clientSecret: process.env.USPS_CLIENT_SECRET ?? "",
      });
    }

    const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenantRecord) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const db = getTenantDb(tenantRecord.dbSchema);

    // Find all shipments that are "shipped" with a tracking number
    const shipments = await db.shipment.findMany({
      where: {
        status: "shipped",
        trackingNumber: { not: null },
        // Only check shipments from last 30 days (avoid polling ancient shipments)
        shippedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, trackingNumber: true, carrier: true, shipmentNumber: true },
    });

    if (shipments.length === 0) {
      return NextResponse.json({ checked: 0, delivered: 0 });
    }

    let checked = 0;
    let delivered = 0;
    let errors = 0;

    for (const shipment of shipments) {
      if (!shipment.carrier || !shipment.trackingNumber) continue;

      try {
        const adapter = adapters[shipment.carrier];
        if (!adapter) continue; // No adapter configured for this carrier

        const result = await adapter.getTracking(shipment.trackingNumber);
        checked++;

        if (result.status === "delivered") {
          await db.shipment.update({
            where: { id: shipment.id },
            data: {
              status: "delivered",
              deliveredAt: result.deliveredAt ?? new Date(),
            },
          });
          delivered++;
          console.log(`[Tracking Cron] Marked delivered: ${shipment.shipmentNumber} (${shipment.trackingNumber})`);
        }
      } catch (err) {
        errors++;
        console.error(`[Tracking Cron] Error checking ${shipment.shipmentNumber}:`, err);
      }
    }

    console.log(`[Tracking Cron] checked=${checked} delivered=${delivered} errors=${errors}`);
    return NextResponse.json({ checked, delivered, errors });
  } catch (err) {
    console.error("[Tracking Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
