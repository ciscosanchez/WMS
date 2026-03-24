/**
 * Shared Redis connection config for BullMQ.
 *
 * Parses the full REDIS_URL including auth, TLS (rediss://), and database.
 * Used by both queue producers (queue.ts) and in-process workers (worker.ts).
 */

export function parseRedisUrl(url: string): Record<string, unknown> {
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

export const bullmqConnection = parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379");
