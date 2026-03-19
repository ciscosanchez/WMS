/**
 * Internal billing event capture helper.
 * Not a server action — imported by other modules (receiving, operator, etc.)
 * to emit billing events when warehouse actions complete.
 *
 * Silently does nothing if no rate card is configured — safe to call
 * before billing is set up.
 */

import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";

export const SERVICE_LABELS: Record<string, string> = {
  receiving_pallet: "Receiving (per pallet)",
  receiving_carton: "Receiving (per carton)",
  storage_pallet: "Storage (per pallet/month)",
  storage_sqft: "Storage (per sq ft/month)",
  handling_order: "Handling (per order)",
  handling_line: "Handling (per order line)",
  handling_unit: "Handling (per unit)",
  shipping_markup: "Shipping markup",
  value_add_hour: "Value-add (per hour)",
};

export async function captureEvent(
  db: PrismaClient,
  params: {
    clientId: string;
    serviceType: string;
    qty: number;
    referenceType?: string;
    referenceId?: string;
  }
) {
  try {
    // Client-specific rate card first, then global default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rateCard = await (db as any).rateCard.findFirst({
      where: { clientId: params.clientId, isActive: true },
      include: { lines: true },
    });

    if (!rateCard) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rateCard = await (db as any).rateCard.findFirst({
        where: { clientId: null, isActive: true },
        include: { lines: true },
      });
    }

    if (!rateCard) return null; // No rate card configured yet

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const line = rateCard.lines.find((l: any) => l.serviceType === params.serviceType);
    if (!line) return null; // Service type not in rate card

    const unitRate = Number(line.unitRate);
    const amount = params.qty * unitRate;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (db as any).billingEvent.create({
      data: {
        clientId: params.clientId,
        serviceType: params.serviceType,
        qty: params.qty,
        unitRate,
        amount,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
      },
    });
  } catch {
    // Never let billing failure break the main workflow
    return null;
  }
}
