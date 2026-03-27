"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { hash } from "bcryptjs";
import { requireAuth } from "@/lib/auth/session";
import { publicDb } from "@/lib/db/public-client";
import type { TenantPlan } from "../../../node_modules/.prisma/public-client";
import { provisionTenant } from "@/lib/db/provisioner";
import { runTenantMigrations } from "@/lib/db/tenant-migrations";
import { sendPasswordSetLink } from "@/lib/email/resend";
import { getAppBaseUrl } from "@/lib/app-runtime";

const VALID_TENANT_PLANS = new Set(["starter", "professional", "enterprise"]);

async function requireSuperadmin() {
  const user = await requireAuth();
  if (!user.isSuperadmin) throw new Error("Forbidden: superadmin required");
  return user;
}

export async function getTenants() {
  await requireSuperadmin();
  const tenants = await publicDb.tenant.findMany({
    include: { _count: { select: { tenantUsers: true } } },
    orderBy: { createdAt: "desc" },
  });
  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    dbSchema: t.dbSchema,
    status: t.status,
    plan: t.plan,
    userCount: t._count.tenantUsers,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function getPlatformStats() {
  await requireSuperadmin();
  const [tenantCount, userCount] = await Promise.all([
    publicDb.tenant.count({ where: { status: "active" } }),
    publicDb.user.count(),
  ]);
  return { tenantCount, userCount };
}

export async function getPlatformUsers(tenantSlug?: string) {
  await requireSuperadmin();

  const users = await publicDb.user.findMany({
    where: tenantSlug
      ? {
          tenantUsers: {
            some: {
              tenant: {
                slug: tenantSlug,
              },
            },
          },
        }
      : undefined,
    include: {
      tenantUsers: {
        include: {
          tenant: true,
        },
        orderBy: {
          tenant: {
            name: "asc",
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isSuperadmin: user.isSuperadmin,
    createdAt: user.createdAt.toISOString(),
    tenants: user.tenantUsers.map((membership) => ({
      tenantId: membership.tenantId,
      tenantName: membership.tenant.name,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
    })),
  }));
}

export async function createTenant(
  name: string,
  slug: string,
  plan: TenantPlan,
  adminEmail?: string,
  adminName?: string
): Promise<{ error: string } | { id: string; adminInvited?: boolean }> {
  await requireSuperadmin();
  try {
    // Check slug uniqueness before provisioning
    const existing = await publicDb.tenant.findUnique({ where: { slug } });
    if (existing) return { error: `Slug "${slug}" is already taken` };

    const id = await provisionTenant(name, slug);

    // Store the plan
    await publicDb.tenant.update({
      where: { id },
      data: { plan },
    });

    // Create and link admin user if email provided
    let adminInvited = false;
    if (adminEmail) {
      const result = await createTenantAdmin(id, adminEmail, adminName || adminEmail, name);
      adminInvited = !("error" in result);
    }

    revalidatePath("/platform/tenants");
    return { id, adminInvited };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Provisioning failed" };
  }
}

/** Create or find a user and link them as admin to a tenant, sending invite email. */
async function createTenantAdmin(
  tenantId: string,
  email: string,
  displayName: string,
  tenantName: string
): Promise<{ error: string } | { userId: string }> {
  const rawToken = randomBytes(32).toString("hex");
  const passwordSetToken = createHash("sha256").update(rawToken).digest("hex");
  const passwordSetExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

  let userId: string;

  const existingUser = await publicDb.user.findUnique({ where: { email } });

  if (existingUser) {
    await publicDb.user.update({
      where: { id: existingUser.id },
      data: {
        name: existingUser.name || displayName,
        passwordSetToken,
        passwordSetExpires,
      },
    });
    userId = existingUser.id;
  } else {
    const placeholderHash = await hash(randomBytes(32).toString("hex"), 12);
    const newUser = await publicDb.user.create({
      data: {
        email,
        name: displayName,
        passwordHash: placeholderHash,
        passwordSetToken,
        passwordSetExpires,
      },
    });
    userId = newUser.id;
  }

  // Link as admin (upsert in case they're already linked)
  await publicDb.tenantUser.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    update: { role: "admin" },
    create: { tenantId, userId, role: "admin" },
  });

  // Always send a fresh setup link so tenant onboarding works for existing
  // users that were partially created earlier or do not know their password.
  const baseUrl = getAppBaseUrl();
  const setPasswordUrl = `${baseUrl}/set-password?token=${rawToken}`;

  await sendPasswordSetLink({
    to: email,
    name: displayName,
    tenantName,
    role: "admin",
    setPasswordUrl,
  });

  return { userId };
}

const PLAN_FEES: Record<string, number> = {
  starter: 99,
  professional: 299,
  enterprise: 999,
};

export async function getBillingData() {
  await requireSuperadmin();

  const tenants = await publicDb.tenant.findMany({
    include: { _count: { select: { tenantUsers: true } } },
    orderBy: { name: "asc" },
  });

  const billingTenants = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    plan: t.plan,
    status: t.status,
    monthlyFee: PLAN_FEES[t.plan] ?? 0,
    createdAt: t.createdAt.toISOString(),
  }));

  const activeTenants = billingTenants.filter((t) => t.status === "active");
  const mrr = activeTenants.reduce((sum, t) => sum + t.monthlyFee, 0);

  return {
    tenants: billingTenants,
    mrr,
    arr: mrr * 12,
    activeCount: activeTenants.length,
    avgRevenue: activeTenants.length > 0 ? Math.round(mrr / activeTenants.length) : 0,
  };
}

export async function updateTenantPlan(
  id: string,
  plan: TenantPlan
): Promise<{ error: string } | { ok: true }> {
  await requireSuperadmin();

  if (!VALID_TENANT_PLANS.has(plan)) {
    return { error: "Invalid tenant plan" };
  }

  try {
    await publicDb.tenant.update({
      where: { id },
      data: { plan },
    });

    revalidatePath("/platform/tenants");
    revalidatePath("/platform/billing");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update tenant plan" };
  }
}

export async function suspendTenant(id: string): Promise<{ error: string } | { ok: true }> {
  await requireSuperadmin();
  try {
    await publicDb.tenant.update({ where: { id }, data: { status: "suspended" } });
    revalidatePath("/platform/tenants");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to suspend tenant" };
  }
}

export async function reactivateTenant(id: string): Promise<{ error: string } | { ok: true }> {
  await requireSuperadmin();
  try {
    const tenant = await publicDb.tenant.findUnique({
      where: { id },
      select: { id: true, dbSchema: true },
    });
    if (!tenant) {
      return { error: "Tenant not found" };
    }

    await publicDb.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${tenant.dbSchema}"`);
    await runTenantMigrations(tenant.dbSchema);
    await publicDb.tenant.update({ where: { id }, data: { status: "active" } });

    revalidatePath("/platform/tenants");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reactivate tenant" };
  }
}

export async function deleteTenant(id: string): Promise<{ error: string } | { ok: true }> {
  await requireSuperadmin();
  try {
    const tenant = await publicDb.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        dbSchema: true,
      },
    });

    if (!tenant) {
      return { error: "Tenant not found" };
    }

    if (tenant.status === "active") {
      return { error: "Suspend the tenant before deleting it" };
    }

    await publicDb.$transaction(async (tx) => {
      await tx.tenant.delete({ where: { id } });
      await tx.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.dbSchema}" CASCADE`);
    });

    revalidatePath("/platform/tenants");
    revalidatePath("/platform/billing");
    revalidatePath("/platform/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete tenant" };
  }
}
