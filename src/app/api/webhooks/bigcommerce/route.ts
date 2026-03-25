/**
 * BigCommerce Webhook Receiver
 *
 * Handles BigCommerce store event notifications.
 * BigCommerce sends a POST with a JSON payload containing scope and data.
 *
 * Events: store/order/created, store/order/updated
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { nextSequence } from "@/lib/sequences";
import { logAudit } from "@/lib/audit";

function verifyBigCommerceSignature(body: string, signature: string, secret: string): boolean {
  const computed = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-bc-webhook-hmac") ?? "";

  if (
    !process.env.BIGCOMMERCE_WEBHOOK_SECRET ||
    !verifyBigCommerceSignature(body, signature, process.env.BIGCOMMERCE_WEBHOOK_SECRET)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { scope?: string; data?: { id?: number }; [key: string]: unknown };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scope = payload.scope ?? "";
  const orderId = payload.data?.id;

  try {
    if (scope === "store/order/created" && orderId) {
      await handleOrderCreated(orderId);
    }
  } catch (err) {
    console.error(`[BigCommerce Webhook] ${scope} handler error:`, err);
  }

  return NextResponse.json({ ok: true });
}

async function resolveTenantDb(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  clientCode: string;
  storeHash: string;
  accessToken: string;
} | null> {
  const tenantSlug = process.env.BIGCOMMERCE_TENANT_SLUG;
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;
  if (!tenantSlug || !storeHash || !accessToken) return null;

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");

  const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenantRecord) return null;

  return {
    db: getTenantDb(tenantRecord.dbSchema),
    clientCode: process.env.BIGCOMMERCE_WMS_CLIENT_CODE ?? "Default",
    storeHash,
    accessToken,
  };
}

async function handleOrderCreated(orderId: number) {
  const resolved = await resolveTenantDb();
  if (!resolved) return;

  const { db: tenantDb, clientCode, storeHash, accessToken } = resolved;
  const externalId = String(orderId);

  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (existing) return;

  const channel = await tenantDb.salesChannel.findFirst({
    where: { type: "bigcommerce", isActive: true },
  });
  if (!channel) return;

  const client = await tenantDb.client.findFirst({
    where: clientCode ? { code: clientCode, isActive: true } : { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!client) return;

  // Fetch the full order from BigCommerce V2 API
  const orderUrl = `https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}`;
  const orderRes = await fetch(orderUrl, {
    headers: { "X-Auth-Token": accessToken, Accept: "application/json" },
  });
  if (!orderRes.ok) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order: any = await orderRes.json();

  // Fetch order products
  const productsUrl = `https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}/products`;
  const productsRes = await fetch(productsUrl, {
    headers: { "X-Auth-Token": accessToken, Accept: "application/json" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderProducts: any[] = productsRes.ok ? await productsRes.json() : [];

  const addr = order.billing_address ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skus = orderProducts.map((p: any) => p.sku).filter(Boolean);
  const products =
    skus.length > 0
      ? await tenantDb.product.findMany({
          where: { clientId: client.id, sku: { in: skus } },
          select: { id: true, sku: true },
        })
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productBySku = new Map(products.map((p: any) => [p.sku, p]));

  const resolvedLines = orderProducts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = productBySku.get(p.sku) as any;
      if (!product) return null;
      return {
        productId: product.id,
        quantity: p.quantity ?? 1,
        uom: "EA",
        unitPrice: p.base_price ? parseFloat(p.base_price) : null,
      };
    })
    .filter(Boolean);

  if (resolvedLines.length === 0) return;

  const orderNumber = await nextSequence(tenantDb, "ORD");
  const created = await tenantDb.order.create({
    data: {
      orderNumber,
      externalId,
      channelId: channel.id,
      clientId: client.id,
      status: "pending",
      priority: "standard",
      shipToName: `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim(),
      shipToAddress1: addr.street_1 ?? "",
      shipToAddress2: addr.street_2 ?? null,
      shipToCity: addr.city ?? "",
      shipToState: addr.state ?? null,
      shipToZip: addr.zip ?? "",
      shipToCountry: addr.country_iso2 ?? "US",
      orderDate: order.date_created ? new Date(order.date_created) : new Date(),
      totalItems: resolvedLines.reduce((s: number, li: { quantity: number }) => s + li.quantity, 0),
      lines: { create: resolvedLines },
    },
  });

  await logAudit(tenantDb, {
    userId: "webhook",
    action: "create",
    entityType: "order",
    entityId: created.id,
    changes: { source: { old: null, new: "bigcommerce_webhook" } },
  });
}
