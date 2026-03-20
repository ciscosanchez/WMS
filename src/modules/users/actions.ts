"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { publicDb } from "@/lib/db/public-client";
import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/auth/session";
import { getTenantFromHeaders } from "@/lib/tenant/context";
import { sendUserInvite } from "@/lib/email/resend";
import type { TenantRole } from "../../../node_modules/.prisma/public-client";

async function getAdminContext() {
  const { user, tenant } = await requireTenantContext();
  const slug = await getTenantFromHeaders();
  await requirePermission(slug!, "settings:write");
  return { user, tenant };
}

export async function getTenantUsers(tenantId: string) {
  const { tenant } = await requireTenantContext("users:read");
  if (tenant.tenantId !== tenantId) throw new Error("Forbidden");

  return publicDb.tenantUser.findMany({
    where: { tenantId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { user: { createdAt: "asc" } },
  });
}

export async function inviteUser(opts: {
  email: string;
  name: string;
  role: TenantRole;
}): Promise<{ error: string } | { userId: string; tempPassword: string | null; emailSent: boolean; emailWarning?: string }> {
  const { tenant } = await getAdminContext();

  try {
    // Generate a readable temp password
    const tempPassword = Math.random().toString(36).slice(2, 8).toUpperCase() +
      "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

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
      const passwordHash = await hash(tempPassword, 12);
      const newUser = await publicDb.user.create({
        data: { email: opts.email, name: opts.name, passwordHash },
      });
      userId = newUser.id;
    }

    await publicDb.tenantUser.create({
      data: { tenantId: tenant.tenantId, userId, role: opts.role },
    });

    // Send invite email
    const loginUrl = `${process.env.NEXTAUTH_URL || "https://wms.ramola.app"}/login`;
    const emailResult = await sendUserInvite({
      to: opts.email,
      name: opts.name,
      tenantName: tenant.slug,
      role: opts.role,
      tempPassword: isNewUser ? tempPassword : "(use existing password)",
      loginUrl,
    });

    revalidatePath("/settings/users");
    return {
      userId,
      tempPassword: isNewUser ? tempPassword : null,
      emailSent: emailResult.sent,
      emailWarning: emailResult.warning,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to invite user" };
  }
}

export async function updateUserRole(userId: string, role: TenantRole): Promise<{ error: string } | { ok: true }> {
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
