import { PrismaClient } from "../../../node_modules/.prisma/tenant-client";

const LRU_MAX = 50;

const pool = new Map<string, { client: PrismaClient; lastUsed: number }>();

function buildUrl(schema: string): string {
  const base = process.env.DATABASE_URL!;
  const url = new URL(base);
  url.searchParams.set("schema", schema);
  return url.toString();
}

export function getTenantDb(schema: string): PrismaClient {
  const existing = pool.get(schema);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.client;
  }

  // Evict oldest if at capacity
  if (pool.size >= LRU_MAX) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [key, value] of pool) {
      if (value.lastUsed < oldestTime) {
        oldestTime = value.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const evicted = pool.get(oldestKey);
      evicted?.client.$disconnect();
      pool.delete(oldestKey);
    }
  }

  const client = new PrismaClient({
    datasourceUrl: buildUrl(schema),
  });

  pool.set(schema, { client, lastUsed: Date.now() });
  return client;
}

export async function disconnectAll() {
  for (const [, { client }] of pool) {
    await client.$disconnect();
  }
  pool.clear();
}
