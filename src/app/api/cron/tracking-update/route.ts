/**
 * Tracking Auto-Update Cron Endpoint
 *
 * Called every hour by the Docker cron container.
 * Protected by CRON_SECRET env var.
 *
 * Iterates ALL active tenants, queries "shipped" shipments with tracking
 * numbers, checks carrier status, and marks "delivered" when appropriate.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { getActiveTenants, getCarrierCredentials } =
      await import("@/lib/integrations/tenant-connectors");
    const { UPSAdapter, FedExAdapter, USPSAdapter } = await import("@/lib/integrations/carriers");

    const tenants = await getActiveTenants(publicDb);

    if (tenants.length === 0) {
      return NextResponse.json({ skipped: "No active tenants" });
    }

    const tenantResults: Array<{
      tenant: string;
      checked: number;
      delivered: number;
      errors: number;
    }> = [];

    for (const tenant of tenants) {
      const db = getTenantDb(tenant.dbSchema);

      try {
        // Build adapters from per-tenant credentials
        const creds = getCarrierCredentials(tenant);
        const adapters: Record<
          string,
          { getTracking: (n: string) => Promise<{ status: string; deliveredAt?: Date | null }> }
        > = {};

        if (creds.ups) adapters["UPS"] = new UPSAdapter(creds.ups);
        if (creds.fedex) adapters["FedEx"] = new FedExAdapter(creds.fedex);
        if (creds.usps) adapters["USPS"] = new USPSAdapter(creds.usps);

        if (Object.keys(adapters).length === 0) continue; // No carrier adapters configured

        const shipments = await db.shipment.findMany({
          where: {
            status: "shipped",
            trackingNumber: { not: null },
            shippedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          select: { id: true, trackingNumber: true, carrier: true, shipmentNumber: true },
        });

        if (shipments.length === 0) {
          tenantResults.push({ tenant: tenant.slug, checked: 0, delivered: 0, errors: 0 });
          continue;
        }

        let checked = 0;
        let delivered = 0;
        let errors = 0;

        for (const shipment of shipments) {
          if (!shipment.carrier || !shipment.trackingNumber) continue;

          try {
            const adapter = adapters[shipment.carrier];
            if (!adapter) continue;

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
              console.log(
                `[Tracking Cron] ${tenant.slug}: Marked delivered: ${shipment.shipmentNumber} (${shipment.trackingNumber})`
              );
            }
          } catch (err) {
            errors++;
            console.error(
              `[Tracking Cron] ${tenant.slug}: Error checking ${shipment.shipmentNumber}:`,
              err
            );
          }
        }

        console.log(
          `[Tracking Cron] ${tenant.slug}: checked=${checked} delivered=${delivered} errors=${errors}`
        );
        tenantResults.push({ tenant: tenant.slug, checked, delivered, errors });
      } catch (tenantErr) {
        console.error(`[Tracking Cron] Error processing tenant ${tenant.slug}:`, tenantErr);
      }
    }

    return NextResponse.json({ tenants: tenantResults });
  } catch (err) {
    console.error("[Tracking Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
