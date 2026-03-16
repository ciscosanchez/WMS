import { PrismaClient } from "../../../node_modules/.prisma/tenant-client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const LRU_MAX = 50;

const pool = new Map<string, { client: PrismaClient; lastUsed: number }>();

function buildConnectionString(schema: string): string {
  const base = process.env.DATABASE_URL!;
  // Remove any existing schema param
  const url = new URL(base);
  url.searchParams.delete("schema");
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

  const pgPool = new pg.Pool({
    connectionString: buildConnectionString(schema),
  });

  // Set search_path to the tenant schema on every new connection
  const originalConnect = pgPool.connect.bind(pgPool);
  pgPool.connect = async function () {
    const client = await originalConnect();
    await client.query(`SET search_path TO "${schema}"`);
    return client;
  } as any;

  const adapter = new PrismaPg(pgPool as any, { schema });
  const prismaClient = new PrismaClient({ adapter } as any);

  pool.set(schema, { client: prismaClient, lastUsed: Date.now() });
  return prismaClient;
}

export async function disconnectAll() {
  for (const [, { client }] of pool) {
    await client.$disconnect();
  }
  pool.clear();
}
