"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { publicDb } from "@/lib/db/public-client";
import { requireTenantContext } from "@/lib/tenant/context";
import { sendPasswordSetLink } from "@/lib/email/resend";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";
import { normalizePermissionOverrides, type PermissionOverrides } from "@/lib/auth/rbac";

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
        permissionOverrides: normalizePermissionOverrides(opts.permissionOverrides),
      },
    });

    // Send invite email with password-set link — raw token in URL, hash in DB
    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://wms.ramola.app";
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
  const { tenant } = await getAdminContext();
  try {
    await publicDb.tenantUser.update({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
      data: { role },
    });
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
  const { tenant } = await getAdminContext();

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

    await publicDb.tenantUser.update({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
      data: { portalClientId },
    });

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
  const { tenant } = await getAdminContext();

  try {
    await publicDb.tenantUser.update({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId } },
      data: {
        permissionOverrides: normalizePermissionOverrides(permissionOverrides),
      },
    });

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update permissions" };
  }
}

/**
 * Update the current user's locale preference.
 * Null = use tenant default.
 */
export async function updateUserLocale(locale: string | null): Promise<{ error?: string }> {
  try {

    const { user } = await requireTenantContext("reports:read");

    await publicDb.user.update({
      where: { id: user.id },
      data: { locale },
    });

    // Set a cookie so the middleware picks up the change immediately
    // (JWT won't refresh until next sign-in)
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";

    if (locale) {
      cookieStore.set("locale", locale, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 60 * 60 * 24 * 365,
        ...(isProd && { domain: ".wms.ramola.app" }),
      });
    } else {
      cookieStore.delete({
        name: "locale",
        path: "/",
        ...(isProd && { domain: ".wms.ramola.app" }),
      });
    }

    revalidatePath("/");

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update locale" };
  }
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
