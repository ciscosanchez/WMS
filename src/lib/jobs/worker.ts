/**
 * BullMQ workers for processing background jobs.
 * Each worker handles one queue and dispatches to the appropriate handler.
 *
 * Workers run in the same process as Next.js for simplicity.
 * For high-volume, split into a separate worker process.
 */
import { Worker, type Job } from "bullmq";
import { bullmqConnection as connection } from "./redis-connection";

// ── Notification Worker ─────────────────────────────────────────────────────

async function processNotification(job: Job) {
  const { type, ...data } = job.data;

  if (type === "warehouse_team") {
    const { notifyWarehouseTeam } = await import("@/lib/notifications/notify");
    const { getTenantDb } = await import("@/lib/db/tenant-client");
    const { publicDb } = await import("@/lib/db/public-client");

    const tenant = await publicDb.tenant.findUnique({
      where: { id: data.tenantId },
      select: { dbSchema: true },
    });
    if (!tenant) throw new Error(`Tenant ${data.tenantId} not found`);

    const db = getTenantDb(tenant.dbSchema);
    await notifyWarehouseTeam(db, data);
  }
}

// ── Integration Worker ──────────────────────────────────────────────────────

async function processIntegration(job: Job) {
  const { type, ...data } = job.data;

  if (type === "shopify_fulfillment") {
    const { pushShopifyFulfillment } = await import("@/modules/orders/shopify-sync");
    const result = await pushShopifyFulfillment(data.orderId, data.trackingNumber, data.carrier);
    if (result.error) throw new Error(result.error);
  }
}

// ── Email Worker ────────────────────────────────────────────────────────────

async function processEmail(job: Job) {
  const { template, ...data } = job.data;
  const email = await import("@/lib/email/resend");

  if (template === "order_shipped_customer") {
    const result = await email.sendOrderShippedCustomer(data);
    if (!result.sent && result.warning) {
      console.warn(`[email] ${result.warning}`);
    }
  } else if (template === "low_stock_alert") {
    const result = await email.sendLowStockAlert(data);
    if (!result.sent && result.warning) {
      console.warn(`[email] ${result.warning}`);
    }
  }
}

// ── Start Workers ───────────────────────────────────────────────────────────

let started = false;

export function startWorkers() {
  if (started) return;
  started = true;

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

  console.log("[jobs] BullMQ workers started: notifications, integrations, email");
}
