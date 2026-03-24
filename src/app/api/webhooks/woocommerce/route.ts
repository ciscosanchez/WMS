/**
 * WooCommerce Webhook Receiver
 *
 * Verifies HMAC-SHA256 signature, then handles:
 * - order.created  → import new order into WMS
 * - order.updated  → update status if relevant
 *
 * Multi-tenant: resolves the target tenant by matching the incoming
 * store URL (from x-wc-webhook-source) against SalesChannel configs.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { nextSequence } from "@/lib/sequences";
import { logAudit } from "@/lib/audit";

// ─── Signature verification ──────────────────────────────────────────────────

export function verifyWooCommerceHmac(
  body: string,
  signatureHeader: string,
  secret: string
): boolean {
  const computed = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const a = Buffer.from(computed);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-wc-webhook-signature") ?? "";
  const topic = req.headers.get("x-wc-webhook-topic") ?? "";
  const source = req.headers.get("x-wc-webhook-source") ?? "";

  // Verify signature — fail closed
  if (
    !process.env.WOOCOMMERCE_WEBHOOK_SECRET ||
    !verifyWooCommerceHmac(body, signature, process.env.WOOCOMMERCE_WEBHOOK_SECRET)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");

    const connector = await resolveWooCommerceTenant(publicDb, getTenantDb, source);

    if (!connector) {
      // Legacy fallback
      const configuredUrl = process.env.WOOCOMMERCE_STORE_URL;
      if (!source || !configuredUrl || normaliseUrl(source) !== normaliseUrl(configuredUrl)) {
        return NextResponse.json({ error: "Unknown store" }, { status: 404 });
      }
    }

    switch (topic) {
      case "order.created":
        await handleOrderCreate(payload, connector, source);
        break;
      case "order.updated":
        await handleOrderUpdated(payload, connector, source);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[WooCommerce Webhook] ${topic} handler error:`, err);
  }

  return NextResponse.json({ ok: true });
}

// ─── URL normalisation ───────────────────────────────────────────────────────

function normaliseUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

// ─── Tenant resolution ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveWooCommerceTenant(publicDb: any, getTenantDb: any, sourceUrl: string) {
  const tenants = await publicDb.tenant.findMany({ where: { isActive: true } });

  for (const tenant of tenants) {
    const db = getTenantDb(tenant.dbSchema);
    const channel = await db.salesChannel.findFirst({
      where: { type: "woocommerce", isActive: true },
    });
    if (!channel) continue;

    const config = (channel.config ?? {}) as Record<string, string>;
    const storeUrl = config.storeUrl;
    if (!storeUrl) continue;

    if (normaliseUrl(storeUrl) === normaliseUrl(sourceUrl)) {
      return {
        db,
        clientCode: config.clientCode ?? tenant.slug,
        storeUrl,
        consumerKey: config.consumerKey ?? "",
        consumerSecret: config.consumerSecret ?? "",
      };
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveTenantDb(connector: any, _source: string) {
  if (connector) {
    return { db: connector.db, clientCode: connector.clientCode };
  }

  const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!tenantSlug) return null;

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");

  const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenantRecord) return null;

  return {
    db: getTenantDb(tenantRecord.dbSchema),
    clientCode: process.env.WOOCOMMERCE_WMS_CLIENT_CODE ?? "Armstrong",
  };
}

// ─── Event handlers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCreate(order: any, connector: any, source: string) {
  const status = order.status as string | undefined;
  if (status && status !== "processing" && status !== "on-hold") return;

  const resolved = await resolveTenantDb(connector, source);
  if (!resolved) {
    console.warn("[WooCommerce Webhook] Could not resolve tenant — cannot import order");
    return;
  }

  const { db: tenantDb, clientCode } = resolved;
  const externalId = String(order.id);

  // Skip if already imported
  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (existing) return;

  const channel = await tenantDb.salesChannel.findFirst({
    where: { type: "woocommerce", isActive: true },
  });
  if (!channel) return;

  const client = await tenantDb.client.findFirst({
    where: clientCode ? { code: clientCode, isActive: true } : { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!client) return;

  const { WooCommerceAdapter } = await import("@/lib/integrations/marketplaces/woocommerce");
  const adapter = connector
    ? new WooCommerceAdapter({
        storeUrl: connector.storeUrl,
        consumerKey: connector.consumerKey,
        consumerSecret: connector.consumerSecret,
      })
    : new WooCommerceAdapter({
        storeUrl: process.env.WOOCOMMERCE_STORE_URL!,
        consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
        consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
      });

  const mapped = adapter.mapOrder(order);

  // Resolve SKUs to products
  const skus = mapped.lineItems.map((li) => li.sku).filter(Boolean);
  const products =
    skus.length > 0
      ? await tenantDb.product.findMany({
          where: { clientId: client.id, sku: { in: skus } },
          select: { id: true, sku: true },
        })
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productBySku = new Map(products.map((p: any) => [p.sku, p]));

  const resolvedLines = mapped.lineItems
    .map((li) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productId: (productBySku.get(li.sku) as any)?.id,
      quantity: li.quantity,
      uom: "EA",
      unitPrice: li.unitPrice ?? null,
    }))
    .filter((li) => li.productId != null);

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
      totalItems: resolvedLines.reduce((s, li) => s + li.quantity, 0),
      lines: { create: resolvedLines },
    },
  });

  await logAudit(tenantDb, {
    userId: "webhook",
    action: "create",
    entityType: "order",
    entityId: created.id,
    changes: { source: { old: null, new: "woocommerce_webhook" } },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderUpdated(order: any, connector: any, source: string) {
  const status = order.status as string | undefined;
  if (!status) return;

  const resolved = await resolveTenantDb(connector, source);
  if (!resolved) return;

  const { db: tenantDb } = resolved;
  const externalId = String(order.id);

  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (!existing) return;
  if (existing.status === "shipped" || existing.status === "delivered") return;

  if (status === "cancelled" || status === "refunded") {
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
  } else if (status === "completed") {
    await tenantDb.order.update({
      where: { id: existing.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: "shipped" as any, shippedDate: new Date() },
    });
  }
}
