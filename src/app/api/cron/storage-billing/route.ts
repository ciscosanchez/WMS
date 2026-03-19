/**
 * Storage Billing Cron Endpoint
 *
 * Called daily by the Docker cron container (e.g. 2 AM).
 * Protected by CRON_SECRET env var.
 *
 * Captures storage_pallet billing events for every active client
 * based on occupied bin positions in the current inventory.
 * One event per client per day — idempotent via referenceId check.
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
    const { captureEvent } = await import("@/modules/billing/capture");

    const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenantRecord) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const db = getTenantDb(tenantRecord.dbSchema);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbAny = db as any;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateKey = today.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const referenceId = `storage-daily-${dateKey}`;

    // Idempotency: skip if already captured today
    const alreadyCaptured = await dbAny.billingEvent.findFirst({
      where: { serviceType: "storage_pallet", referenceId },
    });
    if (alreadyCaptured) {
      return NextResponse.json({ skipped: "Already captured today", date: dateKey });
    }

    // Get all active clients
    const clients = await dbAny.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const results: Array<{ clientId: string; name: string; pallets: number; captured: boolean }> = [];

    for (const client of clients) {
      // Count bins with inventory for this client (proxy for pallets occupied)
      const occupiedBins = await dbAny.inventory.count({
        where: {
          product: { clientId: client.id },
          onHand: { gt: 0 },
        },
      });

      if (occupiedBins === 0) {
        results.push({ clientId: client.id, name: client.name, pallets: 0, captured: false });
        continue;
      }

      const event = await captureEvent(db, {
        clientId: client.id,
        serviceType: "storage_pallet",
        qty: occupiedBins,
        referenceType: "storage_snapshot",
        referenceId,
      });

      results.push({
        clientId: client.id,
        name: client.name,
        pallets: occupiedBins,
        captured: !!event,
      });
    }

    console.log(`[Storage Billing Cron] date=${dateKey}`, results);
    return NextResponse.json({ date: dateKey, clients: results });
  } catch (err) {
    console.error("[Storage Billing Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
