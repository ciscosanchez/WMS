import { PrismaClient } from "../../../node_modules/.prisma/public-client";

const globalForPrisma = globalThis as unknown as {
  publicPrisma: PrismaClient | undefined;
};

export const publicDb = globalForPrisma.publicPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.publicPrisma = publicDb;
}
