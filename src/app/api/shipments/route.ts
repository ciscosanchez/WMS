import { NextRequest, NextResponse } from "next/server";
import { validateTenantApiKey } from "@/lib/integrations/dispatchpro/auth";
import { publicDb } from "@/lib/db/public-client";
import { getTenantDb } from "@/lib/db/tenant-client";

/**
 * POST /api/shipments
 * DispatchPro → WMS: acknowledge that a dispatch order was accepted.
 * Body: { tenantSlug, wmsOrderId, dispatchOrderId, status }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, wmsOrderId, dispatchOrderId } = body;

    if (!tenantSlug || !wmsOrderId) {
      return NextResponse.json({ error: "Missing tenantSlug or wmsOrderId" }, { status: 400 });
    }

    const tenant = await publicDb.tenant.findUnique({ where: { slug: tenantSlug, status: "active" } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    if (!validateTenantApiKey(request, tenantSlug, settings)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getTenantDb(tenant.dbSchema);
    const order = await db.order.findUnique({ where: { id: wmsOrderId } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Store dispatchOrderId in tags field (comma-separated) for now
    const existingTags = order.tags ? order.tags.split(",").filter(Boolean) : [];
    const dispatchTag = `dispatch:${dispatchOrderId}`;
    if (!existingTags.includes(dispatchTag)) {
      await db.order.update({
        where: { id: wmsOrderId },
        data: { tags: [...existingTags, dispatchTag].join(",") },
      });
    }

    return NextResponse.json({ success: true, wmsOrderId, dispatchOrderId });
  } catch (err) {
    console.error("[API /shipments] error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
