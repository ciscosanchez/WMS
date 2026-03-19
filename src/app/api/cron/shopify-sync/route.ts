/**
 * Shopify Auto-Sync Cron Endpoint
 *
 * Called by the Docker cron container every 15 minutes.
 * Protected by CRON_SECRET env var.
 *
 * Syncs unfulfilled Shopify orders into WMS for all active tenants
 * that have Shopify credentials configured.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Verify the cron secret
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only run if Shopify is configured
  if (!process.env.SHOPIFY_SHOP_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) {
    return NextResponse.json({ skipped: "No Shopify credentials" });
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

    const tenantDb = getTenantDb(tenantRecord.dbSchema);

    // Find Armstrong client
    const clientCode = process.env.SHOPIFY_WMS_CLIENT_CODE ?? "Armstrong";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = await (tenantDb as any).client.findFirst({
      where: { code: clientCode, isActive: true },
    });
    if (!client) {
      return NextResponse.json({ error: `Client '${clientCode}' not found` }, { status: 404 });
    }

    // Find or create Shopify sales channel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel = await (tenantDb as any).salesChannel.findFirst({
      where: { type: "shopify", isActive: true },
    });
    if (!channel) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel = await (tenantDb as any).salesChannel.create({
        data: {
          name: "Shopify",
          type: "shopify",
          isActive: true,
          config: { shopDomain: process.env.SHOPIFY_SHOP_DOMAIN },
        },
      });
    }

    const { getShopifyAdapter } = await import("@/lib/integrations/marketplaces/shopify");
    const { nextSequence } = await import("@/lib/sequences");
    const { logAudit } = await import("@/lib/audit");

    const adapter = getShopifyAdapter();
    const since = new Date();
    since.setDate(since.getDate() - 1); // Last 24 hours for cron (webhook catches real-time)
    const shopifyOrders = await adapter.fetchOrders(since);

    if (shopifyOrders.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0 });
    }

    // Deduplicate
    const externalIds = shopifyOrders.map((o) => o.externalId);
    const existing = await tenantDb.order.findMany({
      where: { externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const existingIds = new Set(existing.map((o) => o.externalId));

    // Resolve SKUs
    const skus = [...new Set(shopifyOrders.flatMap((o) => o.lineItems.map((li) => li.sku).filter(Boolean)))] as string[];
    const products = skus.length > 0
      ? await tenantDb.product.findMany({
          where: { clientId: client.id, sku: { in: skus } },
          select: { id: true, sku: true, imageUrl: true, weight: true },
        })
      : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productBySku = new Map(products.map((p: any) => [p.sku, p]));

    let imported = 0;
    let skipped = 0;

    for (const so of shopifyOrders) {
      if (existingIds.has(so.externalId)) { skipped++; continue; }

      const resolvedLines = so.lineItems
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((li) => ({ productId: (productBySku.get(li.sku) as any)?.id, quantity: li.quantity, uom: "EA", unitPrice: li.unitPrice }))
        .filter((li) => li.productId != null);

      if (resolvedLines.length === 0) { skipped++; continue; }

      // Enrich products
      for (const li of so.lineItems) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const product = productBySku.get(li.sku) as any;
        if (!product) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: Record<string, any> = {};
        if (li.imageUrl && !product.imageUrl) updates.imageUrl = li.imageUrl;
        if (li.weightGrams && li.weightGrams > 0 && !product.weight) {
          updates.weight = parseFloat((li.weightGrams / 453.592).toFixed(4));
          updates.weightUnit = "lb";
        }
        if (Object.keys(updates).length > 0) {
          await tenantDb.product.update({ where: { id: product.id }, data: updates });
        }
      }

      const orderNumber = await nextSequence(tenantDb, "ORD");
      const addr = so.shipTo;
      const created = await tenantDb.order.create({
        data: {
          orderNumber, externalId: so.externalId, channelId: channel.id, clientId: client.id,
          status: "pending", priority: so.priority as "standard" | "expedited" | "rush" | "same_day",
          shipToName: addr.name, shipToAddress1: addr.address1, shipToAddress2: addr.address2 ?? null,
          shipToCity: addr.city, shipToState: addr.state ?? null, shipToZip: addr.zip,
          shipToCountry: addr.country ?? "US", shipToPhone: addr.phone ?? null, shipToEmail: addr.email ?? null,
          shippingMethod: so.shippingMethod ?? null, orderDate: so.orderDate, notes: so.notes ?? null,
          totalItems: resolvedLines.reduce((s, li) => s + li.quantity, 0),
          lines: { create: resolvedLines },
        },
      });

      await logAudit(tenantDb, {
        userId: "cron",
        action: "create",
        entityType: "order",
        entityId: created.id,
        changes: { source: { old: null, new: "shopify_cron" } },
      });

      imported++;
    }

    console.log(`[Shopify Cron] imported=${imported} skipped=${skipped}`);
    return NextResponse.json({ imported, skipped });
  } catch (err) {
    console.error("[Shopify Cron] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
