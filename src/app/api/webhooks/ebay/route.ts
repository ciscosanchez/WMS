/**
 * eBay Notification Handler — verifies signature, handles order.created / order.updated.
 * Multi-tenant: resolves target tenant by matching eBay SalesChannel configs.
 */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { nextSequence } from "@/lib/sequences";
import { logAudit } from "@/lib/audit";

export function verifyEbaySignature(body: string, signature: string, token: string): boolean {
  if (!signature || !token) return false;
  try {
    const computed = crypto.createHmac("sha256", token).update(body, "utf8").digest("base64");
    const a = Buffer.from(computed),
      b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("x-ebay-signature") ?? "";
  const secret = process.env.EBAY_WEBHOOK_VERIFICATION_TOKEN;
  if (!secret || !verifyEbaySignature(body, sig, secret))
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const topic = payload.metadata?.topic ?? payload.topic ?? "";
  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const conn = await resolveEbayTenant(publicDb, getTenantDb);
    if (topic === "marketplace.order.created") await handleOrderCreated(payload, conn);
    else if (topic === "marketplace.order.updated") await handleOrderUpdated(payload, conn);
  } catch (e) {
    console.error(`[eBay Webhook] ${topic} error:`, e);
  }
  return NextResponse.json({ ok: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveEbayTenant(pub: any, getDb: any) {
  // Webhook handler — no user session, resolves tenant by matching eBay SalesChannel config.
  for (const t of await pub.tenant.findMany({ where: { status: "active" } })) {
    const db = getDb(t.dbSchema);
    const ch = await db.salesChannel.findFirst({ where: { type: "ebay", isActive: true } });
    if (!ch) continue;
    const c = (ch.config ?? {}) as Record<string, string>;
    return {
      db,
      clientCode: c.clientCode ?? t.slug,
      appId: c.appId ?? "",
      certId: c.certId ?? "",
      devId: c.devId ?? "",
      userToken: c.userToken ?? "",
    };
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveDb(conn: any) {
  if (conn) return { db: conn.db, clientCode: conn.clientCode as string };
  const slug = process.env.ARMSTRONG_TENANT_SLUG;
  if (!slug) return null;
  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");
  const rec = await publicDb.tenant.findUnique({ where: { slug } });
  return rec
    ? { db: getTenantDb(rec.dbSchema), clientCode: process.env.EBAY_WMS_CLIENT_CODE ?? "" }
    : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCreated(payload: any, conn: any) {
  const order = payload.resource ?? payload;
  const r = await resolveDb(conn);
  if (!r) return;
  const { db: tdb, clientCode } = r;
  const externalId = order.orderId ?? String(order.orderId);
  if (await tdb.order.findFirst({ where: { externalId } })) return;
  const channel = await tdb.salesChannel.findFirst({ where: { type: "ebay", isActive: true } });
  if (!channel) return;
  const client = await tdb.client.findFirst({
    where: clientCode ? { code: clientCode, isActive: true } : { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!client) return;

  const { EbayAdapter } = await import("@/lib/integrations/marketplaces/ebay");
  const cfg = conn
    ? { appId: conn.appId, certId: conn.certId, devId: conn.devId, userToken: conn.userToken }
    : {
        appId: process.env.EBAY_APP_ID!,
        certId: process.env.EBAY_CERT_ID!,
        devId: process.env.EBAY_DEV_ID!,
        userToken: process.env.EBAY_USER_TOKEN ?? "",
      };
  const mapped = new EbayAdapter(cfg).mapOrder(order);
  const skus = mapped.lineItems.map((li) => li.sku).filter(Boolean);
  const prods = skus.length
    ? await tdb.product.findMany({
        where: { clientId: client.id, sku: { in: skus } },
        select: { id: true, sku: true },
      })
    : [];
  const bySku = new Map(prods.map((p: any) => [p.sku, p]));
  const lines = mapped.lineItems
    .map((li) => ({
      productId: (bySku.get(li.sku) as any)?.id,
      quantity: li.quantity,
      uom: "EA",
      unitPrice: li.unitPrice ?? null,
    }))
    .filter((l) => l.productId != null);
  if (!lines.length) return;
  const a = mapped.shipTo;
  const created = await tdb.order.create({
    data: {
      orderNumber: await nextSequence(tdb, "ORD"),
      externalId,
      channelId: channel.id,
      clientId: client.id,
      status: "pending",
      priority: mapped.priority,
      shipToName: a.name,
      shipToAddress1: a.address1,
      shipToAddress2: a.address2 ?? null,
      shipToCity: a.city,
      shipToState: a.state ?? null,
      shipToZip: a.zip,
      shipToCountry: a.country ?? "US",
      shipToPhone: a.phone ?? null,
      shipToEmail: a.email ?? null,
      shippingMethod: mapped.shippingMethod ?? null,
      orderDate: mapped.orderDate,
      notes: mapped.notes ?? null,
      totalItems: lines.reduce((s, l) => s + l.quantity, 0),
      lines: { create: lines },
    },
  });
  await logAudit(tdb, {
    userId: "webhook",
    action: "create",
    entityType: "order",
    entityId: created.id,
    changes: { source: { old: null, new: "ebay_webhook" } },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderUpdated(payload: any, conn: any) {
  const order = payload.resource ?? payload;
  const status = order.orderFulfillmentStatus as string | undefined;
  if (!status) return;
  const r = await resolveDb(conn);
  if (!r) return;
  const existing = await r.db.order.findFirst({ where: { externalId: String(order.orderId) } });
  if (!existing || existing.status === "shipped" || existing.status === "delivered") return;
  if (status === "CANCELLED") {
    await r.db.order.update({
      where: { id: existing.id },
      data: { status: "cancelled", cancelledDate: new Date() },
    });
    await logAudit(r.db, {
      userId: "webhook",
      action: "update",
      entityType: "order",
      entityId: existing.id,
      changes: { status: { old: existing.status, new: "cancelled" } },
    });
  } else if (status === "SHIPPED" || status === "DELIVERED") {
    await r.db.order.update({
      where: { id: existing.id },
      data: { status: "shipped", shippedDate: new Date() },
    });
  }
}
