/**
 * Audit Log Retention Cron Endpoint
 *
 * Called periodically (e.g. daily at 3 AM) by the Docker cron container.
 * Protected by CRON_SECRET env var.
 *
 * Iterates all active tenants and deletes audit_log entries older than
 * AUDIT_RETENTION_DAYS (default: 365 days).
 * Returns count of deleted records per tenant.
 */

import { NextRequest, NextResponse } from "next/server";

const DEFAULT_RETENTION_DAYS = 365;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { getActiveTenants } = await import("@/lib/integrations/tenant-connectors");

    const tenants = await getActiveTenants(publicDb);

    if (tenants.length === 0) {
      return NextResponse.json({ skipped: "No active tenants" });
    }

    const retentionDays = parseInt(
      process.env.AUDIT_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS),
      10
    );
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const results: Array<{
      tenant: string;
      deleted: number;
      error?: string;
    }> = [];

    for (const tenant of tenants) {
      try {
        const db = getTenantDb(tenant.dbSchema);

        const { count } = await db.auditLog.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
          },
        });

        console.log(
          `[Audit Retention Cron] ${tenant.slug}: deleted ${count} records older than ${retentionDays} days`
        );

        results.push({ tenant: tenant.slug, deleted: count });
      } catch (tenantErr) {
        const msg = tenantErr instanceof Error ? tenantErr.message : "Unknown error";
        console.error(`[Audit Retention Cron] Error processing tenant ${tenant.slug}:`, tenantErr);
        results.push({ tenant: tenant.slug, deleted: 0, error: msg });
      }
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    return NextResponse.json({
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      totalDeleted,
      tenants: results,
    });
  } catch (err) {
    console.error("[Audit Retention Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
