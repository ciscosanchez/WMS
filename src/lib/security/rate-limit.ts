/**
 * Distributed rate limiter backed by Redis.
 *
 * FAIL-CLOSED: If Redis is unavailable, requests are REJECTED by default.
 * A configurable grace period allows a brief window of degraded (in-memory)
 * rate limiting before fully closing, so a transient Redis restart doesn't
 * instantly lock out all users.
 *
 * Uses fixed-window counting via Redis INCR + EXPIRE.
 */
import { redis } from "@/lib/redis/client";

/** How long to allow in-memory fallback before failing closed (ms) */
const REDIS_GRACE_PERIOD_MS = parseInt(
  process.env.RATE_LIMIT_GRACE_MS ?? "30000",
  10
); // 30 seconds default

export class RateLimiter {
  private fallbackStore = new Map<string, { count: number; resetAt: number }>();
  private redisDownSince: number | null = null;

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /**
   * Check whether a request identified by `key` is allowed.
   * Uses Redis for distributed counting; fails CLOSED if Redis is down
   * beyond the grace period.
   */
  async check(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    try {
      const result = await this.checkRedis(key);
      // Redis is healthy — clear any degraded state
      this.redisDownSince = null;
      return result;
    } catch {
      // Redis unavailable — check grace period
      const now = Date.now();

      if (this.redisDownSince === null) {
        this.redisDownSince = now;
      }

      const downDuration = now - this.redisDownSince;

      if (downDuration <= REDIS_GRACE_PERIOD_MS) {
        // Within grace period — degrade to in-memory rate limiting
        return this.checkMemory(key);
      }

      // Grace period expired — FAIL CLOSED
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + this.windowMs),
      };
    }
  }

  private async checkRedis(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const redisKey = `rl:${key}`;
    const windowSec = Math.ceil(this.windowMs / 1000);

    // Ensure connected (lazy connect)
    if (redis.status === "wait") {
      await redis.connect();
    }

    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }

    const ttl = await redis.ttl(redisKey);
    const resetAt = new Date(Date.now() + ttl * 1000);
    const remaining = Math.max(0, this.maxRequests - count);

    return {
      allowed: count <= this.maxRequests,
      remaining,
      resetAt,
    };
  }

  /**
   * In-memory fallback during Redis grace period.
   * Still enforces limits, but not distributed across instances.
   */
  private checkMemory(key: string): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = Date.now();

    // Clean expired entries
    for (const [k, entry] of this.fallbackStore) {
      if (entry.resetAt <= now) this.fallbackStore.delete(k);
    }

    const existing = this.fallbackStore.get(key);

    if (!existing || existing.resetAt <= now) {
      this.fallbackStore.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: new Date(now + this.windowMs) };
    }

    existing.count += 1;
    const remaining = Math.max(0, this.maxRequests - existing.count);

    return {
      allowed: existing.count <= this.maxRequests,
      remaining,
      resetAt: new Date(existing.resetAt),
    };
  }
}

/** Default rate limiter: 100 requests per minute */
export const rateLimiter = new RateLimiter(100, 60_000);
