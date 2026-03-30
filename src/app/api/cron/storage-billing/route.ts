/**
 * Storage Billing Cron Endpoint
 *
 * Called daily by the Docker cron container (e.g. 2 AM).
 * Protected by CRON_SECRET env var.
 *
 * Iterates ALL active tenants and captures storage_pallet billing events
 * for every active client based on occupied bin positions.
 * One event per client per day — idempotent via referenceId check.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/security/cron-auth";

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { getActiveTenants } = await import("@/lib/integrations/tenant-connectors");
    const { captureEvent } = await import("@/modules/billing/capture");

    const tenants = await getActiveTenants(publicDb);

    if (tenants.length === 0) {
      return NextResponse.json({ skipped: "No active tenants" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateKey = today.toISOString().slice(0, 10);
    const referenceId = `storage-daily-${dateKey}`;

    const tenantResults: Array<{
      tenant: string;
      clients: Array<{ clientId: string; name: string; pallets: number; captured: boolean }>;
    }> = [];

    for (const tenant of tenants) {
      const db = getTenantDb(tenant.dbSchema);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbAny = db as any;

      try {
        // Note: idempotency is checked per-client below, not per-tenant,
        // so partial re-runs (e.g. after a mid-loop crash) only skip clients
        // that were already captured — not the entire tenant.

        const clients = await dbAny.client.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        });

        const clientResults: Array<{
          clientId: string;
          name: string;
          pallets: number;
          captured: boolean;
        }> = [];

        for (const client of clients) {
          const occupiedBins = await dbAny.inventory.count({
            where: {
              product: { clientId: client.id },
              onHand: { gt: 0 },
            },
          });

          if (occupiedBins === 0) {
            clientResults.push({
              clientId: client.id,
              name: client.name,
              pallets: 0,
              captured: false,
            });
            continue;
          }

          // Per-client idempotency: skip if this client already has a storage event for today
          const clientRefId = `${referenceId}-${client.id}`;
          const alreadyCaptured = await dbAny.billingEvent.findFirst({
            where: {
              serviceType: "storage_pallet",
              referenceId: clientRefId,
              clientId: client.id,
            },
          });
          if (alreadyCaptured) {
            clientResults.push({
              clientId: client.id,
              name: client.name,
              pallets: occupiedBins,
              captured: true,
            });
            continue;
          }

          const event = await captureEvent(db, {
            clientId: client.id,
            serviceType: "storage_pallet",
            qty: occupiedBins,
            referenceType: "storage_snapshot",
            referenceId: clientRefId,
          });

          clientResults.push({
            clientId: client.id,
            name: client.name,
            pallets: occupiedBins,
            captured: !!event,
          });
        }

        console.warn(`[Storage Billing Cron] ${tenant.slug} date=${dateKey}`, clientResults);
        tenantResults.push({ tenant: tenant.slug, clients: clientResults });
      } catch (tenantErr) {
        console.error(`[Storage Billing Cron] Error processing tenant ${tenant.slug}:`, tenantErr);
      }
    }

    return NextResponse.json({ date: dateKey, tenants: tenantResults });
  } catch (err) {
    console.error("[Storage Billing Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
