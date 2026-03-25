"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { assertTransition, CUSTOMS_ENTRY_TRANSITIONS } from "@/lib/workflow/transitions";
import {
  createCustomsEntrySchemaStatic as createEntrySchema,
  customsEntryLineSchemaStatic as lineSchema,
  customsEntryStatusSchema,
  bondedInventorySchemaStatic as bondedSchema,
} from "./schemas";

const REVALIDATE_PATH = "/shipping/customs";

// ─── Customs entries ────────────────────────────────────────────────────────

export async function getCustomsEntries(filters?: { status?: string; search?: string }) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("customs:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.customsEntry.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { entryNumber: { contains: filters.search, mode: "insensitive" } },
              { carrier: { contains: filters.search, mode: "insensitive" } },
              { brokerName: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomsEntry(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await requireTenantContext("customs:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.customsEntry.findUnique({
    where: { id },
    include: { lines: true },
  });
}

export async function createCustomsEntry(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-entry" };

  try {
    const { user, tenant } = await requireTenantContext("customs:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = createEntrySchema.parse(data);

    const entry = await db.customsEntry.create({
      data: {
        entryType: parsed.entryType,
        shipmentId: parsed.shipmentId || null,
        portOfEntry: parsed.portOfEntry || null,
        carrier: parsed.carrier || null,
        vesselName: parsed.vesselName || null,
        voyageNumber: parsed.voyageNumber || null,
        estimatedArrival: parsed.estimatedArrival || null,
        brokerName: parsed.brokerName || null,
        brokerRef: parsed.brokerRef || null,
        notes: parsed.notes || null,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "customs_entry",
      entityId: entry.id,
    });

    revalidatePath(REVALIDATE_PATH);
    return { id: entry.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create customs entry" };
  }
}

export async function updateEntryStatus(
  id: string,
  newStatus: string
): Promise<{ success?: boolean; error?: string }> {
  if (config.useMockData) return { success: true };

  try {
    const { user, tenant } = await requireTenantContext("customs:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const parsed = customsEntryStatusSchema.parse(newStatus);

    const entry = await db.customsEntry.findUnique({ where: { id } });
    if (!entry) return { error: "Entry not found" };

    assertTransition("customs_entry", entry.status, parsed, CUSTOMS_ENTRY_TRANSITIONS);

    const updateData: Record<string, unknown> = { status: parsed };
    if (parsed === "ce_filed") updateData.filedAt = new Date();
    if (parsed === "ce_cleared") updateData.clearedAt = new Date();

    await db.customsEntry.update({ where: { id }, data: updateData });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update_status",
      entityType: "customs_entry",
      entityId: id,
      meta: { from: entry.status, to: parsed },
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update status" };
  }
}

export async function fileCustomsEntry(id: string): Promise<{ success?: boolean; error?: string }> {
  if (config.useMockData) return { success: true };

  try {
    const { user, tenant } = await requireTenantContext("customs:file");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const entry = await db.customsEntry.findUnique({ where: { id } });
    if (!entry) return { error: "Entry not found" };

    assertTransition("customs_entry", entry.status, "ce_filed", CUSTOMS_ENTRY_TRANSITIONS);

    await db.customsEntry.update({
      where: { id },
      data: { status: "ce_filed", filedAt: new Date() },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "file",
      entityType: "customs_entry",
      entityId: id,
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to file entry" };
  }
}

// ─── Entry lines ────────────────────────────────────────────────────────────

export async function addEntryLine(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-line" };

  try {
    const { user, tenant } = await requireTenantContext("customs:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = lineSchema.parse(data);

    const line = await db.customsEntryLine.create({
      data: {
        entryId: parsed.entryId,
        hsCode: parsed.hsCode,
        description: parsed.description,
        countryOrigin: parsed.countryOrigin,
        quantity: parsed.quantity,
        value: parsed.value,
        dutyRate: parsed.dutyRate ?? null,
        dutyAmount: parsed.dutyAmount ?? null,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "customs_entry_line",
      entityId: line.id,
      meta: { entryId: parsed.entryId },
    });

    revalidatePath(REVALIDATE_PATH);
    return { id: line.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add line" };
  }
}

export async function deleteEntryLine(id: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("customs:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.customsEntryLine.delete({ where: { id } });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "customs_entry_line",
      entityId: id,
    });

    revalidatePath(REVALIDATE_PATH);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete line" };
  }
}

// ─── Bonded inventory ───────────────────────────────────────────────────────

export async function getBondedInventory(filters?: { productId?: string; entryId?: string }) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("customs:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.bondedInventory.findMany({
    where: {
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.entryId ? { entryId: filters.entryId } : {}),
    },
    orderBy: { entryDate: "desc" },
  });
}

export async function createBondedRecord(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-bonded" };

  try {
    const { user, tenant } = await requireTenantContext("customs:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = bondedSchema.parse(data);

    const record = await db.bondedInventory.create({
      data: {
        productId: parsed.productId,
        binId: parsed.binId || null,
        entryId: parsed.entryId || null,
        quantity: parsed.quantity,
        bondNumber: parsed.bondNumber || null,
        bondType: parsed.bondType || null,
        entryDate: parsed.entryDate,
        releaseDate: parsed.releaseDate || null,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "bonded_inventory",
      entityId: record.id,
    });

    revalidatePath(REVALIDATE_PATH);
    return { id: record.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create bonded record" };
  }
}

export async function releaseBondedRecord(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  if (config.useMockData) return { success: true };

  try {
    const { user, tenant } = await requireTenantContext("customs:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.bondedInventory.update({
      where: { id },
      data: { releaseDate: new Date() },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "release",
      entityType: "bonded_inventory",
      entityId: id,
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to release bonded record" };
  }
}
