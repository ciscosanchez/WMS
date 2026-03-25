/**
 * WooCommerce Webhook Receiver — verifies HMAC-SHA256, handles order.created / order.updated.
 * Multi-tenant: resolves target tenant by matching x-wc-webhook-source against SalesChannel configs.
 */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { nextSequence } from "@/lib/sequences";
import { logAudit } from "@/lib/audit";

export function verifyWooCommerceHmac(body: string, sig: string, secret: string): boolean {
  const computed = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const a = Buffer.from(computed),
    b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const norm = (u: string) =>
  u
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("x-wc-webhook-signature") ?? "";
  const topic = req.headers.get("x-wc-webhook-topic") ?? "";
  const source = req.headers.get("x-wc-webhook-source") ?? "";
  if (
    !process.env.WOOCOMMERCE_WEBHOOK_SECRET ||
    !verifyWooCommerceHmac(body, sig, process.env.WOOCOMMERCE_WEBHOOK_SECRET)
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const conn = await resolveWcTenant(publicDb, getTenantDb, source);
    if (!conn) {
      const cu = process.env.WOOCOMMERCE_STORE_URL;
      if (!source || !cu || norm(source) !== norm(cu))
        return NextResponse.json({ error: "Unknown store" }, { status: 404 });
    }
    if (topic === "order.created") await handleCreate(payload, conn, source);
    else if (topic === "order.updated") await handleUpdated(payload, conn, source);
  } catch (e) {
    console.error(`[WC Webhook] ${topic} error:`, e);
  }
  return NextResponse.json({ ok: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveWcTenant(pub: any, getDb: any, src: string) {
  // Webhook handler — no user session, resolves tenant by matching store URL in SalesChannel config.
  for (const t of await pub.tenant.findMany({ where: { status: "active" } })) {
    const db = getDb(t.dbSchema);
    const ch = await db.salesChannel.findFirst({ where: { type: "woocommerce", isActive: true } });
    if (!ch) continue;
    const c = (ch.config ?? {}) as Record<string, string>;
    if (c.storeUrl && norm(c.storeUrl) === norm(src))
      return {
        db,
        clientCode: c.clientCode ?? t.slug,
        storeUrl: c.storeUrl,
        consumerKey: c.consumerKey ?? "",
        consumerSecret: c.consumerSecret ?? "",
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
    ? {
        db: getTenantDb(rec.dbSchema),
        clientCode: process.env.WOOCOMMERCE_WMS_CLIENT_CODE ?? "Armstrong",
      }
    : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCreate(order: any, conn: any, source: string) {
  const st = order.status as string | undefined;
  if (st && st !== "processing" && st !== "on-hold") return;
  const r = await resolveDb(conn);
  if (!r) return;
  const { db: tdb, clientCode } = r;
  const externalId = String(order.id);
  if (await tdb.order.findFirst({ where: { externalId } })) return;
  const channel = await tdb.salesChannel.findFirst({
    where: { type: "woocommerce", isActive: true },
  });
  if (!channel) return;
  const client = await tdb.client.findFirst({
    where: clientCode ? { code: clientCode, isActive: true } : { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!client) return;
  const { WooCommerceAdapter } = await import("@/lib/integrations/marketplaces/woocommerce");
  const cfg = conn
    ? {
        storeUrl: conn.storeUrl,
        consumerKey: conn.consumerKey,
        consumerSecret: conn.consumerSecret,
      }
    : {
        storeUrl: process.env.WOOCOMMERCE_STORE_URL!,
        consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
        consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
      };
  const mapped = new WooCommerceAdapter(cfg).mapOrder(order);
  const skus = mapped.lineItems.map((li) => li.sku).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prods = skus.length
    ? await tdb.product.findMany({
        where: { clientId: client.id, sku: { in: skus } },
        select: { id: true, sku: true },
      })
    : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bySku = new Map(prods.map((p: any) => [p.sku, p]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    changes: { source: { old: null, new: "woocommerce_webhook" } },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUpdated(order: any, conn: any, _source: string) {
  const status = order.status as string | undefined;
  if (!status) return;
  const r = await resolveDb(conn);
  if (!r) return;
  const existing = await r.db.order.findFirst({ where: { externalId: String(order.id) } });
  if (!existing || existing.status === "shipped" || existing.status === "delivered") return;
  if (status === "cancelled" || status === "refunded") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await r.db.order.update({
      where: { id: existing.id },
      data: { status: "cancelled" as any, cancelledDate: new Date() },
    });
    await logAudit(r.db, {
      userId: "webhook",
      action: "update",
      entityType: "order",
      entityId: existing.id,
      changes: { status: { old: existing.status, new: "cancelled" } },
    });
  } else if (status === "completed") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await r.db.order.update({
      where: { id: existing.id },
      data: { status: "shipped" as any, shippedDate: new Date() },
    });
  }
}
