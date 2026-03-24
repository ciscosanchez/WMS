/**
 * Shopify Webhook Receiver
 *
 * Verifies HMAC-SHA256 signature, then handles:
 * - orders/create  → import new order into WMS
 * - orders/updated → update status if relevant
 * - orders/cancelled → mark WMS order cancelled
 *
 * Multi-tenant: resolves the target tenant by matching the incoming
 * x-shopify-shop-domain against SalesChannel configs across all tenants.
 * Falls back to ARMSTRONG_TENANT_SLUG env var for legacy single-tenant.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { nextSequence } from "@/lib/sequences";
import { logAudit } from "@/lib/audit";

// ─── Signature verification ──────────────────────────────────────────────────

function verifyShopifyHmac(body: string, hmacHeader: string, secret: string): boolean {
  const computed = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const a = Buffer.from(computed);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shopDomain = req.headers.get("x-shopify-shop-domain") ?? "";

  // Verify signature — fail closed: require secret to be configured
  if (
    !process.env.SHOPIFY_WEBHOOK_SECRET ||
    !verifyShopifyHmac(body, hmacHeader, process.env.SHOPIFY_WEBHOOK_SECRET)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Route by topic — tenant resolution is inside try so DB errors are caught
  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { resolveShopifyTenant } = await import("@/lib/integrations/tenant-connectors");

    const connector = await resolveShopifyTenant(publicDb, getTenantDb, shopDomain);

    if (!connector) {
      // Legacy fallback: if shop domain matches the global env var, use ARMSTRONG_TENANT_SLUG
      const configuredDomain = process.env.SHOPIFY_SHOP_DOMAIN;
      if (!shopDomain || !configuredDomain || shopDomain !== configuredDomain) {
        return NextResponse.json({ error: "Unknown shop" }, { status: 404 });
      }
    }

    switch (topic) {
      case "orders/create":
        await handleOrderCreate(payload, connector, shopDomain);
        break;
      case "orders/cancelled":
        await handleOrderCancelled(payload, connector, shopDomain);
        break;
      case "orders/updated":
        await handleOrderUpdated(payload, connector, shopDomain);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[Shopify Webhook] ${topic} handler error:`, err);
  }

  return NextResponse.json({ ok: true });
}

// ─── Tenant resolution helper ────────────────────────────────────────────────

async function resolveTenantDb(
  connector: Awaited<
    ReturnType<typeof import("@/lib/integrations/tenant-connectors").resolveShopifyTenant>
  > | null,
  _shopDomain: string
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  clientCode: string;
} | null> {
  if (connector) {
    return { db: connector.db, clientCode: connector.clientCode };
  }

  // Legacy fallback
  const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!tenantSlug) return null;

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");

  const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenantRecord) return null;

  return {
    db: getTenantDb(tenantRecord.dbSchema),
    clientCode: process.env.SHOPIFY_WMS_CLIENT_CODE ?? "Armstrong",
  };
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleOrderCreate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any,
  connector: Awaited<
    ReturnType<typeof import("@/lib/integrations/tenant-connectors").resolveShopifyTenant>
  > | null,
  shopDomain: string
) {
  if (order.fulfillment_status && order.fulfillment_status !== null) return;
  if (order.financial_status === "pending") return;

  const resolved = await resolveTenantDb(connector, shopDomain);
  if (!resolved) {
    console.warn("[Shopify Webhook] Could not resolve tenant — cannot import order");
    return;
  }

  const { db: tenantDb, clientCode } = resolved;

  const externalId = String(order.id);

  // Skip if already imported
  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (existing) return;

  // Find the Shopify sales channel
  const channel = await tenantDb.salesChannel.findFirst({
    where: { type: "shopify", isActive: true },
  });
  if (!channel) return;

  // Find the client
  const client = await tenantDb.client.findFirst({
    where: clientCode ? { code: clientCode, isActive: true } : { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!client) return;

  // Build adapter from connector credentials or env vars
  const { ShopifyAdapter } = await import("@/lib/integrations/marketplaces/shopify");
  const adapter = connector
    ? new ShopifyAdapter({
        shopDomain: connector.shopDomain,
        accessToken: connector.accessToken,
        apiVersion: connector.apiVersion,
        locationId: connector.locationId,
      })
    : new ShopifyAdapter({
        shopDomain: process.env.SHOPIFY_SHOP_DOMAIN!,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN!,
        apiVersion: process.env.SHOPIFY_API_VERSION ?? "2026-01",
      });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (adapter as any).mapOrder(order);

  // Resolve SKUs to products
  const skus = mapped.lineItems.map((li: { sku: string }) => li.sku).filter(Boolean);
  const products =
    skus.length > 0
      ? await tenantDb.product.findMany({
          where: { clientId: client.id, sku: { in: skus } },
          select: { id: true, sku: true, imageUrl: true, weight: true },
        })
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productBySku = new Map(products.map((p: any) => [p.sku, p]));

  // Enrich product records
  for (const li of mapped.lineItems) {
    if (!li.sku) continue;
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

  const resolvedLines = mapped.lineItems
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((li: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productId: (productBySku.get(li.sku) as any)?.id,
      quantity: li.quantity,
      uom: "EA",
      unitPrice: li.unitPrice ?? null,
    }))
    .filter((li: { productId: string | undefined }) => li.productId != null);

  if (resolvedLines.length === 0) return;

  const orderNumber = await nextSequence(tenantDb, "ORD");
  const addr = mapped.shipTo;
  const created = await tenantDb.order.create({
    data: {
      orderNumber,
      externalId,
      channelId: channel.id,
      clientId: client.id,
      status: "pending",
      priority: mapped.priority,
      shipToName: addr.name,
      shipToAddress1: addr.address1,
      shipToAddress2: addr.address2 ?? null,
      shipToCity: addr.city,
      shipToState: addr.state ?? null,
      shipToZip: addr.zip,
      shipToCountry: addr.country ?? "US",
      shipToPhone: addr.phone ?? null,
      shipToEmail: addr.email ?? null,
      shippingMethod: mapped.shippingMethod ?? null,
      orderDate: mapped.orderDate,
      notes: mapped.notes ?? null,
      totalItems: resolvedLines.reduce((s: number, li: { quantity: number }) => s + li.quantity, 0),
      lines: { create: resolvedLines },
    },
  });

  await logAudit(tenantDb, {
    userId: "webhook",
    action: "create",
    entityType: "order",
    entityId: created.id,
    changes: { source: { old: null, new: "shopify_webhook" } },
  });
}

async function handleOrderCancelled(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any,
  connector: Awaited<
    ReturnType<typeof import("@/lib/integrations/tenant-connectors").resolveShopifyTenant>
  > | null,
  shopDomain: string
) {
  const resolved = await resolveTenantDb(connector, shopDomain);
  if (!resolved) return;

  const { db: tenantDb } = resolved;
  const externalId = String(order.id);

  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (!existing) return;
  if (existing.status === "shipped" || existing.status === "delivered") return;

  await tenantDb.order.update({
    where: { id: existing.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: "cancelled" as any, cancelledDate: new Date() },
  });

  await logAudit(tenantDb, {
    userId: "webhook",
    action: "update",
    entityType: "order",
    entityId: existing.id,
    changes: { status: { old: existing.status, new: "cancelled" } },
  });
}

async function handleOrderUpdated(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any,
  connector: Awaited<
    ReturnType<typeof import("@/lib/integrations/tenant-connectors").resolveShopifyTenant>
  > | null,
  shopDomain: string
) {
  if (order.fulfillment_status !== "fulfilled") return;

  const resolved = await resolveTenantDb(connector, shopDomain);
  if (!resolved) return;

  const { db: tenantDb } = resolved;
  const externalId = String(order.id);

  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (!existing) return;
  if (existing.status === "shipped" || existing.status === "delivered") return;

  await tenantDb.order.update({
    where: { id: existing.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: "shipped" as any, shippedDate: new Date() },
  });
}
