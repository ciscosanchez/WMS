/**
 * Scheduled Reports Cron Endpoint
 *
 * Called daily by the cron scheduler.
 * Protected by CRON_SECRET (HMAC or legacy).
 *
 * Triggers a daily inventory summary report per active tenant by
 * queuing a job on the existing reportQueue. The report worker
 * generates a CSV and emails it to the tenant's admin contacts.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/security/cron-auth";

/**
 * In-memory scheduled report definitions.
 * In a future iteration these could live in the database.
 */
const SCHEDULED_REPORTS = [
  {
    id: "daily_inventory_summary",
    name: "Daily Inventory Summary",
    frequency: "daily" as const,
    reportType: "inventory_summary",
  },
];

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getActiveTenants } = await import("@/lib/integrations/tenant-connectors");
    const { reportQueue } = await import("@/lib/jobs/queue");

    const tenants = await getActiveTenants(publicDb);

    if (tenants.length === 0) {
      return NextResponse.json({ skipped: "No active tenants" });
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const summary: Array<{ tenant: string; reportsQueued: number }> = [];

    for (const tenant of tenants) {
      let reportsQueued = 0;

      for (const report of SCHEDULED_REPORTS) {
        try {
          await reportQueue.add(`${report.id}_${tenant.slug}`, {
            reportType: report.reportType,
            reportName: report.name,
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            dbSchema: tenant.dbSchema,
            dateKey,
          });
          reportsQueued++;
        } catch (queueErr) {
          console.error(
            `[Scheduled Reports] Failed to queue ${report.id} for ${tenant.slug}:`,
            queueErr
          );
        }
      }

      console.warn(`[Scheduled Reports] ${tenant.slug}: ${reportsQueued} reports queued`);
      summary.push({ tenant: tenant.slug, reportsQueued });
    }

    return NextResponse.json({ date: dateKey, summary });
  } catch (err) {
    console.error("[Scheduled Reports] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
