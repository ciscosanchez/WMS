"use server";

import { z } from "zod";
import { requireTenantContext } from "@/lib/tenant/context";
import { publicDb } from "@/lib/db/public-client";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// ── Notification Categories ──────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = [
  "shipment_arrived",
  "receiving_completed",
  "order_shipped",
  "low_stock_alert",
  "pick_task_assigned",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPref {
  category: NotificationCategory;
  inApp: boolean;
  email: boolean;
}

export type NotificationPrefsMap = Record<NotificationCategory, { inApp: boolean; email: boolean }>;

const DEFAULT_PREFS: NotificationPrefsMap = {
  shipment_arrived: { inApp: true, email: false },
  receiving_completed: { inApp: true, email: false },
  order_shipped: { inApp: true, email: true },
  low_stock_alert: { inApp: true, email: true },
  pick_task_assigned: { inApp: true, email: false },
};

// ── Zod Schema ───────────────────────────────────────────────────────────────

const notificationPrefSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES),
  inApp: z.boolean(),
  email: z.boolean(),
});

const updatePrefsSchema = z.array(notificationPrefSchema).min(1);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract notificationPrefs from a TenantUser's permissionOverrides JSON.
 * The permissionOverrides field stores `{ grants, denies, notificationPrefs }`.
 */
function extractPrefs(overrides: unknown): NotificationPrefsMap {
  if (!overrides || typeof overrides !== "object") return { ...DEFAULT_PREFS };

  const obj = overrides as Record<string, unknown>;
  const stored = obj.notificationPrefs as
    | Record<string, { inApp?: boolean; email?: boolean }>
    | undefined;

  if (!stored || typeof stored !== "object") return { ...DEFAULT_PREFS };

  const result = { ...DEFAULT_PREFS };
  for (const cat of NOTIFICATION_CATEGORIES) {
    if (stored[cat]) {
      result[cat] = {
        inApp: stored[cat].inApp ?? DEFAULT_PREFS[cat].inApp,
        email: stored[cat].email ?? DEFAULT_PREFS[cat].email,
      };
    }
  }
  return result;
}

function mergePrefsIntoOverrides(
  existing: unknown,
  prefs: NotificationPrefsMap
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: any =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : { grants: [], denies: [] };

  base.notificationPrefs = prefs;
  return base as Record<string, unknown>;
}

// ── Server Actions ───────────────────────────────────────────────────────────

/**
 * Get the current user's notification preferences for the active tenant.
 */
export async function getNotificationPrefs(): Promise<NotificationPrefsMap> {
  const { user, tenant } = await requireTenantContext();

  const tenantUser = await publicDb.tenantUser.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.tenantId,
        userId: user.id,
      },
    },
    select: { permissionOverrides: true },
  });

  return extractPrefs(tenantUser?.permissionOverrides);
}

/**
 * Update the current user's notification preferences.
 */
export async function updateNotificationPrefs(
  prefs: NotificationPref[]
): Promise<{ error?: string }> {
  const { user, tenant } = await requireTenantContext();

  try {
    const parsed = updatePrefsSchema.parse(prefs);

    const tenantUser = await publicDb.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.tenantId,
          userId: user.id,
        },
      },
      select: { id: true, permissionOverrides: true },
    });

    if (!tenantUser) {
      return { error: "Tenant membership not found" };
    }

    // Build the new prefs map from current + updates
    const current = extractPrefs(tenantUser.permissionOverrides);
    for (const p of parsed) {
      current[p.category] = { inApp: p.inApp, email: p.email };
    }

    const merged = mergePrefsIntoOverrides(tenantUser.permissionOverrides, current);

    await publicDb.tenantUser.update({
      where: { id: tenantUser.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { permissionOverrides: merged as any },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "notification_prefs",
      entityId: user.id,
    });

    revalidatePath("/settings/notifications");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues.map((i) => i.message).join("; ") };
    }
    return {
      error: err instanceof Error ? err.message : "Failed to save preferences",
    };
  }
}

// ── Preference Checking (for use by workers/notification system) ─────────

/**
 * Map a notification job type to its notification category.
 * Used by the worker to look up user preferences before sending.
 */
const JOB_TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  shipment_arrived: "shipment_arrived",
  receiving_completed: "receiving_completed",
  order_shipped: "order_shipped",
  low_stock_alert: "low_stock_alert",
  pick_task_assigned: "pick_task_assigned",
};

export interface UserNotificationPref {
  userId: string;
  email: string;
  inApp: boolean;
  emailEnabled: boolean;
}

/**
 * Check notification preferences for a list of tenant users.
 * Returns filtered users with their preference for the given category.
 * This is intended to be called by the notification worker.
 */
export async function checkUserPrefsForCategory(
  tenantId: string,
  userIds: string[],
  jobType: string
): Promise<UserNotificationPref[]> {
  const category = JOB_TYPE_TO_CATEGORY[jobType];
  if (!category) {
    // Unknown category — default to all enabled (backward compatible)
    return [];
  }

  const tenantUsers = await publicDb.tenantUser.findMany({
    where: {
      tenantId,
      userId: { in: userIds },
    },
    select: {
      userId: true,
      permissionOverrides: true,
      user: { select: { email: true } },
    },
  });

  return tenantUsers.map((tu) => {
    const prefs = extractPrefs(tu.permissionOverrides);
    const catPref = prefs[category] ?? DEFAULT_PREFS[category];
    return {
      userId: tu.userId,
      email: tu.user.email,
      inApp: catPref.inApp,
      emailEnabled: catPref.email,
    };
  });
}
