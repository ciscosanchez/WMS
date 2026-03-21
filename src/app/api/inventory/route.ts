import { NextRequest, NextResponse } from "next/server";
import { validateTenantApiKey } from "@/lib/integrations/dispatchpro/auth";
import { publicDb } from "@/lib/db/public-client";
import { getTenantDb } from "@/lib/db/tenant-client";

/**
 * GET /api/inventory
 * DispatchPro → WMS: query available inventory levels.
 *
 * Query params:
 *   tenantSlug  (required)
 *   sku         (optional — filter by SKU)
 *   clientId    (optional — filter by client)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug");
    const sku = searchParams.get("sku") ?? undefined;
    const clientId = searchParams.get("clientId") ?? undefined;

    if (!tenantSlug) {
      return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
    }

    const tenant = await publicDb.tenant.findUnique({ where: { slug: tenantSlug, status: "active" } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    // Validate API key is authorized for this specific tenant
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    if (!validateTenantApiKey(request, tenantSlug, settings)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getTenantDb(tenant.dbSchema);

    const inventory = await db.inventory.findMany({
      where: {
        ...(sku ? { product: { sku } } : {}),
        ...(clientId ? { product: { clientId } } : {}),
      },
      include: {
        product: { select: { sku: true, name: true, clientId: true } },
        bin: { select: { code: true } },
      },
    });

    const result = inventory.map((inv) => ({
      productId: inv.productId,
      sku: inv.product.sku,
      name: inv.product.name,
      clientId: inv.product.clientId,
      bin: inv.bin?.code ?? null,
      availableQty: inv.available,
      onHandQty: inv.onHand,
      allocatedQty: inv.allocated,
      lotNumber: inv.lotNumber ?? null,
    }));

    return NextResponse.json({ inventory: result, count: result.length });
  } catch (err) {
    console.error("[API /inventory] error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
