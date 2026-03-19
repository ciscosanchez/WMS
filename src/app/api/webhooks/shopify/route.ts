/**
 * Shopify Webhook Receiver
 *
 * Verifies HMAC-SHA256 signature, then handles:
 * - orders/create  → import new order into WMS
 * - orders/updated → update status if relevant
 * - orders/cancelled → mark WMS order cancelled
 *
 * Register via Shopify Admin → Settings → Notifications → Webhooks
 * or via API: POST /admin/api/2026-01/webhooks.json
 *
 * Webhook URL: https://wms.ramola.app/api/webhooks/shopify
 * Secret:     SHOPIFY_WEBHOOK_SECRET env var
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getShopifyAdapter } from "@/lib/integrations/marketplaces/shopify";
import { nextSequence } from "@/lib/sequences";
import { logAudit } from "@/lib/audit";

// ─── Signature verification ──────────────────────────────────────────────────

function verifyShopifyHmac(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false; // If no secret configured, skip verification in dev
  const computed = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shopDomain = req.headers.get("x-shopify-shop-domain") ?? "";

  // Verify signature (skip if SHOPIFY_WEBHOOK_SECRET not set — dev/test only)
  if (process.env.SHOPIFY_WEBHOOK_SECRET && !verifyShopifyHmac(body, hmacHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate the shop domain matches our configured store
  const configuredDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  if (configuredDomain && shopDomain && shopDomain !== configuredDomain) {
    return NextResponse.json({ error: "Unknown shop" }, { status: 404 });
  }

  // Route by topic
  try {
    switch (topic) {
      case "orders/create":
        await handleOrderCreate(payload);
        break;
      case "orders/cancelled":
        await handleOrderCancelled(payload);
        break;
      case "orders/updated":
        // Only care about fulfilment status changes we didn't trigger
        await handleOrderUpdated(payload);
        break;
      default:
        // Unknown topic — acknowledge and ignore
        break;
    }
  } catch (err) {
    console.error(`[Shopify Webhook] ${topic} handler error:`, err);
    // Return 200 so Shopify doesn't retry indefinitely
  }

  return NextResponse.json({ ok: true });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCreate(order: any) {
  // Only import unfulfilled orders
  if (order.fulfillment_status && order.fulfillment_status !== null) return;
  if (order.financial_status === "pending") return; // Not paid yet

  // Use a system user ID for webhook-triggered imports
  // We need a tenant DB. For now we use env var to identify the tenant.
  const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!tenantSlug) {
    console.warn("[Shopify Webhook] ARMSTRONG_TENANT_SLUG not set — cannot import order");
    return;
  }

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");

  const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenantRecord) return;

  const tenantDb = getTenantDb(tenantRecord.dbSchema);

  const externalId = String(order.id);

  // Skip if already imported
  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (existing) return;

  // Find the Shopify sales channel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channel = await (tenantDb as any).salesChannel.findFirst({
    where: { type: "shopify", isActive: true },
  });
  if (!channel) return;

  // Find the client — prefer SHOPIFY_WMS_CLIENT_CODE env var, fall back to first active
  const clientCode = process.env.SHOPIFY_WMS_CLIENT_CODE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = await (tenantDb as any).client.findFirst({
    where: clientCode ? { code: clientCode, isActive: true } : { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!client) return;

  // Map Shopify order to WMS order using the adapter's mapper
  const adapter = getShopifyAdapter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (adapter as any).mapOrder(order);

  // Resolve SKUs to products
  const skus = mapped.lineItems.map((li: { sku: string }) => li.sku).filter(Boolean);
  const products = skus.length > 0
    ? await tenantDb.product.findMany({
        where: { clientId: client.id, sku: { in: skus } },
        select: { id: true, sku: true, imageUrl: true, weight: true },
      })
    : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productBySku = new Map(products.map((p: any) => [p.sku, p]));

  // Enrich product records with Shopify data (image, weight) if fields are blank
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCancelled(order: any) {
  const externalId = String(order.id);
  const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!tenantSlug) return;

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");
  const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenantRecord) return;
  const tenantDb = getTenantDb(tenantRecord.dbSchema);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderUpdated(order: any) {
  // Only act if the order became fully fulfilled externally (outside WMS)
  if (order.fulfillment_status !== "fulfilled") return;

  const externalId = String(order.id);
  const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!tenantSlug) return;

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");
  const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenantRecord) return;
  const tenantDb = getTenantDb(tenantRecord.dbSchema);

  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (!existing) return;
  if (existing.status === "shipped" || existing.status === "delivered") return;

  await tenantDb.order.update({
    where: { id: existing.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: "shipped" as any, shippedDate: new Date() },
  });
}
