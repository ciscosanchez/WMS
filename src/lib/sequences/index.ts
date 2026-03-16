import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";

export async function nextSequence(db: PrismaClient, prefix: string): Promise<string> {
  const year = new Date().getFullYear();

  const counter = await db.sequenceCounter.upsert({
    where: {
      prefix_year: { prefix, year },
    },
    update: {
      current: { increment: 1 },
    },
    create: {
      prefix,
      year,
      current: 1,
    },
  });

  const padded = String(counter.current).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}
