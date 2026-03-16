import { PrismaClient } from "../../../node_modules/.prisma/public-client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  publicPrisma: PrismaClient | undefined;
};

function createClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

export const publicDb = globalForPrisma.publicPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.publicPrisma = publicDb;
}
