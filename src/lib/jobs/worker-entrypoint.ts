/**
 * Standalone BullMQ worker entrypoint.
 *
 * Compiled to a self-contained JS bundle at Docker build time:
 *   npx esbuild src/lib/jobs/worker-entrypoint.ts --bundle --platform=node --outfile=dist/worker.js --external:pg-native
 *
 * Run in production:
 *   node dist/worker.js
 *
 * Uses the same Shopify adapter, notification helpers, and email sender
 * identity as the in-process path. No reimplementation of business logic.
 *
 * IMPORTANT: Job payloads must exactly match what the app enqueues.
 * See src/modules/shipping/actions.ts, src/modules/inventory/actions.ts,
 * and src/modules/receiving/actions.ts for the enqueue callsites.
 */

import { Worker, type Job } from "bullmq";
import { PrismaClient as PublicPrismaClient } from "../../../node_modules/.prisma/public-client";
import { PrismaClient as TenantPrismaClient } from "../../../node_modules/.prisma/tenant-client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { getShopifyAdapterForTenant } from "../integrations/marketplaces/shopify";

// ── Config ──────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const EMAIL_FROM = process.env.EMAIL_FROM || "Ramola WMS <noreply@wms.ramola.app>";
const APP_NAME = process.env.APP_NAME || "Ramola WMS";

/**
 * Parse REDIS_URL into an ioredis-compatible connection object.
 * Preserves auth (username/password), TLS (rediss://), and database number.
 */
function parseRedisConnection(url: string): Record<string, unknown> {
  const parsed = new URL(url);
  const opts: Record<string, unknown> = {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
  };
  if (parsed.password) opts.password = decodeURIComponent(parsed.password);
  if (parsed.username && parsed.username !== "default") opts.username = parsed.username;
  if (parsed.pathname && parsed.pathname.length > 1) {
    opts.db = parseInt(parsed.pathname.slice(1), 10);
  }
  if (parsed.protocol === "rediss:") {
    opts.tls = {};
  }
  return opts;
}

const connection = parseRedisConnection(REDIS_URL);

// ── DB Clients ──────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

function getPublicDb(): PublicPrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PublicPrismaClient({ adapter } as any);
}

function getTenantDb(schema: string): TenantPrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any, { schema });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new TenantPrismaClient({ adapter } as any);
}

const publicDb = getPublicDb();

async function resolveTenantSchema(tenantId: string): Promise<string> {
  const tenant = await publicDb.tenant.findUnique({
    where: { id: tenantId },
    select: { dbSchema: true },
  });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
  return tenant.dbSchema;
}

// ── Notification Worker ─────────────────────────────────────────────────────
// Payload: { type: "warehouse_team", tenantId, title, message, link?, notificationType? }

async function processNotification(job: Job) {
  const { type, ...data } = job.data;

  if (type === "warehouse_team") {
    const dbSchema = await resolveTenantSchema(data.tenantId);
    const db = getTenantDb(dbSchema);

    const tenantUsers = await publicDb.tenantUser.findMany({
      where: {
        tenantId: data.tenantId,
        role: { in: ["admin", "manager"] },
      },
      select: { userId: true },
    });

    for (const tu of tenantUsers) {
      await db.notification.create({
        data: {
          userId: tu.userId,
          title: data.title ?? "Notification",
          message: data.message ?? "",
          type: data.notificationType ?? "info",
          isRead: false,
          link: data.link ?? null,
        },
      });
    }
  }
}

// ── Integration Worker ──────────────────────────────────────────────────────
// Payload: { type: "shopify_fulfillment", tenantId, orderId, trackingNumber, carrier }
//
// Uses the same ShopifyAdapter and fulfillment-order flow as the in-app path.

async function processIntegration(job: Job) {
  const { type, ...data } = job.data;

  if (type === "shopify_fulfillment") {
    const dbSchema = await resolveTenantSchema(data.tenantId);
    const db = getTenantDb(dbSchema);

    // Look up the order to get externalId (Shopify order ID)
    const order = await db.order.findUnique({
      where: { id: data.orderId },
      select: { externalId: true, channelId: true },
    });

    if (!order?.externalId) {
      console.warn(`[integration] Order ${data.orderId} has no externalId, skipping`);
      return;
    }

    // Resolve Shopify credentials: SalesChannel.config first, env var fallback
    let shopDomain: string | undefined;
    let accessToken: string | undefined;
    let apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-01";
    let locationId: string | undefined;

    if (order.channelId) {
      const channel = await db.salesChannel.findUnique({
        where: { id: order.channelId },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = (channel?.config ?? {}) as any;
      shopDomain = cfg.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN;
      accessToken = cfg.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
      if (cfg.apiVersion) apiVersion = cfg.apiVersion;
      locationId = cfg.locationId || process.env.SHOPIFY_LOCATION_ID;
    } else {
      shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
      accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      locationId = process.env.SHOPIFY_LOCATION_ID;
    }

    if (!shopDomain || !accessToken) {
      console.warn("[integration] Shopify not configured for this tenant/channel, skipping");
      return;
    }

    // Use the canonical adapter — same fulfillment-order flow as the in-app path
    const adapter = getShopifyAdapterForTenant({ shopDomain, accessToken, apiVersion, locationId });
    await adapter.pushFulfillment({
      externalOrderId: order.externalId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      shippedAt: new Date(),
      lineItems: [],
    });
  }
}

// ── Email Worker ────────────────────────────────────────────────────────────
//
// order_shipped_customer payload:
//   { template, to, customerName, orderNumber, trackingNumber, carrier }
//
// low_stock_alert payload:
//   { template, tenantId, products: [{ sku, name, available, minStock }] }

async function processEmail(job: Job) {
  const { template, ...data } = job.data;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[email] RESEND_API_KEY not set, skipping email");
    return;
  }

  let to: string | undefined;
  let subject: string;
  let html: string;

  if (template === "order_shipped_customer") {
    // Payload: { to, customerName, orderNumber, trackingNumber, carrier }
    to = data.to;
    subject = `Your order ${data.orderNumber} has shipped!`;
    html = `
      <p>Hi ${data.customerName ?? "Customer"},</p>
      <p>Your order <strong>${data.orderNumber}</strong> has been shipped!</p>
      <ul>
        <li><strong>Carrier:</strong> ${data.carrier}</li>
        <li><strong>Tracking number:</strong> ${data.trackingNumber}</li>
      </ul>
      <p>You can track your package using the tracking number above on the carrier's website.</p>
      <p style="color:#888;font-size:12px;">Shipped by ${APP_NAME}</p>
    `;
  } else if (template === "low_stock_alert") {
    // Payload: { tenantId, products: [{ sku, name, available, minStock }] }
    const products = data.products as {
      sku: string;
      name: string;
      available: number;
      minStock: number;
    }[];
    if (!products || products.length === 0) return;

    // Resolve admin email for this tenant
    if (data.tenantId) {
      const admins = await publicDb.tenantUser.findMany({
        where: { tenantId: data.tenantId, role: "admin" },
        include: { user: { select: { email: true } } },
      });
      to = admins[0]?.user?.email;
    }

    if (!to) {
      console.warn("[email] No admin email found for low-stock alert");
      return;
    }

    const rows = products
      .map(
        (p) =>
          `<tr><td>${p.sku}</td><td>${p.name}</td><td style="color:red;font-weight:bold">${p.available}</td><td>${p.minStock}</td></tr>`
      )
      .join("");

    subject = `Low stock alert: ${products.length} product(s) below minimum`;
    html = `
      <p><strong>${products.length}</strong> product(s) are below their minimum stock level:</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <tr style="background:#f5f5f5"><th>SKU</th><th>Name</th><th>Available</th><th>Min Stock</th></tr>
        ${rows}
      </table>
      <p style="color:#888;font-size:12px;">${APP_NAME}</p>
    `;
  } else {
    console.warn(`[email] Unknown template: ${template}`);
    return;
  }

  if (!to) {
    console.warn(`[email] No recipient for ${template}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend failed: ${res.status} ${text}`);
  }
}

// ── Start Workers ───────────────────────────────────────────────────────────

new Worker("wms-notifications", processNotification, {
  connection,
  concurrency: 5,
});

new Worker("wms-integrations", processIntegration, {
  connection,
  concurrency: 3,
});

new Worker("wms-email", processEmail, {
  connection,
  concurrency: 5,
});

console.warn("[worker] BullMQ workers started: notifications, integrations, email");

// Keep alive
process.on("SIGINT", () => {
  console.warn("[worker] Shutting down...");
  pool.end().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  console.warn("[worker] Shutting down...");
  pool.end().then(() => process.exit(0));
});
