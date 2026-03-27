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
    const { publicDb } = await import("@/lib/db/public-client");
    const { getTenantDb } = await import("@/lib/db/tenant-client");

    const tenant = await publicDb.tenant.findUnique({
      where: { id: data.tenantId },
      select: { dbSchema: true },
    });
    if (!tenant) throw new Error(`Tenant ${data.tenantId} not found`);

    const db = getTenantDb(tenant.dbSchema);
    const { pushShopifyFulfillment } = await import("@/modules/orders/shopify-sync");
    const result = await pushShopifyFulfillment(
      data.orderId,
      data.trackingNumber,
      data.carrier,
      db
    );
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

// ── Slotting Worker ──────────────────────────────────────────────────────

async function processSlotting(job: Job) {
  const { tenantId, runId, warehouseId } = job.data;
  const { publicDb } = await import("@/lib/db/public-client");
  const { getTenantDb } = await import("@/lib/db/tenant-client");

  const tenant = await publicDb.tenant.findUnique({
    where: { id: tenantId },
    select: { dbSchema: true },
  });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getTenantDb(tenant.dbSchema) as any;

  try {
    await db.slottingRun.update({
      where: { id: runId },
      data: { status: "slotting_running", startedAt: new Date() },
    });

    // Load config
    const config = await db.slottingConfig.findUnique({ where: { warehouseId } });
    const abcA = config?.abcAThreshold ?? 80;
    const abcB = config?.abcBThreshold ?? 95;
    const weightPenalty = config ? Number(config.weightPenalty) : 1;
    const lookbackDays = config?.lookbackDays ?? 90;

    // Gather pick data for ABC classification
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    const pickData = await db.pickTaskLine.groupBy({
      by: ["productId"],
      where: { task: { completedAt: { gte: since } } },
      _sum: { pickedQty: true },
      _count: true,
    });

    const { classifyABC, generateRecommendations } = await import("@/modules/slotting/engine");

    const abc = classifyABC(
      pickData.map(
        (p: { productId: string; _sum: { pickedQty: number | null }; _count: number }) => ({
          productId: p.productId,
          totalPicked: p._sum.pickedQty ?? 0,
          orderCount: p._count,
        })
      ),
      abcA,
      abcB
    );

    // Gather current inventory with bin info
    const inventory = await db.inventory.findMany({
      where: {
        onHand: { gt: 0 },
        bin: { shelf: { rack: { aisle: { zone: { warehouse: { id: warehouseId } } } } } },
      },
      include: { product: { select: { weight: true } }, bin: { include: { shelf: true } } },
    });

    const productInventory = inventory.map(
      (inv: {
        productId: string;
        binId: string;
        bin: { barcode: string; shelf: { code: string } };
        onHand: number;
        product: { weight: unknown };
      }) => ({
        productId: inv.productId,
        binId: inv.binId,
        binBarcode: inv.bin.barcode,
        onHand: inv.onHand,
        weight: Number(inv.product.weight ?? 0),
        shelfLevel: parseInt(inv.bin.shelf?.code ?? "1", 10) || 1,
        zoneType: "storage",
      })
    );

    // Get all available bins for recommendations
    const bins = await db.bin.findMany({
      where: {
        shelf: { rack: { aisle: { zone: { warehouse: { id: warehouseId } } } } },
        status: "available",
      },
      include: { shelf: true },
    });

    const binCandidates = bins.map(
      (b: { id: string; barcode: string; shelf: { code: string }; inventory: unknown[] }) => ({
        binId: b.id,
        barcode: b.barcode,
        shelfLevel: parseInt(b.shelf?.code ?? "1", 10) || 1,
        zoneType: "storage",
        isEmpty: true,
      })
    );

    const recommendations = generateRecommendations(productInventory, binCandidates, abc, {
      abcAThreshold: abcA,
      abcBThreshold: abcB,
      weightPenalty,
    });

    // Write recommendations in batches
    for (const rec of recommendations) {
      await db.slottingRecommendation.create({
        data: {
          runId,
          productId: rec.productId,
          currentBinId: rec.currentBinId,
          recommendedBinId: rec.recommendedBinId,
          abcClass: rec.abcClass,
          pickFrequency: rec.pickFrequency,
          velocityScore: rec.velocityScore,
          weightScore: rec.weightScore,
          ergonomicScore: rec.ergonomicScore,
          totalScore: rec.totalScore,
        },
      });
    }

    await db.slottingRun.update({
      where: { id: runId },
      data: {
        status: "slotting_completed",
        completedAt: new Date(),
        productCount: abc.size,
        recommendationCount: recommendations.length,
      },
    });
  } catch (err) {
    await db.slottingRun.update({
      where: { id: runId },
      data: {
        status: "slotting_failed",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : "Unknown error",
      },
    });
    throw err;
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

  new Worker("wms-slotting", processSlotting, {
    connection,
    concurrency: 1,
  });

  console.warn("[jobs] BullMQ workers started: notifications, integrations, email, slotting");
}
