"use server";

import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAccessibleWarehouseIds } from "@/lib/auth/rbac";
import { mockInventory, mockTransactions } from "@/lib/mock-data";
import {
  type PaginatedResult,
  type CursorPaginatedResult,
  paginateQuery,
  buildPaginatedResult,
  cursorPaginateQuery,
  buildCursorResult,
} from "@/lib/pagination";
import { asTenantDb, type TenantDb } from "@/lib/tenant/db-types";

async function getReadContext() {
  return requireTenantContext("inventory:read");
}

/** Returns a Prisma `where` clause fragment that scopes inventory records to
 *  accessible warehouses via the bin→shelf→rack→aisle→zone chain.
 *  Returns {} (no filter) when the user is unrestricted. */
function warehouseFilter(accessibleIds: string[] | null) {
  if (accessibleIds === null) return {};
  return {
    bin: { shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } } },
  };
}

type RawInventoryAttributeValue = {
  entityId: string;
  textValue?: string | null;
  numberValue?: number | null;
  booleanValue?: boolean | null;
  dateValue?: Date | null;
  jsonValue?: unknown;
};

function toSearchableAttributeText(value: RawInventoryAttributeValue) {
  if (value.numberValue !== null && value.numberValue !== undefined)
    return String(value.numberValue);
  if (value.booleanValue !== null && value.booleanValue !== undefined) {
    return value.booleanValue ? "true yes" : "false no";
  }
  if (value.dateValue) return value.dateValue.toISOString().slice(0, 10);
  if (value.jsonValue !== null && value.jsonValue !== undefined) {
    if (Array.isArray(value.jsonValue)) return value.jsonValue.map(String).join(", ");
    return JSON.stringify(value.jsonValue);
  }
  return value.textValue ?? "";
}

type InventoryRowBase = {
  id: string;
  productId: string;
  binId: string;
  lotNumber: string | null;
  serialNumber: string | null;
  expirationDate: Date | null;
  onHand: number;
  allocated: number;
  available: number;
  uom: string;
  createdAt: Date;
  updatedAt: Date;
};

type InventoryProductChoice = {
  id: string;
  sku: string;
  name: string;
  clientId: string;
};

type InventoryBinChoice = {
  id: string;
  barcode: string;
};

type InventoryClientChoice = {
  id: string;
  code: string;
};

async function attachInventoryRelations(tenantDb: TenantDb, rows: InventoryRowBase[]) {
  const productIds = [...new Set(rows.map((row) => row.productId))];
  const binIds = [...new Set(rows.map((row) => row.binId))];

  const [products, bins] = (await Promise.all([
    productIds.length
      ? tenantDb.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            sku: true,
            name: true,
            clientId: true,
          },
        })
      : Promise.resolve([]),
    binIds.length
      ? tenantDb.bin.findMany({
          where: { id: { in: binIds } },
          select: {
            id: true,
            barcode: true,
          },
        })
      : Promise.resolve([]),
  ])) as [InventoryProductChoice[], InventoryBinChoice[]];

  const clientIds = [...new Set(products.map((product) => product.clientId).filter(Boolean))];
  const clients = (
    clientIds.length
      ? await tenantDb.client.findMany({
          where: { id: { in: clientIds } },
          select: {
            id: true,
            code: true,
          },
        })
      : []
  ) as InventoryClientChoice[];

  const productMap = new Map(products.map((product) => [product.id, product]));
  const binMap = new Map(bins.map((bin) => [bin.id, bin]));
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  return rows.map((row) => {
    const product = productMap.get(row.productId);
    const client = product ? clientMap.get(product.clientId) : null;
    const bin = binMap.get(row.binId);

    return {
      ...row,
      product: {
        sku: product?.sku ?? "UNKNOWN",
        name: product?.name ?? "Missing product",
        client: { code: client?.code ?? "-" },
      },
      bin: {
        barcode: bin?.barcode ?? "Missing bin",
      },
    };
  });
}

async function getInventoryIdsMatchingAttributeFilter(
  tenantDb: TenantDb,
  attributeDefinitionId: string,
  attributeValue: string
) {
  const normalizedQuery = attributeValue.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const values = (await tenantDb.operationalAttributeValue.findMany({
    where: {
      entityScope: "inventory_record",
      definitionId: attributeDefinitionId,
    },
    select: {
      entityId: true,
      textValue: true,
      numberValue: true,
      booleanValue: true,
      dateValue: true,
      jsonValue: true,
    },
  })) as RawInventoryAttributeValue[];

  return values
    .filter((value) => toSearchableAttributeText(value).toLowerCase().includes(normalizedQuery))
    .map((value) => value.entityId);
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

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  const tenantDb = asTenantDb(tenant.db);
  const inventoryIds =
    filters?.attributeDefinitionId && filters.attributeValue
      ? await getInventoryIdsMatchingAttributeFilter(
          tenantDb,
          filters.attributeDefinitionId,
          filters.attributeValue
        )
      : null;

  const rows = await tenant.db.inventory.findMany({
    where: {
      ...warehouseFilter(accessibleIds),
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
    orderBy: { updatedAt: "desc" },
  });

  return attachInventoryRelations(tenantDb, rows as InventoryRowBase[]);
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

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  const tenantDb = asTenantDb(tenant.db);
  const inventoryIds =
    opts.attributeDefinitionId && opts.attributeValue
      ? await getInventoryIdsMatchingAttributeFilter(
          tenantDb,
          opts.attributeDefinitionId,
          opts.attributeValue
        )
      : null;

  const where = {
    ...warehouseFilter(accessibleIds),
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

  const [rows, total] = await Promise.all([
    tenant.db.inventory.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    tenant.db.inventory.count({ where }),
  ]);

  const data = await attachInventoryRelations(tenantDb, rows as InventoryRowBase[]);
  return buildPaginatedResult(data, total, page, pageSize);
}

export async function getInventoryTransactions(filters?: { productId?: string; type?: string }) {
  if (config.useMockData)
    return filters?.type
      ? mockTransactions.filter((t) => t.type === filters.type)
      : mockTransactions;

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  const txBinFilter =
    accessibleIds !== null
      ? {
          fromBin: { shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } } },
        }
      : {};

  return tenant.db.inventoryTransaction.findMany({
    where: {
      ...txBinFilter,
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

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  const txBinFilter =
    accessibleIds !== null
      ? {
          fromBin: { shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } } },
        }
      : {};

  const where = {
    ...txBinFilter,
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

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  const where = {
    ...warehouseFilter(accessibleIds),
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

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  // Transactions filter via fromBin (the source bin is in an accessible warehouse)
  const binFilter =
    accessibleIds !== null
      ? {
          fromBin: { shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } } },
        }
      : {};

  const where = {
    ...binFilter,
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

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return tenant.db.inventory.findMany({
    where: {
      ...warehouseFilter(accessibleIds),
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
