/**
 * BullMQ job queues for durable background work.
 * All queues share the same Redis connection (supports auth, TLS, db).
 */
import { Queue, type QueueOptions } from "bullmq";
import { bullmqConnection as connection } from "./redis-connection";

const QUEUE_CONFIG = {
  notifications: {
    name: "wms-notifications",
    options: {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    },
  },
  integrations: {
    name: "wms-integrations",
    options: {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    },
  },
  slotting: {
    name: "wms-slotting",
    options: {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
      },
    },
  },
  reports: {
    name: "wms-reports",
    options: {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    },
  },
  email: {
    name: "wms-email",
    options: {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    },
  },
} as const satisfies Record<string, { name: string; options: QueueOptions }>;

type QueueKey = keyof typeof QUEUE_CONFIG;
type BullQueue = Queue;

const queues = new Map<QueueKey, BullQueue>();

function getQueue(key: QueueKey): BullQueue {
  const existing = queues.get(key);
  if (existing) return existing;

  const config = QUEUE_CONFIG[key];
  const queue = new Queue(config.name, config.options);
  queues.set(key, queue);
  return queue;
}

function createLazyQueue(key: QueueKey): BullQueue {
  return new Proxy({} as BullQueue, {
    get(_target, prop) {
      const queue = getQueue(key);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (queue as any)[prop];
      return typeof value === "function" ? value.bind(queue) : value;
    },
  });
}

/** Notification queue: in-app + email notifications to warehouse team. */
export const notificationQueue = createLazyQueue("notifications");

/** Integration queue: Shopify fulfillment pushes, marketplace syncs. */
export const integrationQueue = createLazyQueue("integrations");

/** Slotting queue: async ABC analysis + recommendation generation. */
export const slottingQueue = createLazyQueue("slotting");

/** Report queue: scheduled report generation and delivery. */
export const reportQueue = createLazyQueue("reports");

/** Email queue: direct customer emails (shipment tracking, etc.). */
export const emailQueue = createLazyQueue("email");
