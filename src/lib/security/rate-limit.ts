/**
 * Simple in-memory rate limiter.
 * Tracks request counts per key within a sliding window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /**
   * Check whether a request identified by `key` is allowed.
   * Cleans up expired entries on each call.
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = Date.now();

    // Clean up expired entries
    for (const [k, entry] of this.store) {
      if (entry.resetAt <= now) {
        this.store.delete(k);
      }
    }

    const existing = this.store.get(key);

    if (!existing || existing.resetAt <= now) {
      // First request in a new window
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: new Date(now + this.windowMs),
      };
    }

    existing.count += 1;
    const remaining = Math.max(0, this.maxRequests - existing.count);
    const allowed = existing.count <= this.maxRequests;

    return {
      allowed,
      remaining,
      resetAt: new Date(existing.resetAt),
    };
  }
}

/** Default rate limiter: 100 requests per minute */
export const rateLimiter = new RateLimiter(100, 60_000);
