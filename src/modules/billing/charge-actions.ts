"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const REVALIDATE = "/billing";

// ─── Manual Charge ──────────────────────────────────────────────────────────

const manualChargeSchema = z.object({
  clientId: z.string().min(1),
  serviceType: z.string().min(1),
  qty: z.number().positive(),
  unitRate: z.number().min(0),
  description: z.string().min(1).max(500),
});

export async function addManualCharge(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-charge" };

  try {
    const { user, tenant } = await requireTenantContext("billing:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = manualChargeSchema.parse(data);

    const amount = parsed.qty * parsed.unitRate;

    const event = await db.billingEvent.create({
      data: {
        clientId: parsed.clientId,
        serviceType: parsed.serviceType,
        qty: parsed.qty,
        unitRate: parsed.unitRate,
        amount,
        isManual: true,
        description: parsed.description,
        adjustedById: user.id,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "billing_event",
      entityId: event.id,
      changes: { type: { old: null, new: "manual_charge" } },
    });

    revalidatePath(REVALIDATE);
    return { id: event.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add charge" };
  }
}

// ─── Void Charge ────────────────────────────────────────────────────────────

export async function voidBillingEvent(
  eventId: string,
  reason: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("billing:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const event = await db.billingEvent.findUniqueOrThrow({ where: { id: eventId } });

    if (event.voidedAt) return {}; // Already voided — idempotent
    if (event.invoiceId)
      return { error: "Cannot void an invoiced charge. Void the invoice first." };

    await db.billingEvent.update({
      where: { id: eventId },
      data: { voidedAt: new Date(), voidReason: reason, adjustedById: user.id },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "billing_event",
      entityId: eventId,
      changes: { voided: { old: false, new: true } },
    });

    revalidatePath(REVALIDATE);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to void charge" };
  }
}

// ─── Get Unbilled Events ────────────────────────────────────────────────────

export async function getUnbilledEvents(clientId?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("billing:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { invoiceId: null, voidedAt: null };
  if (clientId) where.clientId = clientId;

  return db.billingEvent.findMany({
    where,
    include: { client: { select: { code: true, name: true } } },
    orderBy: { occurredAt: "desc" },
    take: 500,
  });
}

// ─── Billing Dashboard ──────────────────────────────────────────────────────

export async function getBillingDashboard() {
  if (config.useMockData) {
    return {
      unbilledCount: 0,
      unbilledAmount: 0,
      pendingReview: 0,
      openDisputes: 0,
      overdueAmount: 0,
    };
  }

  const { tenant } = await requireTenantContext("billing:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  const [unbilled, pendingReview, openDisputes, overdue] = await Promise.all([
    db.billingEvent.aggregate({
      where: { invoiceId: null, voidedAt: null },
      _count: true,
      _sum: { amount: true },
    }),
    db.invoice.count({ where: { reviewStatus: "review_pending", status: "draft" } }),
    db.billingDispute.count({
      where: { status: { in: ["dispute_open", "dispute_under_review"] } },
    }),
    db.invoice.aggregate({
      where: { status: "overdue" },
      _sum: { total: true },
    }),
  ]);

  return {
    unbilledCount: unbilled._count ?? 0,
    unbilledAmount: Number(unbilled._sum?.amount ?? 0),
    pendingReview,
    openDisputes,
    overdueAmount: Number(overdue._sum?.total ?? 0),
  };
}
