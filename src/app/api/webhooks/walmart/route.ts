/**
 * Walmart Webhook Receiver
 *
 * Handles Walmart marketplace event notifications.
 * Events: order.created, order.cancelled
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { nextSequence } from "@/lib/sequences";
import { logAudit } from "@/lib/audit";

function verifyWalmartSignature(body: string, signature: string, secret: string): boolean {
  const computed = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-walmart-signature") ?? "";
  const eventType = req.headers.get("x-walmart-event-type") ?? "";

  if (
    !process.env.WALMART_WEBHOOK_SECRET ||
    !verifyWalmartSignature(body, signature, process.env.WALMART_WEBHOOK_SECRET)
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
    switch (eventType) {
      case "order.created":
        await handleOrderCreated(payload);
        break;
      case "order.cancelled":
        await handleOrderCancelled(payload);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[Walmart Webhook] ${eventType} handler error:`, err);
  }

  return NextResponse.json({ ok: true });
}

async function resolveTenantDb(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  clientCode: string;
} | null> {
  const tenantSlug = process.env.WALMART_TENANT_SLUG;
  if (!tenantSlug) return null;

  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");

  const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenantRecord) return null;

  return {
    db: getTenantDb(tenantRecord.dbSchema),
    clientCode: process.env.WALMART_WMS_CLIENT_CODE ?? "Default",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCreated(payload: any) {
  const resolved = await resolveTenantDb();
  if (!resolved) return;

  const { db: tenantDb, clientCode } = resolved;
  const order = payload.order ?? payload;
  const externalId = String(order.purchaseOrderId ?? order.id ?? "");
  if (!externalId) return;

  const existing = await tenantDb.order.findFirst({ where: { externalId } });
  if (existing) return;

  const channel = await tenantDb.salesChannel.findFirst({
    where: { type: "walmart", isActive: true },
  });
  if (!channel) return;

  const client = await tenantDb.client.findFirst({
    where: clientCode ? { code: clientCode, isActive: true } : { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!client) return;

  const addr = order.shippingInfo?.postalAddress ?? {};
  const orderLines = order.orderLines?.orderLine ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skus = orderLines.map((line: any) => line.item?.sku).filter(Boolean);
  const products =
    skus.length > 0
      ? await tenantDb.product.findMany({
          where: { clientId: client.id, sku: { in: skus } },
          select: { id: true, sku: true },
        })
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productBySku = new Map(products.map((p: any) => [p.sku, p]));

  const resolvedLines = orderLines
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((line: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = productBySku.get(line.item?.sku) as any;
      if (!product) return null;
      const charges = line.charges?.charge ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productCharge = charges.find((c: any) => c.chargeType === "PRODUCT");
      return {
        productId: product.id,
        quantity: line.orderLineQuantity?.amount ? parseInt(line.orderLineQuantity.amount, 10) : 1,
        uom: "EA",
        unitPrice: productCharge?.chargeAmount?.amount
          ? parseFloat(productCharge.chargeAmount.amount)
          : null,
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
      shipToName: addr.name ?? "",
      shipToAddress1: addr.address1 ?? "",
      shipToAddress2: addr.address2 ?? null,
      shipToCity: addr.city ?? "",
      shipToState: addr.state ?? null,
      shipToZip: addr.postalCode ?? "",
      shipToCountry: addr.country ?? "US",
      shippingMethod: order.shippingInfo?.methodCode ?? null,
      orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
      totalItems: resolvedLines.reduce((s: number, li: { quantity: number }) => s + li.quantity, 0),
      lines: { create: resolvedLines },
    },
  });

  await logAudit(tenantDb, {
    userId: "webhook",
    action: "create",
    entityType: "order",
    entityId: created.id,
    changes: { source: { old: null, new: "walmart_webhook" } },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCancelled(payload: any) {
  const resolved = await resolveTenantDb();
  if (!resolved) return;

  const { db: tenantDb } = resolved;
  const order = payload.order ?? payload;
  const externalId = String(order.purchaseOrderId ?? order.id ?? "");
  if (!externalId) return;

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
