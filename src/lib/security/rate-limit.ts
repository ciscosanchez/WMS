/**
 * Distributed rate limiter backed by Redis.
 * Falls back to in-memory if Redis is unavailable (fail-open for availability).
 *
 * Uses fixed-window counting via Redis INCR + EXPIRE.
 */
import { redis } from "@/lib/redis/client";

export class RateLimiter {
  private fallbackStore = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /**
   * Check whether a request identified by `key` is allowed.
   * Uses Redis for distributed counting; falls back to in-memory on error.
   */
  async check(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    try {
      return await this.checkRedis(key);
    } catch {
      // Redis unavailable — fall back to in-memory (fail-open)
      return this.checkMemory(key);
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

  /** In-memory fallback when Redis is unavailable. */
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
