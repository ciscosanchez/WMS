/**
 * NetSuite Daily Sync Cron Endpoint
 *
 * Called daily at 3 AM by the Docker cron container.
 * Protected by CRON_SECRET env var.
 *
 * Iterates ALL active tenants and pushes:
 *   1. Uninvoiced billing events → NetSuite invoices (for current month)
 *   2. Shipment fulfillments created today → NetSuite item fulfillments
 *
 * Only processes tenants that have NetSuite credentials configured
 * (via Tenant.settings.netsuite or env vars for legacy).
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
    const { getNetSuiteClient } = await import("@/lib/integrations/netsuite/client");

    const tenants = await getActiveTenants(publicDb);

    if (tenants.length === 0) {
      return NextResponse.json({ skipped: "No active tenants" });
    }

    const tenantResults: Array<{
      tenant: string;
      billing: { invoicesPushed: number; invoiceErrors: number };
      fulfillments: { fulfillmentsPushed: number; fulfillmentErrors: number };
    }> = [];

    for (const tenant of tenants) {
      // Check if NetSuite is configured for this tenant
      // For now: use global env vars (legacy), or per-tenant settings.netsuite
      const nsSettings = (tenant.settings as Record<string, unknown>).netsuite as
        | Record<string, string>
        | undefined;
      const ns = nsSettings
        ? getNetSuiteClient(nsSettings)
        : tenant.slug === process.env.ARMSTRONG_TENANT_SLUG
          ? getNetSuiteClient()
          : null;

      if (!ns) continue;

      const db = getTenantDb(tenant.dbSchema);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbAny = db as any;

      try {
        const results: {
          billing: { invoicesPushed: number; invoiceErrors: number };
          fulfillments: { fulfillmentsPushed: number; fulfillmentErrors: number };
        } = {
          billing: { invoicesPushed: 0, invoiceErrors: 0 },
          fulfillments: { fulfillmentsPushed: 0, fulfillmentErrors: 0 },
        };

        // ── 1. Push uninvoiced billing events ──────────────────────────────
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const clients = await dbAny.client.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        });

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
                eventType: e.serviceType.split("_")[0] as
                  | "receiving"
                  | "storage"
                  | "handling"
                  | "shipping"
                  | "value_add",
                description: e.serviceType,
                quantity: Number(e.qty),
                unitRate: Number(e.unitRate),
                total: Number(e.amount),
                referenceType: e.referenceType ?? "billing_event",
                referenceId: e.referenceId ?? e.id,
                occurredAt: e.occurredAt,
              }))
            );

            await dbAny.billingEvent.updateMany({
              where: { id: { in: events.map((e: any) => e.id) } }, // eslint-disable-line @typescript-eslint/no-explicit-any
              data: { referenceId: `netsuite:${invoiceId}` },
            });

            results.billing.invoicesPushed++;
            console.warn(
              `[NetSuite Cron] ${tenant.slug}: Pushed ${events.length} events for ${client.name} → NS invoice ${invoiceId}`
            );
          } catch (err) {
            results.billing.invoiceErrors++;
            console.error(
              `[NetSuite Cron] ${tenant.slug}: Failed to push events for ${client.name}:`,
              err
            );
          }
        }

        // ── 2. Push today's shipments as item fulfillments ─────────────────
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

        for (const shipment of shippedToday) {
          if (!shipment.order.externalId) continue;

          try {
            await ns.pushShipmentFulfillment(
              shipment.order.externalId,
              shipment.trackingNumber!,
              shipment.carrier ?? "Unknown"
            );
            results.fulfillments.fulfillmentsPushed++;
          } catch (err) {
            results.fulfillments.fulfillmentErrors++;
            console.error(
              `[NetSuite Cron] ${tenant.slug}: Failed to push fulfillment ${shipment.shipmentNumber}:`,
              err
            );
          }
        }

        console.warn(`[NetSuite Cron] ${tenant.slug}: Complete:`, results);
        tenantResults.push({ tenant: tenant.slug, ...results });
      } catch (tenantErr) {
        console.error(`[NetSuite Cron] Error processing tenant ${tenant.slug}:`, tenantErr);
      }
    }

    return NextResponse.json({ tenants: tenantResults });
  } catch (err) {
    console.error("[NetSuite Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
