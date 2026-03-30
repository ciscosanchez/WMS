"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { SERVICE_LABELS } from "./capture";

type GroupEntry = { qty: number; unitRate: number; amount: number };

// ─── Single Client Invoice ──────────────────────────────────────────────────

/**
 * Generate an invoice for a single client from unbilled billing events
 * in the given date range.
 *
 * Steps:
 *  1. Query unbilled billing events for the client in [periodStart, periodEnd]
 *  2. Group events by service type
 *  3. Create Invoice + InvoiceLine records
 *  4. Link billing events to the invoice (sets invoiceId)
 *  5. Apply monthly minimum from rate card
 */
export async function generateInvoice(clientId: string, periodStart: Date, periodEnd: Date) {
  const { user, tenant } = await requireTenantContext("billing:write");
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const invoice = await db.$transaction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (prisma: any) => {
      // 1. Query unbilled events
      const events = await prisma.billingEvent.findMany({
        where: {
          clientId,
          invoiceId: null,
          voidedAt: null,
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
      });

      if (events.length === 0) {
        throw new Error("No uninvoiced billing events found in this period");
      }

      // 2. Group by service type
      const grouped = events.reduce(
        (
          acc: Record<string, GroupEntry>,
          ev: {
            serviceType: string;
            unitRate: number | string;
            qty: number | string;
            amount: number | string;
          }
        ) => {
          const key = ev.serviceType;
          if (!acc[key]) {
            acc[key] = { qty: 0, unitRate: Number(ev.unitRate), amount: 0 };
          }
          acc[key].qty += Number(ev.qty);
          acc[key].amount += Number(ev.amount);
          return acc;
        },
        {} as Record<string, GroupEntry>
      );

      const invoiceLines = (Object.entries(grouped) as [string, GroupEntry][]).map(
        ([serviceType, data]) => ({
          description: SERVICE_LABELS[serviceType] ?? serviceType,
          serviceType,
          qty: data.qty,
          unitRate: data.unitRate,
          amount: data.amount,
        })
      );

      const subtotal = invoiceLines.reduce((sum, line) => sum + line.amount, 0);

      // 5. Apply monthly minimum from rate card
      const rateCard = await prisma.rateCard.findFirst({
        where: { OR: [{ clientId }, { clientId: null }] },
        orderBy: { clientId: "asc" }, // client-specific first
      });
      const monthlyMinimum = rateCard ? Number(rateCard.monthlyMinimum) : 0;
      const total = Math.max(subtotal, monthlyMinimum);

      const invoiceNumber = await nextSequence(prisma, "INV");

      // 3. Create Invoice + InvoiceLine records
      const created = await prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId,
          status: "draft",
          periodStart,
          periodEnd,
          subtotal,
          total,
          dueDate: new Date(periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000),
          lines: { create: invoiceLines },
        },
        include: { lines: true },
      });

      // 4. Link billing events to the invoice
      await prisma.billingEvent.updateMany({
        where: {
          id: { in: events.map((e: { id: string }) => e.id) },
          invoiceId: null,
        },
        data: { invoiceId: created.id },
      });

      return created;
    }
  );

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "invoice",
    entityId: invoice.id,
  });

  revalidatePath("/billing");
  revalidatePath("/reports");
  return invoice;
}

// ─── Bulk Invoice Generation ────────────────────────────────────────────────

export type BulkInvoiceResult = {
  clientId: string;
  clientName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
};

/**
 * Generate invoices for ALL active clients that have unbilled billing events
 * in the given period. Returns a summary of each client's result.
 */
export async function generateAllInvoices(
  periodStart: Date,
  periodEnd: Date
): Promise<BulkInvoiceResult[]> {
  const { user, tenant } = await requireTenantContext("billing:write");
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Find active clients that have at least one unbilled event in the period
  const clients = await db.client.findMany({
    where: {
      isActive: true,
      billingEvents: {
        some: {
          invoiceId: null,
          voidedAt: null,
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
      },
    },
    select: { id: true, name: true },
  });

  if (clients.length === 0) return [];

  const results: BulkInvoiceResult[] = [];

  for (const client of clients as { id: string; name: string }[]) {
    try {
      const invoice = await generateSingleInvoice(db, client.id, periodStart, periodEnd);

      await logAudit(tenant.db, {
        userId: user.id,
        action: "create",
        entityType: "invoice",
        entityId: invoice.id,
      });

      results.push({
        clientId: client.id,
        clientName: client.name,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });
    } catch (err) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        error: err instanceof Error ? err.message : "Failed to generate invoice",
      });
    }
  }

  revalidatePath("/billing");
  revalidatePath("/reports");
  return results;
}

// ─── Internal: transaction-based single invoice generation ──────────────────

/**
 * Core invoice generation logic used by both single and bulk flows.
 * Runs inside a Prisma transaction.
 */
async function generateSingleInvoice(
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  clientId: string,
  periodStart: Date,
  periodEnd: Date
) {
  return db.$transaction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (prisma: any) => {
      const events = await prisma.billingEvent.findMany({
        where: {
          clientId,
          invoiceId: null,
          voidedAt: null,
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
      });

      if (events.length === 0) {
        throw new Error("No uninvoiced billing events found");
      }

      const grouped = events.reduce(
        (
          acc: Record<string, GroupEntry>,
          ev: {
            serviceType: string;
            unitRate: number | string;
            qty: number | string;
            amount: number | string;
          }
        ) => {
          const key = ev.serviceType;
          if (!acc[key]) {
            acc[key] = { qty: 0, unitRate: Number(ev.unitRate), amount: 0 };
          }
          acc[key].qty += Number(ev.qty);
          acc[key].amount += Number(ev.amount);
          return acc;
        },
        {} as Record<string, GroupEntry>
      );

      const invoiceLines = (Object.entries(grouped) as [string, GroupEntry][]).map(
        ([serviceType, data]) => ({
          description: SERVICE_LABELS[serviceType] ?? serviceType,
          serviceType,
          qty: data.qty,
          unitRate: data.unitRate,
          amount: data.amount,
        })
      );

      const subtotal = invoiceLines.reduce((sum, line) => sum + line.amount, 0);

      const rateCard = await prisma.rateCard.findFirst({
        where: { OR: [{ clientId }, { clientId: null }] },
        orderBy: { clientId: "asc" },
      });
      const monthlyMinimum = rateCard ? Number(rateCard.monthlyMinimum) : 0;
      const total = Math.max(subtotal, monthlyMinimum);

      const invoiceNumber = await nextSequence(prisma, "INV");

      const created = await prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId,
          status: "draft",
          periodStart,
          periodEnd,
          subtotal,
          total,
          dueDate: new Date(periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000),
          lines: { create: invoiceLines },
        },
        include: { lines: true },
      });

      await prisma.billingEvent.updateMany({
        where: {
          id: { in: events.map((e: { id: string }) => e.id) },
          invoiceId: null,
        },
        data: { invoiceId: created.id },
      });

      return created;
    }
  );
}
