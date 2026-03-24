"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import {
  kitDefinitionSchemaStatic as kitDefinitionSchema,
  vasTaskSchemaStatic as vasTaskSchema,
} from "./schemas";

// ─── Kit Definition CRUD ────────────────────────────────────────────────────

export async function getKitDefinitions() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("orders:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.kitDefinition.findMany({
    include: {
      product: { select: { sku: true, name: true } },
      components: {
        include: {
          product: { select: { sku: true, name: true } },
        },
      },
      _count: { select: { components: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getKitDefinition(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await requireTenantContext("orders:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.kitDefinition.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      components: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
        },
      },
    },
  });
}

export async function createKitDefinition(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-kit" };

  try {
    const { user, tenant } = await requireTenantContext("orders:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = kitDefinitionSchema.parse(data);

    const kit = await db.kitDefinition.create({
      data: {
        productId: parsed.productId,
        name: parsed.name,
        isActive: parsed.isActive,
        components: {
          create: parsed.components.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
          })),
        },
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "kit_definition",
      entityId: kit.id,
    });

    revalidatePath("/products/kits");
    return { id: kit.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create kit" };
  }
}

export async function updateKitDefinition(id: string, data: unknown): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("orders:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = kitDefinitionSchema.parse(data);

    await db.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (prisma: any) => {
        // Update kit definition
        await prisma.kitDefinition.update({
          where: { id },
          data: {
            productId: parsed.productId,
            name: parsed.name,
            isActive: parsed.isActive,
          },
        });

        // Delete existing components and recreate
        await prisma.kitComponent.deleteMany({ where: { kitId: id } });
        await prisma.kitComponent.createMany({
          data: parsed.components.map((c) => ({
            kitId: id,
            productId: c.productId,
            quantity: c.quantity,
          })),
        });
      }
    );

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "kit_definition",
      entityId: id,
    });

    revalidatePath("/products/kits");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update kit" };
  }
}

export async function deleteKitDefinition(id: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("orders:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    // Soft delete — mark as inactive
    await db.kitDefinition.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "kit_definition",
      entityId: id,
    });

    revalidatePath("/products/kits");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete kit" };
  }
}

// ─── VAS Task CRUD ──────────────────────────────────────────────────────────

export async function getVasTasks(status?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("operator:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.vasTask.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function getVasTask(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await requireTenantContext("operator:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.vasTask.findUnique({
    where: { id },
  });
}

export async function createVasTask(
  data: unknown
): Promise<{ id?: string; taskNumber?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-vas", taskNumber: "VAS-MOCK-001" };

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = vasTaskSchema.parse(data);

    const taskNumber = await nextSequence(tenant.db, "VAS");

    const task = await db.vasTask.create({
      data: {
        taskNumber,
        orderId: parsed.orderId || null,
        type: parsed.type,
        instructions: parsed.instructions || null,
        assignedTo: parsed.assignedTo || null,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "vas_task",
      entityId: task.id,
    });

    revalidatePath("/products/kits");
    return { id: task.id, taskNumber };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create VAS task" };
  }
}

export async function completeVasTask(id: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const task = await db.vasTask.findUniqueOrThrow({ where: { id } });

    if (task.status === "vas_completed") {
      return { error: "Task is already completed" };
    }

    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      status: "vas_completed",
      completedAt: now,
    };

    // If the task was pending, also set startedAt
    if (task.status === "vas_pending") {
      updateData.startedAt = now;
    }

    await db.vasTask.update({
      where: { id },
      data: updateData,
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "vas_task",
      entityId: id,
      changes: { status: { old: task.status, new: "vas_completed" } },
    });

    revalidatePath("/products/kits");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to complete VAS task" };
  }
}
