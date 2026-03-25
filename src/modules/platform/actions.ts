"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { hash } from "bcryptjs";
import { requireAuth } from "@/lib/auth/session";
import { publicDb } from "@/lib/db/public-client";
import { provisionTenant } from "@/lib/db/provisioner";
import { runTenantMigrations } from "@/lib/db/tenant-migrations";
import { sendPasswordSetLink } from "@/lib/email/resend";

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

export async function createTenant(
  name: string,
  slug: string,
  plan: string,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { plan: plan as any },
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
  let isNewUser = false;

  const existingUser = await publicDb.user.findUnique({ where: { email } });

  if (existingUser) {
    userId = existingUser.id;
  } else {
    isNewUser = true;
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

  // Send invite email — raw token goes in the URL, hash is stored in DB
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://wms.ramola.app";
  const setPasswordUrl = isNewUser
    ? `${baseUrl}/set-password?token=${rawToken}`
    : `${baseUrl}/login`;

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
