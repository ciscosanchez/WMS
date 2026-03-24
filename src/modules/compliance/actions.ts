"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import {
  complianceCheckSchemaStatic as complianceCheckSchema,
  resolveCheckSchemaStatic as resolveCheckSchema,
  hazmatFlagSchemaStatic as hazmatFlagSchema,
  hsCodeSchemaStatic as hsCodeSchema,
} from "./schemas";

const REVALIDATE_PATH = "/shipping/compliance";

// ─── Compliance Checks ─────────────────────────────────────────────

export async function getComplianceChecks(
  entityType?: string,
  status?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("shipping:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (status) where.status = status;

  return db.complianceCheck.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function createComplianceCheck(
  data: unknown
): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-check" };

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = complianceCheckSchema.parse(data);

    const check = await db.complianceCheck.create({
      data: {
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        checkType: parsed.checkType,
        details: parsed.details || null,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "compliance_check",
      entityId: check.id,
    });

    revalidatePath(REVALIDATE_PATH);
    return { id: check.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create compliance check",
    };
  }
}

export async function resolveComplianceCheck(
  id: string,
  data: unknown
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = resolveCheckSchema.parse(data);

    const existing = await db.complianceCheck.findUnique({ where: { id } });
    if (!existing) return { error: "Check not found" };

    await db.complianceCheck.update({
      where: { id },
      data: {
        status: parsed.status,
        details: parsed.details ?? existing.details,
        resolvedBy: user.id,
        resolvedAt: new Date(),
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "compliance_check",
      entityId: id,
      changes: { status: { old: null, new: parsed.status } },
    });

    revalidatePath(REVALIDATE_PATH);
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to resolve compliance check",
    };
  }
}

// ─── Hazmat Flags ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getHazmatFlags(): Promise<any[]> {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("shipping:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.hazmatFlag.findMany({
    include: { product: true },
    orderBy: { product: { name: "asc" } },
  });
}

export async function setHazmatFlag(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-hazmat" };

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = hazmatFlagSchema.parse(data);

    const flag = await db.hazmatFlag.upsert({
      where: { productId: parsed.productId },
      create: {
        productId: parsed.productId,
        unNumber: parsed.unNumber || null,
        hazClass: parsed.hazClass || null,
        packingGroup: parsed.packingGroup || null,
        properName: parsed.properName || null,
        isRestricted: parsed.isRestricted,
      },
      update: {
        unNumber: parsed.unNumber || null,
        hazClass: parsed.hazClass || null,
        packingGroup: parsed.packingGroup || null,
        properName: parsed.properName || null,
        isRestricted: parsed.isRestricted,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "hazmat_flag",
      entityId: flag.id,
    });

    revalidatePath(REVALIDATE_PATH);
    return { id: flag.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to set hazmat flag",
    };
  }
}

export async function removeHazmatFlag(productId: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("shipping:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const existing = await db.hazmatFlag.findUnique({
      where: { productId },
    });
    if (!existing) return { error: "Hazmat flag not found" };

    await db.hazmatFlag.delete({ where: { productId } });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "hazmat_flag",
      entityId: existing.id,
    });

    revalidatePath(REVALIDATE_PATH);
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to remove hazmat flag",
    };
  }
}

// ─── HS Code Validation ────────────────────────────────────────────

export async function validateHsCode(hsCode: string): Promise<{ valid: boolean; error?: string }> {
  try {
    hsCodeSchema.parse({ hsCode });
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid HS code format",
    };
  }
}
