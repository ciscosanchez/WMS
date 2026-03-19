"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { SERVICE_LABELS } from "./capture";

async function getContext() {
  return requireTenantContext();
}

// ─── Rate Cards ──────────────────────────────────────────────────────────────

/** Returns the effective rate card lines for a client (client-specific or default). */
export async function getRateCard(clientId: string | null) {
  const { tenant } = await getContext();
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (clientId) {
    const card = await db.rateCard.findFirst({
      where: { clientId, isActive: true },
      include: { lines: true },
    });
    if (card) return card;
  }

  // Fall back to global default
  return db.rateCard.findFirst({
    where: { clientId: null, isActive: true },
    include: { lines: true },
  });
}

/**
 * Returns full billing config for the settings page:
 *   - default rate card (lines + monthlyMinimum)
 *   - all clients with their custom rate cards
 */
export async function getBillingConfig() {
  const { tenant } = await getContext();
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [defaultCard, clients, clientCards] = await Promise.all([
    db.rateCard.findFirst({
      where: { clientId: null, isActive: true },
      include: { lines: true },
    }),
    db.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.rateCard.findMany({
      where: { clientId: { not: null }, isActive: true },
      include: { lines: true },
    }),
  ]);

  const cardByClientId = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clientCards.map((c: any) => [c.clientId, c])
  );

  return {
    defaultCard: defaultCard ?? null,
    clients: clients.map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      id: c.id,
      name: c.name,
      rateCard: cardByClientId[c.id] ?? null,
    })),
  };
}

/** Create or replace the global default rate card. */
export async function saveDefaultRateCard(
  lines: Array<{ serviceType: string; unitRate: number; uom: string }>,
  monthlyMinimum: number
) {
  const { user, tenant } = await requireTenantContext("settings:write");
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const existing = await db.rateCard.findFirst({ where: { clientId: null } });

  if (existing) {
    await db.rateCardLine.deleteMany({ where: { rateCardId: existing.id } });
    await db.rateCard.update({
      where: { id: existing.id },
      data: {
        monthlyMinimum,
        lines: { create: lines.map((l) => ({ serviceType: l.serviceType, unitRate: l.unitRate, uom: l.uom })) },
      },
    });
  } else {
    await db.rateCard.create({
      data: {
        clientId: null,
        monthlyMinimum,
        lines: { create: lines.map((l) => ({ serviceType: l.serviceType, unitRate: l.unitRate, uom: l.uom })) },
      },
    });
  }

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "rate_card",
    entityId: "default",
  });

  revalidatePath("/settings/billing");
}

/** Create or replace a client-specific rate card. */
export async function saveClientRateCard(
  clientId: string,
  lines: Array<{ serviceType: string; unitRate: number; uom: string }>,
  monthlyMinimum: number
) {
  const { user, tenant } = await requireTenantContext("settings:write");
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const existing = await db.rateCard.findFirst({ where: { clientId } });

  if (existing) {
    await db.rateCardLine.deleteMany({ where: { rateCardId: existing.id } });
    await db.rateCard.update({
      where: { id: existing.id },
      data: {
        monthlyMinimum,
        lines: { create: lines.map((l) => ({ serviceType: l.serviceType, unitRate: l.unitRate, uom: l.uom })) },
      },
    });
  } else {
    await db.rateCard.create({
      data: {
        clientId,
        monthlyMinimum,
        lines: { create: lines.map((l) => ({ serviceType: l.serviceType, unitRate: l.unitRate, uom: l.uom })) },
      },
    });
  }

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "rate_card",
    entityId: clientId,
  });

  revalidatePath("/settings/billing");
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export async function getInvoices(clientId?: string) {
  const { tenant } = await getContext();
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  return db.invoice.findMany({
    where: clientId ? { clientId } : undefined,
    include: {
      client: { select: { id: true, name: true } },
      lines: true,
      _count: { select: { billingEvents: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoice(id: string) {
  const { tenant } = await getContext();
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  return db.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lines: true,
      billingEvents: true,
    },
  });
}

/**
 * Aggregate uninvoiced billing events for a client in the date range,
 * group by service type, apply monthly minimum, and create an invoice.
 */
export async function generateInvoice(
  clientId: string,
  fromDate: Date,
  toDate: Date
) {
  const { user, tenant } = await requireTenantContext("settings:write");
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Fetch uninvoiced events in range
  const events = await db.billingEvent.findMany({
    where: {
      clientId,
      invoiceId: null,
      occurredAt: { gte: fromDate, lte: toDate },
    },
  });

  if (events.length === 0) {
    throw new Error("No uninvoiced billing events found in this period");
  }

  // Group by service type
  type GroupEntry = { qty: number; unitRate: number; amount: number };
  const grouped = events.reduce((acc: Record<string, GroupEntry>, ev: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const key = ev.serviceType;
    if (!acc[key]) acc[key] = { qty: 0, unitRate: Number(ev.unitRate), amount: 0 };
    acc[key].qty += Number(ev.qty);
    acc[key].amount += Number(ev.amount);
    return acc;
  }, {} as Record<string, GroupEntry>);

  const invoiceLines = (Object.entries(grouped) as [string, GroupEntry][]).map(([serviceType, data]) => ({
    description: SERVICE_LABELS[serviceType] ?? serviceType,
    serviceType,
    qty: data.qty,
    unitRate: data.unitRate,
    amount: data.amount,
  }));

  const subtotal = invoiceLines.reduce((sum, l) => sum + l.amount, 0);

  // Apply monthly minimum if configured
  const rateCard = await db.rateCard.findFirst({
    where: { OR: [{ clientId }, { clientId: null }] },
    orderBy: { clientId: "asc" }, // client-specific first (non-null sorts before null)
  });
  const monthlyMinimum = rateCard ? Number(rateCard.monthlyMinimum) : 0;
  const total = Math.max(subtotal, monthlyMinimum);

  const invoiceNumber = await nextSequence(tenant.db, "INV");

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      clientId,
      status: "draft",
      periodStart: fromDate,
      periodEnd: toDate,
      subtotal,
      total,
      dueDate: new Date(toDate.getTime() + 30 * 24 * 60 * 60 * 1000), // Net 30
      lines: {
        create: invoiceLines,
      },
    },
    include: { lines: true },
  });

  // Mark events as invoiced
  await db.billingEvent.updateMany({
    where: {
      clientId,
      invoiceId: null,
      occurredAt: { gte: fromDate, lte: toDate },
    },
    data: { invoiceId: invoice.id },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "invoice",
    entityId: invoice.id,
  });

  revalidatePath("/reports");
  return invoice;
}

// ─── Billing Summary ─────────────────────────────────────────────────────────

/**
 * MTD billing summary — aggregated by service type.
 * Used by reports page and portal billing KPIs.
 */
export async function getBillingSummaryMTD(clientId?: string) {
  const { tenant } = await getContext();
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const events = await db.billingEvent.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      occurredAt: { gte: monthStart },
    },
    select: { serviceType: true, amount: true },
  });

  const byService: Record<string, number> = {};
  for (const ev of events) {
    const label = SERVICE_LABELS[ev.serviceType] ?? ev.serviceType;
    byService[label] = (byService[label] ?? 0) + Number(ev.amount);
  }

  return Object.entries(byService).map(([name, value]) => ({ name, value }));
}

/**
 * Portal-specific: returns invoices + MTD summary for the client
 * associated with the current authenticated user (matched by contactEmail),
 * or null if no match.
 */
export async function getPortalBillingData() {
  const { user, tenant } = await getContext();
  const db = tenant.db as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Find client by contact email, fall back to first active client for admins
  let client = await db.client.findFirst({
    where: { contactEmail: user.email, isActive: true },
  });

  if (!client) {
    client = await db.client.findFirst({ where: { isActive: true } });
  }

  if (!client) return null;

  const [invoices, mtdSummary] = await Promise.all([
    db.invoice.findMany({
      where: { clientId: client.id },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getBillingSummaryMTD(client.id),
  ]);

  // Compute outstanding balance (draft + sent + overdue)
  const outstanding = invoices
    .filter((inv: any) => ["draft", "sent", "overdue"].includes(inv.status)) // eslint-disable-line @typescript-eslint/no-explicit-any
    .reduce((sum: number, inv: any) => sum + Number(inv.total), 0); // eslint-disable-line @typescript-eslint/no-explicit-any

  return {
    client,
    invoices,
    mtdSummary,
    outstanding,
  };
}
