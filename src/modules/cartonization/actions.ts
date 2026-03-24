"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { cartonize, type PackItem, type BoxType, type PackedCarton } from "./algorithm";
import { z } from "zod";

// ─── Carton Type CRUD ───────────────────────────────────────────────────────

const cartonTypeSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  dimUnit: z.string().default("in"),
  maxWeight: z.number().positive(),
  weightUnit: z.string().default("lb"),
  tareWeight: z.number().min(0).default(0),
  cost: z.number().min(0).optional().nullable(),
});

export async function getCartonTypes() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("shipping:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.cartonType.findMany({
    where: { isActive: true },
    orderBy: [{ length: "asc" }, { width: "asc" }],
  });
}

export async function createCartonType(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-new" };

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = cartonTypeSchema.parse(data);

    const carton = await db.cartonType.create({ data: parsed });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "carton_type",
      entityId: carton.id,
    });

    revalidatePath("/shipping/carton-types");
    return { id: carton.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create carton type" };
  }
}

export async function updateCartonType(id: string, data: unknown): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = cartonTypeSchema.parse(data);

    await db.cartonType.update({ where: { id }, data: parsed });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "carton_type",
      entityId: id,
    });

    revalidatePath("/shipping/carton-types");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update carton type" };
  }
}

export async function deleteCartonType(id: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.cartonType.update({ where: { id }, data: { isActive: false } });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "carton_type",
      entityId: id,
    });

    revalidatePath("/shipping/carton-types");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete carton type" };
  }
}

// ─── Auto-Cartonization ─────────────────────────────────────────────────────

/**
 * Run cartonization algorithm for a shipment and return the suggested pack plan.
 * Does NOT persist — call savePackPlan() to commit.
 */
export async function autoCartonize(
  shipmentId: string
): Promise<{ plan?: PackedCarton[]; error?: string }> {
  if (config.useMockData) return { plan: [] };

  try {
    const { tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const shipment = await db.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        items: { include: { product: true } },
      },
    });

    const boxes: BoxType[] = await db.cartonType
      .findMany({
        where: { isActive: true },
      })
      .then(
        (
          types: {
            id: string;
            code: string;
            length: unknown;
            width: unknown;
            height: unknown;
            maxWeight: unknown;
            tareWeight: unknown;
          }[]
        ) =>
          types.map((t) => ({
            id: t.id,
            code: t.code,
            length: Number(t.length),
            width: Number(t.width),
            height: Number(t.height),
            maxWeight: Number(t.maxWeight),
            tareWeight: Number(t.tareWeight),
          }))
      );

    if (boxes.length === 0) {
      return { error: "No carton types configured. Add carton types in Settings > Shipping." };
    }

    const items: PackItem[] = shipment.items.map(
      (item: {
        productId: string;
        quantity: number;
        lotNumber: string | null;
        serialNumber: string | null;
        product: { weight: unknown; length: unknown; width: unknown; height: unknown };
      }) => ({
        productId: item.productId,
        quantity: item.quantity,
        weight: Number(item.product.weight ?? 0),
        length: Number(item.product.length ?? 0),
        width: Number(item.product.width ?? 0),
        height: Number(item.product.height ?? 0),
        lotNumber: item.lotNumber,
        serialNumber: item.serialNumber,
      })
    );

    const plan = cartonize(items, boxes);
    return { plan };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cartonization failed" };
  }
}

/**
 * Persist a pack plan (auto-generated or operator-adjusted) for a shipment.
 */
export async function savePackPlan(
  shipmentId: string,
  plan: PackedCarton[]
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    // Delete existing pack plan for this shipment (replace)
    await db.packPlanLine.deleteMany({
      where: { packPlan: { shipmentId } },
    });
    await db.packPlan.deleteMany({ where: { shipmentId } });

    // Create new pack plans
    for (const carton of plan) {
      await db.packPlan.create({
        data: {
          shipmentId,
          cartonTypeId: carton.cartonTypeId,
          cartonSeq: carton.cartonSeq,
          totalWeight: carton.totalWeight,
          lines: {
            create: carton.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              lotNumber: item.lotNumber ?? null,
              serialNumber: item.serialNumber ?? null,
            })),
          },
        },
      });
    }

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "pack_plan",
      entityId: shipmentId,
      changes: { cartons: { old: 0, new: plan.length } },
    });

    revalidatePath("/pack");
    revalidatePath("/shipping");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save pack plan" };
  }
}

/**
 * Get the persisted pack plan for a shipment.
 */
export async function getPackPlan(shipmentId: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("shipping:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.packPlan.findMany({
    where: { shipmentId },
    include: {
      cartonType: { select: { code: true, name: true, length: true, width: true, height: true } },
      lines: { include: { product: { select: { sku: true, name: true } } } },
    },
    orderBy: { cartonSeq: "asc" },
  });
}
