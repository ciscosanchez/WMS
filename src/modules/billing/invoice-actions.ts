"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";

const REVALIDATE = "/billing";

// ─── Invoice Approval ───────────────────────────────────────────────────────

export async function approveInvoice(
  invoiceId: string,
  notes?: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("billing:approve");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        reviewStatus: "review_approved",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "invoice",
      entityId: invoiceId,
      changes: { reviewStatus: { old: "review_pending", new: "review_approved" } },
    });

    revalidatePath(REVALIDATE);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to approve invoice" };
  }
}

export async function rejectInvoice(invoiceId: string, notes: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("billing:approve");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        reviewStatus: "review_rejected",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "invoice",
      entityId: invoiceId,
      changes: { reviewStatus: { old: "review_pending", new: "review_rejected" } },
    });

    revalidatePath(REVALIDATE);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reject invoice" };
  }
}

// ─── Invoice Lifecycle ──────────────────────────────────────────────────────

export async function markInvoiceSent(
  invoiceId: string,
  method: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("billing:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "sent", sentAt: new Date(), sentMethod: method },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "invoice",
      entityId: invoiceId,
      changes: { status: { old: "draft", new: "sent" } },
    });

    revalidatePath(REVALIDATE);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark sent" };
  }
}

export async function markInvoicePaid(
  invoiceId: string,
  paidAt?: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("billing:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "paid", paidAt: paidAt ? new Date(paidAt) : new Date() },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "invoice",
      entityId: invoiceId,
      changes: { status: { old: "sent", new: "paid" } },
    });

    revalidatePath(REVALIDATE);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark paid" };
  }
}

export async function cancelInvoice(invoiceId: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("billing:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    // Unlink billing events so they can be re-invoiced
    await db.billingEvent.updateMany({
      where: { invoiceId },
      data: { invoiceId: null },
    });

    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "cancelled" },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "invoice",
      entityId: invoiceId,
      changes: { status: { old: null, new: "cancelled" } },
    });

    revalidatePath(REVALIDATE);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to cancel invoice" };
  }
}

// ─── Disputes ───────────────────────────────────────────────────────────────

export async function createDispute(data: {
  invoiceId: string;
  reason: string;
  amount: number;
}): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-dispute" };

  try {
    const { user, tenant } = await requireTenantContext("billing:read");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: data.invoiceId } });

    const dispute = await db.billingDispute.create({
      data: {
        invoiceId: data.invoiceId,
        clientId: invoice.clientId,
        reason: data.reason,
        amount: data.amount,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "billing_dispute",
      entityId: dispute.id,
    });

    revalidatePath(REVALIDATE);
    return { id: dispute.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create dispute" };
  }
}

export async function resolveDispute(
  disputeId: string,
  status: string,
  resolution: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("billing:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.billingDispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
    });

    // If resolved as credit, create a negative billing event
    if (status === "dispute_resolved_credit") {
      const dispute = await db.billingDispute.findUnique({ where: { id: disputeId } });
      if (dispute) {
        await db.billingEvent.create({
          data: {
            clientId: dispute.clientId,
            serviceType: "handling_order",
            qty: 1,
            unitRate: -Number(dispute.amount),
            amount: -Number(dispute.amount),
            isManual: true,
            description: `Credit: ${resolution}`,
            adjustedById: user.id,
            referenceType: "dispute",
            referenceId: disputeId,
          },
        });
      }
    }

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "billing_dispute",
      entityId: disputeId,
      changes: { status: { old: "dispute_open", new: status } },
    });

    revalidatePath(REVALIDATE);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to resolve dispute" };
  }
}

export async function getDisputes(status?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("billing:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.billingDispute.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: status ? { status: status as any } : undefined,
    include: {
      invoice: { select: { invoiceNumber: true } },
      client: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
