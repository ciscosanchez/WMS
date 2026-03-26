"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { createLpnSchema, addContentSchema, moveLpnSchema, receiveLpnSchema } from "./schemas";
import {
  copyOperationalAttributeValuesBetweenScopes,
  saveOperationalAttributeValuesForEntity,
} from "@/modules/attributes/value-service";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getContext() {
  return requireTenantContext("inventory:read");
}

async function getWriteContext() {
  return requireTenantContext("inventory:write");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(tenant: { db: unknown }): any {
  return tenant.db;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getLpns(filters?: { status?: string; search?: string }) {
  if (config.useMockData) return [];

  const { tenant } = await getContext();

  return db(tenant).lpn.findMany({
    where: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(filters?.status ? { status: filters.status as any } : {}),
      ...(filters?.search
        ? { lpnNumber: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
    },
    include: {
      bin: {
        include: {
          shelf: {
            include: {
              rack: {
                include: {
                  aisle: {
                    include: { zone: { include: { warehouse: true } } },
                  },
                },
              },
            },
          },
        },
      },
      contents: {
        include: { product: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLpn(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await getContext();

  return db(tenant).lpn.findUnique({
    where: { id },
    include: {
      bin: {
        include: {
          shelf: {
            include: {
              rack: {
                include: {
                  aisle: {
                    include: { zone: { include: { warehouse: true } } },
                  },
                },
              },
            },
          },
        },
      },
      contents: {
        include: { product: { include: { client: true } } },
      },
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function createLpn(data: unknown) {
  if (config.useMockData) return { id: "mock-lpn", lpnNumber: "LPN-MOCK-0001" };

  const { user, tenant } = await getWriteContext();
  const parsed = createLpnSchema.parse(data);
  const lpnNumber = await nextSequence(tenant.db, "LPN");

  const lpn = await db(tenant).lpn.create({
    data: {
      lpnNumber,
      binId: parsed.binId || null,
      palletType: parsed.palletType || null,
      totalWeight: parsed.totalWeight ?? null,
      notes: parsed.notes || null,
      contents: {
        create: parsed.contents.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          lotNumber: c.lotNumber || null,
          serialNumber: c.serialNumber || null,
        })),
      },
    },
    include: { contents: true },
  });

  await saveOperationalAttributeValuesForEntity({
    db: tenant.db,
    userId: user.id,
    entityScope: "lpn",
    entityId: lpn.id,
    values: parsed.operationalAttributes ?? [],
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "lpn",
    entityId: lpn.id,
  });

  revalidatePath("/inventory/lpn");
  return lpn;
}

export async function addContentToLpn(data: unknown) {
  if (config.useMockData) return { id: "mock-content" };

  const { user, tenant } = await getWriteContext();
  const parsed = addContentSchema.parse(data);

  const lpn = await db(tenant).lpn.findUnique({ where: { id: parsed.lpnId } });
  if (!lpn) throw new Error("LPN not found");
  if (lpn.status === "lpn_consumed") throw new Error("Cannot add to consumed LPN");

  const content = await db(tenant).lpnContent.create({
    data: {
      lpnId: parsed.lpnId,
      productId: parsed.productId,
      quantity: parsed.quantity,
      lotNumber: parsed.lotNumber || null,
      serialNumber: parsed.serialNumber || null,
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "lpn",
    entityId: parsed.lpnId,
  });

  revalidatePath("/inventory/lpn");
  return content;
}

export async function moveLpn(data: unknown) {
  if (config.useMockData) return { id: "mock-lpn", status: "lpn_in_transit" };

  const { user, tenant } = await getWriteContext();
  const parsed = moveLpnSchema.parse(data);

  const lpn = await db(tenant).lpn.findUnique({ where: { id: parsed.lpnId } });
  if (!lpn) throw new Error("LPN not found");
  if (lpn.status === "lpn_consumed") throw new Error("Cannot move consumed LPN");

  const updated = await db(tenant).lpn.update({
    where: { id: parsed.lpnId },
    data: {
      binId: parsed.targetBinId,
      status: "lpn_active",
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "lpn_move",
    entityId: parsed.lpnId,
  });

  revalidatePath("/inventory/lpn");
  return updated;
}

export async function consumeLpn(lpnId: string) {
  if (config.useMockData) return { id: lpnId, status: "lpn_consumed" };

  const { user, tenant } = await getWriteContext();

  const lpn = await db(tenant).lpn.findUnique({
    where: { id: lpnId },
    include: { contents: true },
  });
  if (!lpn) throw new Error("LPN not found");
  if (lpn.status === "lpn_consumed") throw new Error("LPN already consumed");
  if (!lpn.binId) throw new Error("LPN has no bin assigned, cannot break down into inventory");

  // Atomic: create individual inventory records for each content line, then mark consumed
  const result = await db(tenant).$transaction(async (prisma: any) => {
    for (const line of lpn.contents) {
      const existing = await prisma.inventory.findFirst({
        where: {
          productId: line.productId,
          binId: lpn.binId!,
          lotNumber: line.lotNumber || null,
          serialNumber: line.serialNumber || null,
        },
      });

      if (existing) {
        await prisma.inventory.update({
          where: { id: existing.id },
          data: {
            onHand: { increment: line.quantity },
            available: { increment: line.quantity },
          },
        });
        await copyOperationalAttributeValuesBetweenScopes({
          db: prisma,
          userId: user.id,
          sourceScope: "lpn",
          sourceEntityId: lpn.id,
          targetScope: "inventory_record",
          targetEntityId: existing.id,
        });
      } else {
        const inventory = await prisma.inventory.create({
          data: {
            productId: line.productId,
            binId: lpn.binId!,
            lotNumber: line.lotNumber || null,
            serialNumber: line.serialNumber || null,
            onHand: line.quantity,
            allocated: 0,
            available: line.quantity,
          },
        });
        await copyOperationalAttributeValuesBetweenScopes({
          db: prisma,
          userId: user.id,
          sourceScope: "lpn",
          sourceEntityId: lpn.id,
          targetScope: "inventory_record",
          targetEntityId: inventory.id,
        });
      }

      // Log inventory transaction
      await prisma.inventoryTransaction.create({
        data: {
          type: "receive",
          productId: line.productId,
          toBinId: lpn.binId!,
          quantity: line.quantity,
          lotNumber: line.lotNumber || null,
          serialNumber: line.serialNumber || null,
          reason: `LPN ${lpn.lpnNumber} consumed`,
          performedBy: user.id,
        },
      });
    }

    return prisma.lpn.update({
      where: { id: lpnId },
      data: { status: "lpn_consumed" },
    });
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "lpn_consume",
    entityId: lpnId,
  });

  revalidatePath("/inventory/lpn");
  revalidatePath("/inventory");
  return result;
}

export async function receiveLpn(data: unknown) {
  if (config.useMockData) return { id: "mock-lpn", lpnNumber: "LPN-MOCK-0001" };

  const { user, tenant } = await getWriteContext();
  const parsed = receiveLpnSchema.parse(data);
  const lpnNumber = await nextSequence(tenant.db, "LPN");

  // One-scan receive: create LPN + contents + inventory in one transaction
  const result = await db(tenant).$transaction(async (prisma: any) => {
    const lpn = await prisma.lpn.create({
      data: {
        lpnNumber,
        binId: parsed.binId,
        palletType: parsed.palletType || null,
        totalWeight: parsed.totalWeight ?? null,
        notes: parsed.notes || null,
        contents: {
          create: parsed.contents.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
            lotNumber: c.lotNumber || null,
            serialNumber: c.serialNumber || null,
          })),
        },
      },
      include: { contents: true },
    });

    // Also create inventory records
    for (const line of parsed.contents) {
      const existing = await prisma.inventory.findFirst({
        where: {
          productId: line.productId,
          binId: parsed.binId,
          lotNumber: line.lotNumber || null,
          serialNumber: line.serialNumber || null,
        },
      });

      if (existing) {
        await prisma.inventory.update({
          where: { id: existing.id },
          data: {
            onHand: { increment: line.quantity },
            available: { increment: line.quantity },
          },
        });
        await copyOperationalAttributeValuesBetweenScopes({
          db: prisma,
          userId: user.id,
          sourceScope: "lpn",
          sourceEntityId: lpn.id,
          targetScope: "inventory_record",
          targetEntityId: existing.id,
        });
      } else {
        const inventory = await prisma.inventory.create({
          data: {
            productId: line.productId,
            binId: parsed.binId,
            lotNumber: line.lotNumber || null,
            serialNumber: line.serialNumber || null,
            onHand: line.quantity,
            allocated: 0,
            available: line.quantity,
          },
        });
        await copyOperationalAttributeValuesBetweenScopes({
          db: prisma,
          userId: user.id,
          sourceScope: "lpn",
          sourceEntityId: lpn.id,
          targetScope: "inventory_record",
          targetEntityId: inventory.id,
        });
      }

      await prisma.inventoryTransaction.create({
        data: {
          type: "receive",
          productId: line.productId,
          toBinId: parsed.binId,
          quantity: line.quantity,
          lotNumber: line.lotNumber || null,
          serialNumber: line.serialNumber || null,
          reason: `LPN receive: ${lpnNumber}`,
          performedBy: user.id,
        },
      });
    }

    return lpn;
  });

  await saveOperationalAttributeValuesForEntity({
    db: tenant.db,
    userId: user.id,
    entityScope: "lpn",
    entityId: result.id,
    values: parsed.operationalAttributes ?? [],
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "lpn_receive",
    entityId: result.id,
  });

  revalidatePath("/inventory/lpn");
  revalidatePath("/inventory");
  return result;
}
