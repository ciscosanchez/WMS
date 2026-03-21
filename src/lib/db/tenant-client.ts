import { PrismaClient } from "../../../node_modules/.prisma/tenant-client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Shared connection pool for all tenant schemas.
 *
 * Instead of creating one pg.Pool per tenant (which causes connection explosion),
 * all tenants share a single pool. PrismaPg sets `search_path` per connection
 * checkout via the `{ schema }` option, so queries are correctly scoped.
 *
 * Connection math: 1 pool × max connections = bounded total, regardless of tenant count.
 */
const sharedPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX ?? "20", 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/**
 * LRU cache for PrismaClient instances.
 * PrismaClient is lightweight when sharing a pool — no per-tenant connections.
 * We cache to avoid re-creating adapters on every request.
 */
const LRU_MAX = 100; // Can be higher now since clients don't own pools
const cache = new Map<string, { client: PrismaClient; lastUsed: number }>();

export function getTenantDb(schema: string): PrismaClient {
  const existing = cache.get(schema);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.client;
  }

  // Evict oldest if at capacity
  if (cache.size >= LRU_MAX) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [key, value] of cache) {
      if (value.lastUsed < oldestTime) {
        oldestTime = value.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      cache.delete(oldestKey);
      // No $disconnect needed — the shared pool stays open
    }
  }

  // PrismaPg sets search_path on each connection from the shared pool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(sharedPool as any, { schema });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaClient = new PrismaClient({ adapter } as any);

  cache.set(schema, { client: prismaClient, lastUsed: Date.now() });
  return prismaClient;
}

export async function disconnectAll() {
  cache.clear();
  await sharedPool.end();
}
