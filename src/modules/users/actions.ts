"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { publicDb } from "@/lib/db/public-client";
import { requireTenantContext } from "@/lib/tenant/context";
import { sendPasswordSetLink } from "@/lib/email/resend";
import { getAppBaseUrl, getCookieDomain, isSupportedLocale } from "@/lib/app-runtime";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import {
  getAccessRisks,
  getPermissionDiffSummary,
  normalizePermissionOverrides,
  validatePermissionPolicy,
  type PermissionOverrides,
} from "@/lib/auth/rbac";
import { getUserPersonas } from "@/lib/auth/personas";
import { logAudit } from "@/lib/audit";
import { generateCsv, csvResponse, type ExportColumn } from "@/lib/export/server-csv";
import type { PermissionPreset, Permission } from "@/lib/auth/rbac";

type TenantRbacSettings = {
  savedPresets?: PermissionPreset[];
  reviewCadenceDays?: number;
  lastReviewCompletedAt?: string | null;
  nextReviewDueAt?: string | null;
};

function normalizeTenantRbacSettings(raw: unknown): TenantRbacSettings {
  if (!raw || typeof raw !== "object") return {};
  const candidate = raw as TenantRbacSettings;
  return {
    savedPresets: Array.isArray(candidate.savedPresets)
      ? candidate.savedPresets.filter(
          (preset): preset is PermissionPreset =>
            typeof preset?.key === "string" &&
            typeof preset?.label === "string" &&
            typeof preset?.description === "string" &&
            Array.isArray(preset?.grants) &&
            Array.isArray(preset?.denies)
        )
      : [],
    reviewCadenceDays:
      typeof candidate.reviewCadenceDays === "number" ? candidate.reviewCadenceDays : 90,
    lastReviewCompletedAt:
      typeof candidate.lastReviewCompletedAt === "string" ? candidate.lastReviewCompletedAt : null,
    nextReviewDueAt:
      typeof candidate.nextReviewDueAt === "string" ? candidate.nextReviewDueAt : null,
  };
}

async function getTenantSettingsRecord(tenantId: string) {
  return publicDb.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
}

function buildTenantSettingsUpdate(
  existingSettings: unknown,
  nextRbac: TenantRbacSettings
): Record<string, unknown> {
  const settings = { ...((existingSettings ?? {}) as Record<string, unknown>) };
  settings.rbac = nextRbac;
  return settings;
}

async function getAdminContext() {
  return requireTenantContext("users:write");
}

export async function getTenantUsers(tenantId: string) {
  const { tenant } = await requireTenantContext("users:read");
  if (tenant.tenantId !== tenantId) throw new Error("Forbidden");

  return publicDb.tenantUser.findMany({
    where: { tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true, isSuperadmin: true } },
    },
    orderBy: { user: { createdAt: "asc" } },
  });
}

export async function inviteUser(opts: {
  email: string;
  name: string;
  role: TenantRole;
  portalClientId?: string | null;
  permissionOverrides?: PermissionOverrides | null;
}): Promise<{ error: string } | { userId: string; emailSent: boolean; emailWarning?: string }> {
  const { tenant } = await getAdminContext();

  try {
    if (opts.portalClientId) {
      const client = await tenant.db.client.findUnique({
        where: { id: opts.portalClientId },
        select: { id: true, isActive: true },
      });
      if (!client?.isActive) {
        return { error: "Selected portal client is invalid or inactive" };
      }
    }

    const normalizedOverrides = normalizePermissionOverrides(opts.permissionOverrides);
    const violations = validatePermissionPolicy({
      role: opts.role,
      portalClientId: opts.portalClientId ?? null,
      overrides: normalizedOverrides,
    });
    if (violations.length > 0) {
      return { error: violations[0].message };
    }

    // Generate a secure one-time token for password setup
    // Store a SHA-256 hash in the DB; raw token goes in the invite URL
    const rawToken = randomBytes(32).toString("hex");
    const passwordSetToken = createHash("sha256").update(rawToken).digest("hex");
    const passwordSetExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    let userId: string;
    let isNewUser = false;

    const existing = await publicDb.user.findUnique({ where: { email: opts.email } });

    if (existing) {
      userId = existing.id;
      // Check if already a member
      const membership = await publicDb.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: tenant.tenantId, userId: existing.id } },
      });
      if (membership) return { error: `${opts.email} is already a member of this tenant` };
    } else {
      isNewUser = true;
      // Create user with a placeholder password hash (will be set via token)
      const placeholderHash = await hash(randomBytes(32).toString("hex"), 12);
      const newUser = await publicDb.user.create({
        data: {
          email: opts.email,
          name: opts.name,
          passwordHash: placeholderHash,
          passwordSetToken,
          passwordSetExpires,
        },
      });
      userId = newUser.id;
    }

    await publicDb.tenantUser.create({
      data: {
        tenantId: tenant.tenantId,
        userId,
        role: opts.role,
        portalClientId: opts.portalClientId ?? null,
        permissionOverrides: normalizedOverrides,
      },
    });

    // Send invite email with password-set link — raw token in URL, hash in DB
    const baseUrl = getAppBaseUrl();
    const setPasswordUrl = isNewUser
      ? `${baseUrl}/set-password?token=${rawToken}`
      : `${baseUrl}/login`;

    const emailResult = await sendPasswordSetLink({
      to: opts.email,
      name: opts.name,
      tenantName: tenant.slug,
      role: opts.role,
      setPasswordUrl,
    });

    revalidatePath("/settings/users");
    return {
      userId,
      emailSent: emailResult.sent,
      emailWarning: emailResult.warning,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to invite user" };
  }
}

/**
 * Set password using a one-time token (from invite email).
 * Validates token, checks expiry, hashes password, clears token.
 */
export async function setPasswordWithToken(
  token: string,
  password: string
): Promise<{ error?: string }> {
  if (!token || token.length < 32) return { error: "Invalid token" };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };

  // Hash the incoming token to match the stored SHA-256 hash
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const user = await publicDb.user.findUnique({
    where: { passwordSetToken: tokenHash },
  });

  if (!user) return { error: "Invalid or expired token" };
  if (user.passwordSetExpires && user.passwordSetExpires < new Date()) {
    return { error: "Token has expired. Please ask your admin for a new invite." };
  }

  const passwordHash = await hash(password, 12);

  await publicDb.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordSetToken: null,
      passwordSetExpires: null,
      authVersion: { increment: 1 },
    },
  });

  await publicDb.session.deleteMany({
    where: { userId: user.id },
  });

  return {};
}

export async function updateUserRole(
  userId: string,
  role: TenantRole
): Promise<{ error: string } | { ok: true }> {
  const { user, tenant } = await getAdminContext();
  try {
    const existing = await publicDb.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
    });

    await publicDb.tenantUser.update({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
      data: { role },
    });

    if (existing) {
      await logAudit(tenant.db, {
        userId: user.id,
        action: "update",
        entityType: "tenant_user_access",
        entityId: existing.id,
        changes: {
          role: { old: existing.role, new: role },
        },
      });
    }

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update role" };
  }
}

export async function updateUserPortalBinding(
  userId: string,
  portalClientId: string | null
): Promise<{ error: string } | { ok: true }> {
  const { user, tenant } = await getAdminContext();

  try {
    if (portalClientId) {
      const client = await tenant.db.client.findUnique({
        where: { id: portalClientId },
        select: { id: true, isActive: true },
      });
      if (!client?.isActive) {
        return { error: "Selected portal client is invalid or inactive" };
      }
    }

    const existing = await publicDb.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
    });
    if (!existing) {
      return { error: "User not found in this tenant" };
    }

    const violations = validatePermissionPolicy({
      role: existing.role,
      portalClientId,
      overrides: existing.permissionOverrides,
    });
    if (violations.length > 0) {
      return { error: violations[0].message };
    }

    await publicDb.tenantUser.update({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
      data: { portalClientId },
    });

    if (existing) {
      await logAudit(tenant.db, {
        userId: user.id,
        action: "update",
        entityType: "tenant_user_access",
        entityId: existing.id,
        changes: {
          portalClientId: { old: existing.portalClientId, new: portalClientId },
        },
      });
    }

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update portal access" };
  }
}

export async function updateUserPermissionOverrides(
  userId: string,
  permissionOverrides: PermissionOverrides
): Promise<{ error: string } | { ok: true }> {
  const { user, tenant } = await getAdminContext();

  try {
    const normalized = normalizePermissionOverrides(permissionOverrides);
    const existing = await publicDb.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
    });
    if (!existing) {
      return { error: "User not found in this tenant" };
    }

    const violations = validatePermissionPolicy({
      role: existing.role,
      portalClientId: existing.portalClientId,
      overrides: normalized,
    });
    if (violations.length > 0) {
      return { error: violations[0].message };
    }

    await publicDb.tenantUser.update({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
      data: {
        permissionOverrides: normalized,
      },
    });

    if (existing) {
      const previous = normalizePermissionOverrides(existing.permissionOverrides);
      await logAudit(tenant.db, {
        userId: user.id,
        action: "update",
        entityType: "tenant_user_access",
        entityId: existing.id,
        changes: {
          permissionOverrides: { old: previous, new: normalized },
        },
      });
    }

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update permissions" };
  }
}

export async function exportTenantAccessReview() {
  const { tenant } = await requireTenantContext("users:read");

  const members = await publicDb.tenantUser.findMany({
    where: { tenantId: tenant.tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, isSuperadmin: true } },
    },
    orderBy: { user: { createdAt: "asc" } },
  });

  const clients = await tenant.db.client.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });
  const clientMap = new Map(
    clients.map((client: { id: string; name: string; code: string }) => [client.id, client])
  );

  return members.map((member) => {
    const permissionOverrides = normalizePermissionOverrides(member.permissionOverrides);
    const personas = getUserPersonas(
      {
        isSuperadmin: member.user.isSuperadmin,
        tenants: [{ slug: tenant.slug, role: member.role, portalClientId: member.portalClientId }],
      },
      tenant.slug
    );
    const diff = getPermissionDiffSummary(member.role, permissionOverrides);
    const risks = getAccessRisks({
      role: member.role,
      portalClientId: member.portalClientId,
      overrides: permissionOverrides,
    });
    const portalClient = member.portalClientId
      ? (clientMap.get(member.portalClientId) ?? null)
      : null;

    return {
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      personas,
      portalClientId: member.portalClientId,
      portalClientName: portalClient?.name ?? "",
      portalClientCode: portalClient?.code ?? "",
      grants: permissionOverrides.grants,
      denies: permissionOverrides.denies,
      effectivePermissionCount: diff.effectiveCount,
      inheritedPermissionCount: diff.inheritedCount,
      addedPermissions: diff.added,
      removedPermissions: diff.removed,
      riskFlags: risks.map((risk) => risk.message),
    };
  });
}

const ACCESS_REVIEW_COLUMNS: ExportColumn[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "role", header: "Role" },
  { key: "personas", header: "Personas" },
  { key: "portalClient", header: "Portal Client" },
  { key: "grants", header: "Grants" },
  { key: "denies", header: "Denies" },
  { key: "effectivePermissionCount", header: "Effective Permissions" },
  { key: "addedPermissions", header: "Added Permissions" },
  { key: "removedPermissions", header: "Removed Permissions" },
  { key: "riskFlags", header: "Risk Flags" },
];

export async function exportTenantAccessReviewCsv(): Promise<Response> {
  const rows = await exportTenantAccessReview();
  const csv = generateCsv(
    rows.map((row) => ({
      name: row.name,
      email: row.email,
      role: row.role,
      personas: row.personas.join("; "),
      portalClient: row.portalClientName
        ? `${row.portalClientName}${row.portalClientCode ? ` (${row.portalClientCode})` : ""}`
        : "",
      grants: row.grants.join("; "),
      denies: row.denies.join("; "),
      effectivePermissionCount: row.effectivePermissionCount,
      addedPermissions: row.addedPermissions.join("; "),
      removedPermissions: row.removedPermissions.join("; "),
      riskFlags: row.riskFlags.join("; "),
    })),
    ACCESS_REVIEW_COLUMNS
  );

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `tenant-access-review-${date}.csv`);
}

export async function getTenantRbacGovernance() {
  const { tenant } = await requireTenantContext("users:read");
  const row = await getTenantSettingsRecord(tenant.tenantId);
  const settings = normalizeTenantRbacSettings(
    ((row?.settings ?? {}) as Record<string, unknown>).rbac
  );

  return {
    savedPresets: settings.savedPresets ?? [],
    reviewCadenceDays: settings.reviewCadenceDays ?? 90,
    lastReviewCompletedAt: settings.lastReviewCompletedAt,
    nextReviewDueAt: settings.nextReviewDueAt,
  };
}

export async function saveTenantPermissionPreset(input: {
  key?: string;
  label: string;
  description: string;
  grants: Permission[];
  denies: Permission[];
}): Promise<{ error: string } | { ok: true }> {
  const { user, tenant } = await getAdminContext();

  try {
    const row = await getTenantSettingsRecord(tenant.tenantId);
    const settings = normalizeTenantRbacSettings(
      ((row?.settings ?? {}) as Record<string, unknown>).rbac
    );
    const presetKey =
      input.key && input.key.trim().length > 0
        ? input.key
        : `tenant-${input.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const preset: PermissionPreset = {
      key: presetKey,
      label: input.label,
      description: input.description,
      grants: normalizePermissionOverrides({ grants: input.grants, denies: [] }).grants,
      denies: normalizePermissionOverrides({ grants: [], denies: input.denies }).denies,
    };
    const nextPresets = (settings.savedPresets ?? []).filter((item) => item.key !== preset.key);
    nextPresets.push(preset);

    const merged = buildTenantSettingsUpdate(row?.settings, {
      ...settings,
      savedPresets: nextPresets,
    });

    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      data: { settings: merged as never },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "tenant_rbac_preset",
      entityId: preset.key,
    });

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save RBAC preset" };
  }
}

export async function deleteTenantPermissionPreset(
  presetKey: string
): Promise<{ error: string } | { ok: true }> {
  const { user, tenant } = await getAdminContext();

  try {
    const row = await getTenantSettingsRecord(tenant.tenantId);
    const settings = normalizeTenantRbacSettings(
      ((row?.settings ?? {}) as Record<string, unknown>).rbac
    );
    const nextPresets = (settings.savedPresets ?? []).filter((item) => item.key !== presetKey);

    const merged = buildTenantSettingsUpdate(row?.settings, {
      ...settings,
      savedPresets: nextPresets,
    });

    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      data: { settings: merged as never },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "tenant_rbac_preset",
      entityId: presetKey,
    });

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete RBAC preset" };
  }
}

export async function saveTenantAccessReviewCadence(
  reviewCadenceDays: number
): Promise<{ error: string } | { ok: true }> {
  const { user, tenant } = await getAdminContext();

  try {
    const row = await getTenantSettingsRecord(tenant.tenantId);
    const settings = normalizeTenantRbacSettings(
      ((row?.settings ?? {}) as Record<string, unknown>).rbac
    );
    const cadence = Math.max(30, reviewCadenceDays);
    const baseDate = settings.lastReviewCompletedAt
      ? new Date(settings.lastReviewCompletedAt)
      : new Date();
    const nextReviewDueAt = new Date(baseDate);
    nextReviewDueAt.setDate(nextReviewDueAt.getDate() + cadence);

    const merged = buildTenantSettingsUpdate(row?.settings, {
      ...settings,
      reviewCadenceDays: cadence,
      nextReviewDueAt: nextReviewDueAt.toISOString(),
    });

    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      data: { settings: merged as never },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "tenant_rbac_review_cadence",
      entityId: tenant.tenantId,
    });

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save review cadence" };
  }
}

export async function markTenantAccessReviewComplete(): Promise<{ error: string } | { ok: true }> {
  const { user, tenant } = await getAdminContext();

  try {
    const row = await getTenantSettingsRecord(tenant.tenantId);
    const settings = normalizeTenantRbacSettings(
      ((row?.settings ?? {}) as Record<string, unknown>).rbac
    );
    const cadence = settings.reviewCadenceDays ?? 90;
    const completedAt = new Date();
    const nextReviewDueAt = new Date(completedAt);
    nextReviewDueAt.setDate(nextReviewDueAt.getDate() + cadence);

    const merged = buildTenantSettingsUpdate(row?.settings, {
      ...settings,
      lastReviewCompletedAt: completedAt.toISOString(),
      nextReviewDueAt: nextReviewDueAt.toISOString(),
    });

    await publicDb.tenant.update({
      where: { id: tenant.tenantId },
      data: { settings: merged as never },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "tenant_rbac_review",
      entityId: tenant.tenantId,
    });

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark review complete" };
  }
}

export async function bulkApplyPermissionPreset(input: {
  userIds: string[];
  grants: Permission[];
  denies: Permission[];
}): Promise<{ error: string } | { ok: true; updated: number }> {
  const { user, tenant } = await getAdminContext();

  try {
    if (input.userIds.length === 0) return { error: "Select at least one user" };

    const memberships = await publicDb.tenantUser.findMany({
      where: {
        tenantId: tenant.tenantId,
        userId: { in: input.userIds },
      },
      select: {
        id: true,
        userId: true,
        role: true,
        portalClientId: true,
      },
    });

    const normalized = normalizePermissionOverrides({
      grants: input.grants,
      denies: input.denies,
    });

    for (const membership of memberships) {
      const violations = validatePermissionPolicy({
        role: membership.role,
        portalClientId: membership.portalClientId,
        overrides: normalized,
      });
      if (violations.length > 0) {
        return { error: `${membership.userId}: ${violations[0].message}` };
      }
    }

    await Promise.all(
      memberships.map((membership) =>
        publicDb.tenantUser.update({
          where: {
            tenantId_userId: {
              tenantId: tenant.tenantId,
              userId: membership.userId,
            },
          },
          data: { permissionOverrides: normalized },
        })
      )
    );

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "tenant_user_access_bulk",
      entityId: tenant.tenantId,
      changes: {
        targetUsers: { old: null, new: input.userIds },
        permissionOverrides: { old: null, new: normalized },
      },
    });

    revalidatePath("/settings/users");
    return { ok: true, updated: memberships.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to bulk apply preset" };
  }
}

/**
 * Update the current user's locale preference.
 * Null = use tenant default.
 */
export async function updateUserLocale(locale: string | null): Promise<{ error?: string }> {
  try {
    const { user } = await requireTenantContext();

    if (locale !== null && !isSupportedLocale(locale)) {
      return { error: "Unsupported locale" };
    }

    await publicDb.user.update({
      where: { id: user.id },
      data: { locale },
    });

    // Set a cookie so the middleware picks up the change immediately
    // (JWT won't refresh until next sign-in)
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";
    const cookieDomain = getCookieDomain();

    if (locale) {
      cookieStore.set("locale", locale, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 60 * 60 * 24 * 365,
        ...(cookieDomain && { domain: cookieDomain }),
      });
    } else {
      cookieStore.delete({
        name: "locale",
        path: "/",
        ...(cookieDomain && { domain: cookieDomain }),
      });
    }

    revalidatePath("/");

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update locale" };
  }
}

export async function clearLocaleCookie(): Promise<void> {
  const cookieStore = await cookies();
  const cookieDomain = getCookieDomain();
  cookieStore.delete({
    name: "locale",
    path: "/",
    ...(cookieDomain && { domain: cookieDomain }),
  });
}

export async function removeUser(userId: string): Promise<{ error: string } | { ok: true }> {
  const { user, tenant } = await getAdminContext();
  if (userId === user.id) return { error: "Cannot remove yourself" };
  try {
    await publicDb.tenantUser.delete({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
    });
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to remove user" };
  }
}
