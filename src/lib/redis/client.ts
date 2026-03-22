/**
 * Shared Redis client singleton.
 * Used by: rate limiter, BullMQ job queues.
 * Set REDIS_URL in env (defaults to redis://localhost:6379).
 *
 * Lazy connect: the client doesn't connect until the first command.
 * If Redis is unavailable, callers should handle the error gracefully.
 */
import Redis from "ioredis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableReadyCheck: false,
      connectTimeout: 3000,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying
        return Math.min(times * 200, 2000);
      },
    });
    _redis.on("error", () => {
      // Suppress connection errors — callers handle via try/catch
    });
  }
  return _redis;
}

// For direct import convenience (connects on first command)
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
