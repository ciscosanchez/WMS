/**
 * Amazon SP-API Notification Webhook Receiver
 *
 * Amazon sends notifications via SQS→SNS→HTTPS destination.
 * This endpoint handles:
 *   - ORDER_CHANGE → import new/updated order into WMS
 *   - FBA_INBOUND_SHIPMENT_STATUS → log inbound status updates
 *
 * Multi-tenant: resolves the target tenant by matching the incoming
 * SellerId against SalesChannel configs across all tenants.
 * Falls back to ARMSTRONG_TENANT_SLUG env var for legacy single-tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// SNS message types
type SnsMessageType = "SubscriptionConfirmation" | "Notification" | "UnsubscribeConfirmation";

interface SnsEnvelope {
  Type: SnsMessageType;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  Token?: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  UnsubscribeURL?: string;
}

// ── SNS Signature Verification ──────────────────────────────────────────────

/** Only allow cert URLs from SNS-owned domains */
const SNS_DOMAIN_RE = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//;

/** In-process cert cache — certs are stable for a given SNS topic */
const certCache = new Map<string, string>();

async function fetchSigningCert(url: string): Promise<string> {
  if (!SNS_DOMAIN_RE.test(url)) {
    throw new Error(`Rejected SigningCertURL from untrusted domain: ${url}`);
  }
  if (certCache.has(url)) return certCache.get(url)!;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch SNS signing cert: ${res.status}`);
  const pem = await res.text();
  certCache.set(url, pem);
  return pem;
}

function buildSnsCanonicalString(msg: SnsEnvelope): string {
  let fields: Array<[string, string | undefined]>;
  if (msg.Type === "SubscriptionConfirmation" || msg.Type === "UnsubscribeConfirmation") {
    fields = [
      ["Message", msg.Message],
      ["MessageId", msg.MessageId],
      ["SubscribeURL", msg.SubscribeURL],
      ["Timestamp", msg.Timestamp],
      ["Token", msg.Token],
      ["TopicArn", msg.TopicArn],
      ["Type", msg.Type],
    ];
  } else {
    fields = [
      ["Message", msg.Message],
      ["MessageId", msg.MessageId],
      ...(msg.Subject !== undefined ? [["Subject", msg.Subject] as [string, string]] : []),
      ["Timestamp", msg.Timestamp],
      ["TopicArn", msg.TopicArn],
      ["Type", msg.Type],
    ];
  }
  return fields
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}\n${v}\n`)
    .join("");
}

async function verifySnsSignature(envelope: SnsEnvelope): Promise<boolean> {
  if (envelope.SignatureVersion !== "1") {
    console.warn("[Amazon Webhook] Unsupported signature version:", envelope.SignatureVersion);
    return false;
  }
  const cert = await fetchSigningCert(envelope.SigningCertURL);
  const canonical = buildSnsCanonicalString(envelope);
  const verifier = crypto.createVerify("sha1WithRSAEncryption");
  verifier.update(canonical, "utf8");
  return verifier.verify(cert, envelope.Signature, "base64");
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let envelope: SnsEnvelope;
  try {
    envelope = JSON.parse(rawBody) as SnsEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Verify SNS signature on every message ────────────────────────────────
  try {
    const valid = await verifySnsSignature(envelope);
    if (!valid) {
      console.warn("[Amazon Webhook] SNS signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  } catch (err) {
    console.error("[Amazon Webhook] Signature verification error:", err);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 403 });
  }

  // ── SNS Subscription Confirmation ──────────────────────────────────────────
  if (envelope.Type === "SubscriptionConfirmation") {
    if (envelope.SubscribeURL) {
      if (!SNS_DOMAIN_RE.test(envelope.SubscribeURL)) {
        console.error(
          "[Amazon Webhook] Rejected SubscribeURL from untrusted domain:",
          envelope.SubscribeURL
        );
        return NextResponse.json({ error: "Untrusted SubscribeURL" }, { status: 403 });
      }
      try {
        await fetch(envelope.SubscribeURL);
        console.log("[Amazon Webhook] SNS subscription confirmed");
      } catch (err) {
        console.error("[Amazon Webhook] Failed to confirm SNS subscription:", err);
      }
    }
    return NextResponse.json({ confirmed: true });
  }

  // ── Notification ────────────────────────────────────────────────────────────
  if (envelope.Type !== "Notification") {
    return NextResponse.json({ skipped: envelope.Type });
  }

  let notification: {
    NotificationType?: string;
    Payload?: {
      OrderChangeNotification?: {
        NotificationLevel?: string;
        SellerId?: string;
        AmazonOrderId?: string;
        OrderStatus?: string;
      };
    };
  };

  try {
    notification = JSON.parse(envelope.Message);
  } catch {
    return NextResponse.json({ error: "Invalid notification JSON" }, { status: 400 });
  }

  const notificationType = notification.NotificationType;
  console.log(`[Amazon Webhook] Type: ${notificationType}`);

  if (notificationType === "ORDER_CHANGE") {
    const orderPayload = notification.Payload?.OrderChangeNotification;
    const amazonOrderId = orderPayload?.AmazonOrderId;
    const orderStatus = orderPayload?.OrderStatus;
    const sellerId = orderPayload?.SellerId;

    if (!amazonOrderId) {
      return NextResponse.json({ error: "No order ID in payload" }, { status: 400 });
    }

    if (orderStatus !== "Unshipped" && orderStatus !== "PartiallyShipped") {
      return NextResponse.json({ skipped: `Status ${orderStatus} not actionable` });
    }

    try {
      // Resolve tenant by seller ID (multi-tenant) or fall back to env var
      const { publicDb } = await import("@/lib/db/public-client");
      const { getTenantDb } = await import("@/lib/db/tenant-client");
      const { resolveAmazonTenant } = await import("@/lib/integrations/tenant-connectors");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let db: any;
      let clientCode: string;

      let tenantConnector: Awaited<ReturnType<typeof resolveAmazonTenant>> = null;

      if (sellerId) {
        tenantConnector = await resolveAmazonTenant(publicDb, getTenantDb, sellerId);
        if (tenantConnector) {
          db = tenantConnector.db;
          clientCode = tenantConnector.clientCode;
        }
      }

      // Legacy fallback
      if (!db) {
        const tenantSlug = process.env.ARMSTRONG_TENANT_SLUG;
        if (!tenantSlug) {
          return NextResponse.json({ skipped: "No tenant slug" });
        }
        const tenantRecord = await publicDb.tenant.findUnique({ where: { slug: tenantSlug } });
        if (!tenantRecord) {
          return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }
        db = getTenantDb(tenantRecord.dbSchema);
        clientCode =
          process.env.AMAZON_WMS_CLIENT_CODE ?? process.env.SHOPIFY_WMS_CLIENT_CODE ?? "Armstrong";
      }

      // Skip if already imported
      const existing = await db.order.findFirst({
        where: { externalId: amazonOrderId },
      });
      if (existing) {
        return NextResponse.json({ skipped: "Already imported", orderId: existing.id });
      }

      // Fetch full order details from SP-API using tenant-scoped credentials
      const { getAmazonAdapter, getAmazonAdapterForTenant } =
        await import("@/lib/integrations/marketplaces/amazon");
      const adapter = tenantConnector
        ? getAmazonAdapterForTenant({
            clientId: tenantConnector.clientId,
            clientSecret: tenantConnector.clientSecret,
            refreshToken: tenantConnector.refreshToken,
            sellerId: tenantConnector.sellerId,
            marketplaceId: tenantConnector.marketplaceId,
            awsAccessKeyId: tenantConnector.awsAccessKeyId,
            awsSecretAccessKey: tenantConnector.awsSecretAccessKey,
            region: tenantConnector.region,
          })
        : getAmazonAdapter(); // Legacy fallback to global env

      if (!adapter) {
        return NextResponse.json({ skipped: "Amazon adapter not configured" });
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const orders = await adapter.fetchOrders(since);
      const order = orders.find((o) => o.externalId === amazonOrderId);

      if (!order) {
        return NextResponse.json({ skipped: "Order not found in SP-API response" });
      }

      // Find the client
      const client = await db.client.findFirst({
        where: { code: clientCode!, isActive: true },
      });
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }

      // Find or create Amazon sales channel
      let channel = await db.salesChannel.findFirst({
        where: { type: "amazon", isActive: true },
      });
      if (!channel) {
        channel = await db.salesChannel.create({
          data: {
            name: "Amazon",
            type: "amazon",
            isActive: true,
            config: { sellerId: sellerId ?? process.env.AMAZON_SELLER_ID },
          },
        });
      }

      const { nextSequence } = await import("@/lib/sequences");
      const { logAudit } = await import("@/lib/audit");

      // Resolve SKUs
      const skus = order.lineItems.map((li) => li.sku).filter((s): s is string => !!s);
      const products =
        skus.length > 0
          ? await db.product.findMany({
              where: { clientId: client.id, sku: { in: skus } },
              select: { id: true, sku: true },
            })
          : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productBySku = new Map(products.map((p: any) => [p.sku, p]));

      const resolvedLines = order.lineItems
        .map((li) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          productId: (productBySku.get(li.sku) as any)?.id,
          quantity: li.quantity,
          uom: "EA",
          unitPrice: li.unitPrice,
        }))
        .filter((li) => li.productId != null);

      if (resolvedLines.length === 0) {
        return NextResponse.json({ skipped: "No matching products" });
      }

      const orderNumber = await nextSequence(db, "ORD");
      const addr = order.shipTo;
      const created = await db.order.create({
        data: {
          orderNumber,
          externalId: order.externalId,
          channelId: channel.id,
          clientId: client.id,
          status: "pending",
          priority: order.priority as "standard" | "expedited" | "rush" | "same_day",
          shipToName: addr.name,
          shipToAddress1: addr.address1,
          shipToAddress2: addr.address2 ?? null,
          shipToCity: addr.city,
          shipToState: addr.state ?? null,
          shipToZip: addr.zip,
          shipToCountry: addr.country ?? "US",
          shipToPhone: addr.phone ?? null,
          shipToEmail: addr.email ?? null,
          shippingMethod: order.shippingMethod ?? null,
          orderDate: order.orderDate,
          notes: order.notes ?? null,
          totalItems: resolvedLines.reduce((s, li) => s + li.quantity, 0),
          lines: { create: resolvedLines },
        },
      });

      await logAudit(db, {
        userId: "webhook",
        action: "create",
        entityType: "order",
        entityId: created.id,
        changes: { source: { old: null, new: "amazon_webhook" } },
      });

      console.log(`[Amazon Webhook] Imported order ${created.orderNumber} (${amazonOrderId})`);
      return NextResponse.json({ imported: created.orderNumber });
    } catch (err) {
      console.error("[Amazon Webhook] Error processing ORDER_CHANGE:", err);
      return NextResponse.json({ error: "Failed to process order" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: notificationType });
}
