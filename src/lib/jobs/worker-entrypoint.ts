/**
 * Standalone BullMQ worker entrypoint.
 *
 * Compiled to a self-contained JS bundle at Docker build time:
 *   npx esbuild src/lib/jobs/worker-entrypoint.ts --bundle --platform=node --outfile=dist/worker.js --external:pg-native
 *
 * Run in production:
 *   node dist/worker.js
 *
 * This file intentionally avoids `@/` path aliases — it is compiled
 * independently of Next.js so it can run without the full app tree.
 */

import { Worker, type Job } from "bullmq";
import { PrismaClient as PublicPrismaClient } from "../../../node_modules/.prisma/public-client";
import { PrismaClient as TenantPrismaClient } from "../../../node_modules/.prisma/tenant-client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// ── Config ──────────────────────────────────────────────────────────────────

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379", 10),
};

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

// ── Notification Worker ─────────────────────────────────────────────────────

async function processNotification(job: Job) {
  const { type, ...data } = job.data;

  if (type === "warehouse_team") {
    const tenant = await publicDb.tenant.findUnique({
      where: { id: data.tenantId },
      select: { dbSchema: true },
    });
    if (!tenant) throw new Error(`Tenant ${data.tenantId} not found`);

    const db = getTenantDb(tenant.dbSchema);

    // Look up admin + manager users from public schema
    const tenantUsers = await publicDb.tenantUser.findMany({
      where: {
        tenantId: data.tenantId,
        role: { in: ["admin", "manager"] },
      },
      select: { userId: true },
    });

    // Create in-app notifications in tenant schema
    for (const tu of tenantUsers) {
      await db.notification.create({
        data: {
          userId: tu.userId,
          title: data.title ?? "Notification",
          message: data.message ?? "",
          type: data.notificationType ?? "info",
          isRead: false,
        },
      });
    }
  }
}

// ── Integration Worker ──────────────────────────────────────────────────────

async function processIntegration(job: Job) {
  const { type, ...data } = job.data;

  if (type === "shopify_fulfillment") {
    // Shopify fulfillment push — requires store credentials
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-01";

    if (!shopDomain || !accessToken) {
      console.warn("[integration] Shopify not configured, skipping fulfillment push");
      return;
    }

    const res = await fetch(
      `https://${shopDomain}/admin/api/${apiVersion}/fulfillments.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          fulfillment: {
            order_id: data.shopifyOrderId,
            tracking_number: data.trackingNumber,
            tracking_company: data.carrier,
          },
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify fulfillment failed: ${res.status} ${text}`);
    }
  }
}

// ── Email Worker ────────────────────────────────────────────────────────────

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
    to = data.customerEmail;
    subject = `Your order ${data.orderNumber} has shipped`;
    html = `<p>Your order <strong>${data.orderNumber}</strong> has been shipped.</p>
            ${data.trackingNumber ? `<p>Tracking: ${data.trackingNumber}</p>` : ""}`;
  } else if (template === "low_stock_alert") {
    to = data.recipientEmail;
    subject = `Low stock alert: ${data.sku}`;
    html = `<p>Product <strong>${data.sku}</strong> is below minimum stock level.</p>
            <p>Current: ${data.currentQty} / Min: ${data.minStock}</p>`;
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
      from: "Ramola WMS <noreply@ramola.app>",
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

console.log("[worker] BullMQ workers started: notifications, integrations, email");

// Keep alive
process.on("SIGINT", () => {
  console.log("[worker] Shutting down...");
  pool.end().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  console.log("[worker] Shutting down...");
  pool.end().then(() => process.exit(0));
});
