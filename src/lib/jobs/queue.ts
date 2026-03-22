/**
 * BullMQ job queues for durable background work.
 * All queues share the same Redis connection (supports auth, TLS, db).
 */
import { Queue } from "bullmq";
import { bullmqConnection as connection } from "./redis-connection";

/** Notification queue: in-app + email notifications to warehouse team. */
export const notificationQueue = new Queue("wms-notifications", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

/** Integration queue: Shopify fulfillment pushes, marketplace syncs. */
export const integrationQueue = new Queue("wms-integrations", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

/** Email queue: direct customer emails (shipment tracking, etc.). */
export const emailQueue = new Queue("wms-email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});
