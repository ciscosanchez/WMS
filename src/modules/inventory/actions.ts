"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { moveInventorySchema, adjustmentSchema, adjustmentLineSchema } from "./schemas";
import { mockInventory, mockTransactions, mockAdjustments } from "@/lib/mock-data";
import { type PaginatedResult, paginateQuery, buildPaginatedResult } from "@/lib/pagination";

async function getContext() {
  return requireTenantContext();
}

export async function getInventory(filters?: {
  productId?: string;
  binId?: string;
  clientId?: string;
  search?: string;
}) {
  if (config.useMockData) return mockInventory;

  const { tenant } = await getContext();

  return tenant.db.inventory.findMany({
    where: {
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.binId ? { binId: filters.binId } : {}),
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

  const { tenant } = await getContext();

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

  const { tenant } = await getContext();

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

  const { tenant } = await getContext();

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

export async function moveInventory(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id: "mock-new", type: "move", ...(data as any) };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const parsed = moveInventorySchema.parse(data);

  // Find source inventory
  const source = await tenant.db.inventory.findFirst({
    where: {
      productId: parsed.productId,
      binId: parsed.fromBinId,
      lotNumber: parsed.lotNumber || null,
      serialNumber: parsed.serialNumber || null,
    },
  });

  if (!source || source.available < parsed.quantity) {
    throw new Error("Insufficient available inventory");
  }

  // Atomic: deduct source, credit destination, log ledger
  const tx = await tenant.db.$transaction(async (prisma) => {
    // Re-check availability inside the transaction to prevent races
    const locked = await prisma.inventory.findFirst({
      where: { id: source.id, available: { gte: parsed.quantity } },
    });
    if (!locked) throw new Error("Insufficient available inventory (concurrent modification)");

    // Deduct from source
    await prisma.inventory.update({
      where: { id: source.id },
      data: {
        onHand: { decrement: parsed.quantity },
        available: { decrement: parsed.quantity },
      },
    });

    // Add to destination
    const destExisting = await prisma.inventory.findFirst({
      where: {
        productId: parsed.productId,
        binId: parsed.toBinId,
        lotNumber: parsed.lotNumber || null,
        serialNumber: parsed.serialNumber || null,
      },
    });

    if (destExisting) {
      await prisma.inventory.update({
        where: { id: destExisting.id },
        data: {
          onHand: { increment: parsed.quantity },
          available: { increment: parsed.quantity },
        },
      });
    } else {
      await prisma.inventory.create({
        data: {
          productId: parsed.productId,
          binId: parsed.toBinId,
          lotNumber: parsed.lotNumber || null,
          serialNumber: parsed.serialNumber || null,
          onHand: parsed.quantity,
          allocated: 0,
          available: parsed.quantity,
        },
      });
    }

    // Log transaction
    return prisma.inventoryTransaction.create({
      data: {
        type: "move",
        productId: parsed.productId,
        fromBinId: parsed.fromBinId,
        toBinId: parsed.toBinId,
        quantity: parsed.quantity,
        lotNumber: parsed.lotNumber || null,
        serialNumber: parsed.serialNumber || null,
        reason: parsed.reason || null,
        performedBy: user.id,
      },
    });
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "inventory_move",
    entityId: tx.id,
  });

  revalidatePath("/inventory");
  return tx;
}

export async function createAdjustment(headerData: unknown, lines: unknown[]) {
  if (config.useMockData)
    return {
      id: "mock-new",
      adjustmentNumber: "ADJ-MOCK-0001",
      status: "draft",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(headerData as any),
    };

  const { user, tenant } = await requireTenantContext("inventory:write");
  const header = adjustmentSchema.parse(headerData);
  const parsedLines = lines.map((l) => adjustmentLineSchema.parse(l));

  const adjustmentNumber = await nextSequence(tenant.db, "ADJ");

  const adjustment = await tenant.db.inventoryAdjustment.create({
    data: {
      adjustmentNumber,
      type: header.type,
      status: "draft",
      reason: header.reason || null,
      notes: header.notes || null,
      createdBy: user.id,
      lines: {
        create: parsedLines.map((line) => ({
          productId: line.productId,
          binId: line.binId,
          lotNumber: line.lotNumber || null,
          serialNumber: line.serialNumber || null,
          systemQty: line.systemQty,
          countedQty: line.countedQty,
          variance: line.countedQty - line.systemQty,
          notes: line.notes || null,
        })),
      },
    },
    include: { lines: true },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "inventory_adjustment",
    entityId: adjustment.id,
  });

  revalidatePath("/inventory/adjustments");
  return adjustment;
}

export async function approveAdjustment(id: string) {
  if (config.useMockData) return;

  const { user, tenant } = await requireTenantContext("inventory:adjust");

  const adjustment = await tenant.db.inventoryAdjustment.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });

  if (adjustment.status === "completed") return; // Already applied — idempotent

  // Atomic: apply all adjustment lines + mark completed in one transaction
  await tenant.db.$transaction(async (prisma) => {
    // Re-check status inside transaction to prevent concurrent approvals
    const current = await prisma.inventoryAdjustment.findUnique({
      where: { id },
      select: { status: true },
    });
    if (current?.status === "completed") return;

    for (const line of adjustment.lines) {
      const inv = await prisma.inventory.findFirst({
        where: {
          productId: line.productId,
          binId: line.binId,
          lotNumber: line.lotNumber,
          serialNumber: line.serialNumber,
        },
      });

      if (inv) {
        const newOnHand = line.countedQty;
        await prisma.inventory.update({
          where: { id: inv.id },
          data: {
            onHand: newOnHand,
            available: newOnHand - inv.allocated,
          },
        });
      } else if (line.countedQty > 0) {
        await prisma.inventory.create({
          data: {
            productId: line.productId,
            binId: line.binId,
            lotNumber: line.lotNumber,
            serialNumber: line.serialNumber,
            onHand: line.countedQty,
            allocated: 0,
            available: line.countedQty,
          },
        });
      }

      // Log transaction
      await prisma.inventoryTransaction.create({
        data: {
          type: "adjust",
          productId: line.productId,
          toBinId: line.binId,
          quantity: line.variance,
          lotNumber: line.lotNumber,
          serialNumber: line.serialNumber,
          referenceType: "adjustment",
          referenceId: id,
          reason: adjustment.reason || null,
          performedBy: user.id,
        },
      });
    }

    await prisma.inventoryAdjustment.update({
      where: { id },
      data: {
        status: "completed",
        approvedBy: user.id,
        approvedAt: new Date(),
        completedAt: new Date(),
      },
    });
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "inventory_adjustment",
    entityId: id,
    changes: { status: { old: "pending_approval", new: "completed" } },
  });

  revalidatePath("/inventory/adjustments");
}

export async function getAdjustments() {
  if (config.useMockData) return mockAdjustments;

  const { tenant } = await getContext();
  return tenant.db.inventoryAdjustment.findMany({
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
}
