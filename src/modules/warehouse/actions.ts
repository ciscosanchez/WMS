"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAccessibleWarehouseIds } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { generateBinBarcode } from "@/lib/barcode";
import {
  warehouseSchemaStatic as warehouseSchema,
  zoneSchemaStatic as zoneSchema,
  bulkLocationSchema,
  binSchemaStatic as binSchema,
} from "./schemas";
import { mockWarehouses } from "@/lib/mock-data";

async function getReadContext() {
  return requireTenantContext("warehouse:read");
}

export async function getWarehouses() {
  if (config.useMockData) return mockWarehouses;

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  return tenant.db.warehouse.findMany({
    where: accessibleIds ? { id: { in: accessibleIds } } : undefined,
    include: {
      zones: {
        include: {
          aisles: {
            include: {
              racks: {
                include: {
                  shelves: {
                    include: { bins: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });
}

export async function getWarehouse(id: string) {
  if (config.useMockData) return mockWarehouses.find((w) => w.id === id) ?? null;

  // requireTenantContext with warehouseId throws 403 if user has no access to this warehouse
  const { tenant } = await requireTenantContext("warehouse:read", { warehouseId: id });
  return tenant.db.warehouse.findUnique({
    where: { id },
    include: {
      zones: {
        include: {
          aisles: {
            include: {
              racks: {
                include: {
                  shelves: {
                    include: { bins: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function createWarehouse(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id: "mock-new", ...(data as any) };

  const { user, tenant } = await requireTenantContext("warehouse:write");
  const parsed = warehouseSchema.parse(data);

  const warehouse = await tenant.db.warehouse.create({ data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "warehouse",
    entityId: warehouse.id,
  });

  revalidatePath("/warehouse");
  return warehouse;
}

export async function createZone(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id: "mock-new", ...(data as any) };

  const { user, tenant } = await requireTenantContext("warehouse:write");
  const parsed = zoneSchema.parse(data);

  const zone = await tenant.db.zone.create({ data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "zone",
    entityId: zone.id,
  });

  revalidatePath("/warehouse");
  return zone;
}

export async function generateBulkLocations(data: unknown) {
  if (config.useMockData) return { zoneId: "mock-zone", binCount: 0 };

  const { user, tenant } = await requireTenantContext("warehouse:write");
  const parsed = bulkLocationSchema.parse(data);

  // Get or create warehouse
  const warehouse = await tenant.db.warehouse.findUniqueOrThrow({
    where: { id: parsed.warehouseId },
  });

  // Create zone
  const zone = await tenant.db.zone.create({
    data: {
      warehouseId: warehouse.id,
      code: parsed.zoneCode,
      name: parsed.zoneName,
      type: parsed.zoneType,
    },
  });

  let binCount = 0;
  const pad = (n: number) => String(n).padStart(2, "0");

  for (let a = 1; a <= parsed.aisles; a++) {
    const aisle = await tenant.db.aisle.create({
      data: { zoneId: zone.id, code: pad(a) },
    });

    for (let r = 1; r <= parsed.racksPerAisle; r++) {
      const rack = await tenant.db.rack.create({
        data: { aisleId: aisle.id, code: pad(r) },
      });

      for (let s = 1; s <= parsed.shelvesPerRack; s++) {
        const shelf = await tenant.db.shelf.create({
          data: { rackId: rack.id, code: pad(s) },
        });

        for (let b = 1; b <= parsed.binsPerShelf; b++) {
          const binCode = pad(b);
          const barcode = generateBinBarcode(
            warehouse.code,
            parsed.zoneCode,
            pad(a),
            pad(r),
            pad(s),
            binCode
          );

          await tenant.db.bin.create({
            data: {
              shelfId: shelf.id,
              code: binCode,
              barcode,
              type: parsed.binType,
              status: "available",
            },
          });
          binCount++;
        }
      }
    }
  }

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "bulk_locations",
    entityId: zone.id,
    changes: { binCount: { old: 0, new: binCount } },
  });

  revalidatePath("/warehouse");
  return { zoneId: zone.id, binCount };
}

export async function getBins(_warehouseId?: string) {
  if (config.useMockData) return [];

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  return tenant.db.bin.findMany({
    where: accessibleIds
      ? { shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } } }
      : undefined,
    include: {
      shelf: {
        include: {
          rack: {
            include: {
              aisle: {
                include: {
                  zone: {
                    include: { warehouse: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { barcode: "asc" },
  });
}

export async function getBinChoices() {
  if (config.useMockData) return [];

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  return tenant.db.bin.findMany({
    where: accessibleIds
      ? { shelf: { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } } }
      : undefined,
    select: {
      id: true,
      code: true,
    },
    orderBy: { code: "asc" },
  });
}

export async function getBin(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await getReadContext();
  return tenant.db.bin.findUnique({
    where: { id },
    include: {
      shelf: {
        include: {
          rack: {
            include: {
              aisle: {
                include: {
                  zone: {
                    include: { warehouse: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getShelfOptions() {
  if (config.useMockData) return [];

  const { tenant, role, warehouseAccess } = await getReadContext();
  const accessibleIds = getAccessibleWarehouseIds(role, warehouseAccess);

  return tenant.db.shelf.findMany({
    where: accessibleIds
      ? { rack: { aisle: { zone: { warehouseId: { in: accessibleIds } } } } }
      : undefined,
    include: {
      rack: {
        include: {
          aisle: {
            include: {
              zone: {
                include: { warehouse: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ rack: { aisle: { zone: { warehouse: { code: "asc" } } } } }, { code: "asc" }],
  });
}

export async function createBin(data: unknown) {
  if (config.useMockData) return { id: "mock-bin" };

  const { user, tenant } = await requireTenantContext("warehouse:write");
  const parsed = binSchema.parse(data);

  const bin = await tenant.db.bin.create({ data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "bin",
    entityId: bin.id,
  });

  revalidatePath("/warehouse");
  return bin;
}

export async function updateBin(id: string, data: unknown) {
  if (config.useMockData) return { id };

  const { user, tenant } = await requireTenantContext("warehouse:write");
  const parsed = binSchema.parse(data);

  const bin = await tenant.db.bin.update({
    where: { id },
    data: parsed,
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "bin",
    entityId: id,
  });

  revalidatePath("/warehouse");
  return bin;
}
