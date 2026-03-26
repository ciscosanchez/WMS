"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { moveInventorySchema, adjustmentSchema, adjustmentLineSchema } from "./schemas";
import { mockInventory, mockTransactions, mockAdjustments } from "@/lib/mock-data";
import { suggestPutawayLocation } from "./putaway-engine";
import { notificationQueue, emailQueue } from "@/lib/jobs/queue";
import {
  type PaginatedResult,
  type CursorPaginatedResult,
  paginateQuery,
  buildPaginatedResult,
  cursorPaginateQuery,
  buildCursorResult,
} from "@/lib/pagination";
import { asTenantDb } from "@/lib/tenant/db-types";

async function getReadContext() {
  return requireTenantContext("inventory:read");
}

export async function getInventory(filters?: {
  productId?: string;
  binId?: string;
  clientId?: string;
  search?: string;
  attributeDefinitionId?: string;
  attributeValue?: string;
}) {
  if (config.useMockData) return mockInventory;

  const { tenant } = await getReadContext();
  const tenantDb = asTenantDb(tenant.db);
  const inventoryIds =
    filters?.attributeDefinitionId && filters.attributeValue
      ? (
          await tenantDb.operationalAttributeValue.findMany({
            where: {
              entityScope: "inventory_record",
              definitionId: filters.attributeDefinitionId,
              textValue: { contains: filters.attributeValue, mode: "insensitive" as const },
            },
            select: { entityId: true },
          })
        ).map((row: { entityId: string }) => row.entityId)
      : null;

  return tenant.db.inventory.findMany({
    where: {
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.binId ? { binId: filters.binId } : {}),
      ...(inventoryIds ? { id: { in: inventoryIds } } : {}),
      ...(filters?.search
        ? {
            product: {
              OR: [
                { sku: { contains: filters.search, mode: "insensitive" as const } },
                { name: { contains: filters.search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    include: {
      product: { include: { client: true } },
      bin: {
        include: {
          shelf: {
            include: {
              rack: {
                include: {
                  aisle: {
                    include: {
                      zone: { include: { warehouse: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getInventoryPaginated(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  productId?: string;
  binId?: string;
  attributeDefinitionId?: string;
  attributeValue?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<PaginatedResult<any>> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  if (config.useMockData) {
    let filtered = [...mockInventory];
    if (opts.search) {
      const q = opts.search.toLowerCase();
      filtered = filtered.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i: any) =>
          i.product?.sku?.toLowerCase().includes(q) || i.product?.name?.toLowerCase().includes(q)
      );
    }
    const total = filtered.length;
    const { skip, take } = paginateQuery(page, pageSize);
    return buildPaginatedResult(filtered.slice(skip, skip + take), total, page, pageSize);
  }

  const { tenant } = await getReadContext();
  const tenantDb = asTenantDb(tenant.db);
  const inventoryIds =
    opts.attributeDefinitionId && opts.attributeValue
      ? (
          await tenantDb.operationalAttributeValue.findMany({
            where: {
              entityScope: "inventory_record",
              definitionId: opts.attributeDefinitionId,
              textValue: { contains: opts.attributeValue, mode: "insensitive" as const },
            },
            select: { entityId: true },
          })
        ).map((row: { entityId: string }) => row.entityId)
      : null;

  const where = {
    ...(opts.productId ? { productId: opts.productId } : {}),
    ...(opts.binId ? { binId: opts.binId } : {}),
    ...(inventoryIds ? { id: { in: inventoryIds } } : {}),
    ...(opts.search
      ? {
          product: {
            OR: [
              { sku: { contains: opts.search, mode: "insensitive" as const } },
              { name: { contains: opts.search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const { skip, take } = paginateQuery(page, pageSize);

  const [data, total] = await Promise.all([
    tenant.db.inventory.findMany({
      where,
      include: {
        product: { include: { client: true } },
        bin: {
          include: {
            shelf: {
              include: {
                rack: {
                  include: {
                    aisle: {
                      include: {
                        zone: { include: { warehouse: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    tenant.db.inventory.count({ where }),
  ]);

  return buildPaginatedResult(data, total, page, pageSize);
}

export async function getInventoryTransactions(filters?: { productId?: string; type?: string }) {
  if (config.useMockData)
    return filters?.type
      ? mockTransactions.filter((t) => t.type === filters.type)
      : mockTransactions;

  const { tenant } = await getReadContext();

  return tenant.db.inventoryTransaction.findMany({
    where: {
      ...(filters?.productId ? { productId: filters.productId } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(filters?.type ? { type: filters.type as any } : {}),
    },
    include: {
      product: true,
      fromBin: true,
      toBin: true,
    },
    orderBy: { performedAt: "desc" },
    take: 100,
  });
}

export async function getInventoryTransactionsPaginated(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  productId?: string;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<PaginatedResult<any>> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  if (config.useMockData) {
    let filtered = [...mockTransactions];
    if (opts.type) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filtered = filtered.filter((t: any) => t.type === opts.type);
    }
    if (opts.search) {
      const q = opts.search.toLowerCase();
      filtered = filtered.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) =>
          t.product?.sku?.toLowerCase().includes(q) || t.referenceType?.toLowerCase().includes(q)
      );
    }
    const total = filtered.length;
    const { skip, take } = paginateQuery(page, pageSize);
    return buildPaginatedResult(filtered.slice(skip, skip + take), total, page, pageSize);
  }

  const { tenant } = await getReadContext();

  const where = {
    ...(opts.productId ? { productId: opts.productId } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(opts.type ? { type: opts.type as any } : {}),
    ...(opts.search
      ? {
          product: {
            sku: { contains: opts.search, mode: "insensitive" as const },
          },
        }
      : {}),
  };

  const { skip, take } = paginateQuery(page, pageSize);

  const [data, total] = await Promise.all([
    tenant.db.inventoryTransaction.findMany({
      where,
      include: {
        product: true,
        fromBin: true,
        toBin: true,
      },
      orderBy: { performedAt: "desc" },
      skip,
      take,
    }),
    tenant.db.inventoryTransaction.count({ where }),
  ]);

  return buildPaginatedResult(data, total, page, pageSize);
}

// ─── Cursor-based pagination (high-volume tables) ─────────

export async function getInventoryCursor(opts: {
  cursor?: string | null;
  pageSize?: number;
  search?: string;
  productId?: string;
  binId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<CursorPaginatedResult<any>> {
  const pageSize = opts.pageSize ?? 50;

  if (config.useMockData) {
    return buildCursorResult(
      mockInventory.slice(0, pageSize) as ((typeof mockInventory)[number] & { id: string })[],
      pageSize
    );
  }

  const { tenant } = await getReadContext();

  const where = {
    ...(opts.productId ? { productId: opts.productId } : {}),
    ...(opts.binId ? { binId: opts.binId } : {}),
    ...(opts.search
      ? {
          product: {
            OR: [
              { sku: { contains: opts.search, mode: "insensitive" as const } },
              { name: { contains: opts.search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const paginationArgs = cursorPaginateQuery(pageSize, opts.cursor);

  const data = await tenant.db.inventory.findMany({
    where,
    include: {
      product: { include: { client: true } },
      bin: {
        include: {
          shelf: {
            include: {
              rack: {
                include: {
                  aisle: {
                    include: {
                      zone: { include: { warehouse: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    ...paginationArgs,
  });

  return buildCursorResult(data, pageSize);
}

export async function getTransactionsCursor(opts: {
  cursor?: string | null;
  pageSize?: number;
  productId?: string;
  type?: string;
  search?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<CursorPaginatedResult<any>> {
  const pageSize = opts.pageSize ?? 50;

  if (config.useMockData) {
    return buildCursorResult(
      mockTransactions.slice(0, pageSize) as ((typeof mockTransactions)[number] & { id: string })[],
      pageSize
    );
  }

  const { tenant } = await getReadContext();

  const where = {
    ...(opts.productId ? { productId: opts.productId } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(opts.type ? { type: opts.type as any } : {}),
    ...(opts.search
      ? {
          product: {
            sku: { contains: opts.search, mode: "insensitive" as const },
          },
        }
      : {}),
  };

  const paginationArgs = cursorPaginateQuery(pageSize, opts.cursor);

  const data = await tenant.db.inventoryTransaction.findMany({
    where,
    include: {
      product: true,
      fromBin: true,
      toBin: true,
    },
    orderBy: [{ performedAt: "desc" }, { id: "desc" }],
    ...paginationArgs,
  });

  return buildCursorResult(data, pageSize);
}

export async function getExpiringInventory(daysAhead: number = 30) {
  if (config.useMockData) return [];

  const { tenant } = await getReadContext();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return tenant.db.inventory.findMany({
    where: {
      expirationDate: { lte: cutoff },
      available: { gt: 0 },
    },
    include: {
      product: { include: { client: true } },
      bin: {
        include: {
          shelf: {
            include: {
              rack: {
                include: {
                  aisle: {
                    include: {
                      zone: { include: { warehouse: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { expirationDate: "asc" },
  });
}
