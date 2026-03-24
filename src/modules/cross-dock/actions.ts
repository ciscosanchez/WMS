"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import { assertTransition, CROSS_DOCK_TRANSITIONS } from "@/lib/workflow/transitions";
import {
  crossDockRuleSchemaStatic as crossDockRuleSchema,
  crossDockPlanSchemaStatic as crossDockPlanSchema,
  crossDockStatusSchema,
} from "./schemas";

// ─── Rules CRUD ──────────────────────────────────────────────────────────────

export async function getCrossDockRules() {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("cross_dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.crossDockRule.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function createCrossDockRule(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-rule" };

  try {
    const { user, tenant } = await requireTenantContext("cross_dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = crossDockRuleSchema.parse(data);

    const rule = await db.crossDockRule.create({
      data: {
        clientId: parsed.clientId || null,
        productId: parsed.productId || null,
        priority: parsed.priority,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "cross_dock_rule",
      entityId: rule.id,
    });

    revalidatePath("/shipping/cross-dock");
    return { id: rule.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create rule" };
  }
}

export async function deleteCrossDockRule(id: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("cross_dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.crossDockRule.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "cross_dock_rule",
      entityId: id,
    });

    revalidatePath("/shipping/cross-dock");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete rule" };
  }
}

// ─── Cross-Dock Candidate Identification ─────────────────────────────────────

export async function identifyCrossDockCandidates(
  inboundShipmentId: string
): Promise<{
  candidates: Array<{ productId: string; orderId: string; quantity: number }>;
  error?: string;
}> {
  if (config.useMockData) return { candidates: [] };

  try {
    const { tenant } = await requireTenantContext("cross_dock:read");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    // Get active cross-dock rules
    const rules = await db.crossDockRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    });

    // Get inbound shipment lines
    const shipment = await db.inboundShipment.findUniqueOrThrow({
      where: { id: inboundShipmentId },
      include: { lines: true },
    });

    // Get pending outbound orders that could be fulfilled
    const pendingOrders = await db.order.findMany({
      where: { status: { in: ["pending", "awaiting_fulfillment"] } },
      include: { lines: true },
    });

    const candidates: Array<{ productId: string; orderId: string; quantity: number }> = [];

    for (const inboundLine of shipment.lines) {
      // Check if this product matches any cross-dock rule
      const matchesRule =
        rules.length === 0 ||
        rules.some(
          (rule: { clientId: string | null; productId: string | null }) =>
            (!rule.clientId || rule.clientId === shipment.clientId) &&
            (!rule.productId || rule.productId === inboundLine.productId)
        );

      if (!matchesRule) continue;

      // Find pending outbound orders needing this product
      for (const order of pendingOrders) {
        for (const orderLine of order.lines) {
          if (orderLine.productId === inboundLine.productId && orderLine.quantity > 0) {
            const qty = Math.min(inboundLine.expectedQty, orderLine.quantity);
            if (qty > 0) {
              candidates.push({
                productId: inboundLine.productId,
                orderId: order.id,
                quantity: qty,
              });
            }
          }
        }
      }
    }

    return { candidates };
  } catch (err) {
    return {
      candidates: [],
      error: err instanceof Error ? err.message : "Failed to identify candidates",
    };
  }
}

// ─── Plans CRUD ──────────────────────────────────────────────────────────────

export async function createCrossDockPlan(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-plan" };

  try {
    const { user, tenant } = await requireTenantContext("cross_dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = crossDockPlanSchema.parse(data);

    const plan = await db.crossDockPlan.create({
      data: {
        inboundShipmentId: parsed.inboundShipmentId,
        outboundOrderId: parsed.outboundOrderId,
        productId: parsed.productId,
        quantity: parsed.quantity,
        sourceDockDoorId: parsed.sourceDockDoorId || null,
        targetDockDoorId: parsed.targetDockDoorId || null,
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "cross_dock_plan",
      entityId: plan.id,
    });

    revalidatePath("/shipping/cross-dock");
    return { id: plan.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create plan" };
  }
}

export async function getCrossDockPlans(status?: string) {
  if (config.useMockData) return [];

  const { tenant } = await requireTenantContext("cross_dock:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.crossDockPlan.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

// ─── Status Transitions ─────────────────────────────────────────────────────

export async function updateCrossDockStatus(
  id: string,
  newStatus: string
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const parsed = crossDockStatusSchema.parse(newStatus);
    const { user, tenant } = await requireTenantContext("cross_dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const plan = await db.crossDockPlan.findUniqueOrThrow({ where: { id } });
    assertTransition("cross_dock", plan.status, parsed, CROSS_DOCK_TRANSITIONS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { status: parsed };

    await db.crossDockPlan.update({ where: { id }, data: updateData });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "cross_dock_plan",
      entityId: id,
      changes: { status: { old: plan.status, new: parsed } },
    });

    revalidatePath("/shipping/cross-dock");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update status" };
  }
}

export async function completeCrossDock(id: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("cross_dock:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    const plan = await db.crossDockPlan.findUniqueOrThrow({ where: { id } });
    assertTransition("cross_dock", plan.status, "cd_completed", CROSS_DOCK_TRANSITIONS);

    await db.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (prisma: any) => {
        // Mark plan as completed
        await prisma.crossDockPlan.update({
          where: { id },
          data: {
            status: "cd_completed",
            completedAt: new Date(),
          },
        });

        // Record an inventory transaction to reflect the cross-dock movement
        // This skips the putaway step — goods go directly from inbound to outbound
        await prisma.inventoryTransaction.create({
          data: {
            type: "cross_dock",
            productId: plan.productId,
            quantity: plan.quantity,
            referenceType: "cross_dock_plan",
            referenceId: id,
            performedBy: user.id,
          },
        });
      }
    );

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "cross_dock_plan",
      entityId: id,
      changes: { status: { old: plan.status, new: "cd_completed" } },
    });

    revalidatePath("/shipping/cross-dock");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to complete cross-dock" };
  }
}
