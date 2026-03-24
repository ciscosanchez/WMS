"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequences";
import { assertTransition, RMA_TRANSITIONS } from "@/lib/workflow/transitions";
import { captureEvent } from "@/modules/billing/capture";
import {
  rmaSchemaStatic as rmaSchema,
  returnLineSchemaStatic as returnLineSchema,
  receiveReturnLineSchema,
  inspectReturnLineSchema,
} from "./schemas";

// ─── RMA CRUD ───────────────────────────────────────────────────────────────

export async function getRmas(status?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("returns:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.returnAuthorization.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: status ? { status: status as any } : undefined,
    include: {
      client: { select: { code: true, name: true } },
      order: { select: { orderNumber: true } },
      lines: { include: { product: { select: { sku: true, name: true } } } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRma(id: string) {
  if (config.useMockData) return null;

  const { tenant } = await requireTenantContext("returns:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.returnAuthorization.findUnique({
    where: { id },
    include: {
      client: { select: { code: true, name: true } },
      order: { select: { id: true, orderNumber: true } },
      lines: {
        include: {
          product: { select: { sku: true, name: true } },
          inspections: true,
        },
      },
      inspections: {
        include: {
          line: { include: { product: { select: { sku: true } } } },
          bin: { select: { barcode: true } },
        },
        orderBy: { inspectedAt: "desc" },
      },
    },
  });
}

export async function createRma(
  data: unknown,
  lines: unknown[]
): Promise<{ id?: string; rmaNumber?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-new", rmaNumber: "RMA-MOCK-001" };

  try {
    const { user, tenant } = await requireTenantContext("returns:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = rmaSchema.parse(data);
    const parsedLines = lines.map((l) => returnLineSchema.parse(l));

    if (parsedLines.length === 0) {
      return { error: "At least one return line is required" };
    }

    const rmaNumber = await nextSequence(tenant.db, "RMA");

    const rma = await db.returnAuthorization.create({
      data: {
        rmaNumber,
        clientId: parsed.clientId,
        orderId: parsed.orderId || null,
        reason: parsed.reason,
        notes: parsed.notes || null,
        requestedBy: user.id,
        lines: {
          create: parsedLines.map((line) => ({
            productId: line.productId,
            expectedQty: line.expectedQty,
            uom: line.uom,
            lotNumber: line.lotNumber || null,
            serialNumber: line.serialNumber || null,
            notes: line.notes || null,
          })),
        },
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "return_authorization",
      entityId: rma.id,
    });

    revalidatePath("/returns");
    return { id: rma.id, rmaNumber };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create RMA" };
  }
}

// ─── Status Transitions ─────────────────────────────────────────────────────

export async function updateRmaStatus(id: string, newStatus: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    // Determine required permission based on target status
    const approvalStatuses = ["approved", "rejected"];
    const disposeStatuses = ["rma_completed"];
    let permission = "returns:write";
    if (approvalStatuses.includes(newStatus)) permission = "returns:approve";
    if (disposeStatuses.includes(newStatus)) permission = "returns:dispose";

    const { user, tenant } = await requireTenantContext(permission);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const rma = await db.returnAuthorization.findUniqueOrThrow({ where: { id } });
    assertTransition("rma", rma.status, newStatus, RMA_TRANSITIONS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { status: newStatus };
    const now = new Date();

    if (newStatus === "approved") {
      updateData.approvedBy = user.id;
      updateData.approvedAt = now;
    }
    if (newStatus === "received") {
      updateData.receivedAt = now;
    }
    if (newStatus === "rma_completed") {
      updateData.completedAt = now;
    }

    await db.returnAuthorization.update({ where: { id }, data: updateData });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "return_authorization",
      entityId: id,
      changes: { status: { old: rma.status, new: newStatus } },
    });

    revalidatePath("/returns");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update status" };
  }
}

// ─── Receiving Returns ──────────────────────────────────────────────────────

export async function receiveReturnLine(rmaId: string, data: unknown): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("returns:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = receiveReturnLineSchema.parse(data);

    // Update received qty on line
    await db.returnLine.update({
      where: { id: parsed.lineId },
      data: { receivedQty: { increment: parsed.quantity } },
    });

    // Auto-transition to inspecting if still in received
    await db.returnAuthorization.updateMany({
      where: { id: rmaId, status: "received" },
      data: { status: "inspecting" },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "return_line",
      entityId: parsed.lineId,
      changes: { receivedQty: { old: null, new: parsed.quantity } },
    });

    revalidatePath("/returns");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to receive return line" };
  }
}

// ─── Inspection ─────────────────────────────────────────────────────────────

export async function inspectReturnLine(rmaId: string, data: unknown): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("returns:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = inspectReturnLineSchema.parse(data);

    // Create inspection record
    await db.returnInspection.create({
      data: {
        rmaId,
        lineId: parsed.lineId,
        binId: parsed.binId || null,
        quantity: parsed.quantity,
        condition: parsed.condition,
        disposition: parsed.disposition,
        inspectedBy: user.id,
        notes: parsed.notes || null,
      },
    });

    // Update line disposition
    await db.returnLine.update({
      where: { id: parsed.lineId },
      data: {
        disposition: parsed.disposition,
        dispositionQty: { increment: parsed.quantity },
        dispositionBy: user.id,
        dispositionAt: new Date(),
        dispositionNotes: parsed.notes || null,
      },
    });

    // Check if all lines are dispositioned
    const rma = await db.returnAuthorization.findUnique({
      where: { id: rmaId },
      include: { lines: true },
    });
    const allDispositioned = rma.lines.every(
      (l: { dispositionQty: number; receivedQty: number }) =>
        l.dispositionQty >= l.receivedQty && l.receivedQty > 0
    );
    if (allDispositioned) {
      await db.returnAuthorization.updateMany({
        where: { id: rmaId, status: "inspecting" },
        data: { status: "dispositioned" },
      });
    }

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "return_inspection",
      entityId: rmaId,
    });

    revalidatePath("/returns");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to inspect return line" };
  }
}

// ─── Finalize Return (inventory re-entry) ───────────────────────────────────

export async function finalizeReturn(rmaId: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("returns:dispose");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const rma = await db.returnAuthorization.findUniqueOrThrow({
      where: { id: rmaId },
      include: {
        lines: { include: { inspections: true } },
      },
    });

    if (rma.status !== "dispositioned") {
      return { error: "RMA must be in dispositioned status to finalize" };
    }

    // Process each line based on disposition
    await db.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (prisma: any) => {
        for (const line of rma.lines) {
          if (!line.disposition || line.dispositionQty === 0) continue;

          if (line.disposition === "restock") {
            // Find or create a target bin (use the inspection bin or first available)
            const inspection = line.inspections[0];
            const binId = inspection?.binId;
            if (!binId) continue;

            // Upsert inventory in the target bin
            const existing = await prisma.inventory.findFirst({
              where: {
                productId: line.productId,
                binId,
                lotNumber: line.lotNumber,
                serialNumber: line.serialNumber,
              },
            });

            if (existing) {
              const newOnHand = existing.onHand + line.dispositionQty;
              await prisma.inventory.update({
                where: { id: existing.id },
                data: {
                  onHand: newOnHand,
                  available: newOnHand - existing.allocated,
                },
              });
            } else {
              await prisma.inventory.create({
                data: {
                  productId: line.productId,
                  binId,
                  lotNumber: line.lotNumber,
                  serialNumber: line.serialNumber,
                  onHand: line.dispositionQty,
                  allocated: 0,
                  available: line.dispositionQty,
                },
              });
            }

            // Ledger entry
            await prisma.inventoryTransaction.create({
              data: {
                type: "return_receive",
                productId: line.productId,
                toBinId: binId,
                quantity: line.dispositionQty,
                lotNumber: line.lotNumber,
                serialNumber: line.serialNumber,
                referenceType: "return_authorization",
                referenceId: rmaId,
                performedBy: user.id,
              },
            });
          } else if (line.disposition === "dispose") {
            // Just write a ledger entry for the disposal
            await prisma.inventoryTransaction.create({
              data: {
                type: "return_dispose",
                productId: line.productId,
                quantity: line.dispositionQty,
                lotNumber: line.lotNumber,
                serialNumber: line.serialNumber,
                referenceType: "return_authorization",
                referenceId: rmaId,
                reason: `Disposed: ${line.dispositionNotes ?? ""}`,
                performedBy: user.id,
              },
            });
          }
          // quarantine and repair: items stay in quarantine bin, no inventory change
        }

        // Mark RMA completed
        await prisma.returnAuthorization.update({
          where: { id: rmaId },
          data: { status: "rma_completed", completedAt: new Date() },
        });
      }
    );

    // Billing: charge per unit processed
    const totalUnits = rma.lines.reduce(
      (s: number, l: { dispositionQty: number }) => s + l.dispositionQty,
      0
    );
    if (totalUnits > 0) {
      await captureEvent(tenant.db, {
        clientId: rma.clientId,
        serviceType: "returns_processing",
        qty: totalUnits,
        referenceType: "return_authorization",
        referenceId: rmaId,
      });
    }

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "return_authorization",
      entityId: rmaId,
      changes: { status: { old: "dispositioned", new: "rma_completed" } },
    });

    revalidatePath("/returns");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to finalize return" };
  }
}

// ─── Operator Inspection Queue ──────────────────────────────────────────────

export async function getInspectionQueue() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("returns:write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.returnAuthorization.findMany({
    where: { status: { in: ["received", "inspecting"] } },
    include: {
      client: { select: { code: true, name: true } },
      lines: {
        include: { product: { select: { sku: true, name: true } } },
      },
      _count: { select: { lines: true, inspections: true } },
    },
    orderBy: { receivedAt: "asc" },
  });
}
