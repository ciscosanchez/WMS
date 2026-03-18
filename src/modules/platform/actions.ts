"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { publicDb } from "@/lib/db/public-client";
import { provisionTenant } from "@/lib/db/provisioner";

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
  plan: string
): Promise<{ error: string } | { id: string }> {
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

    revalidatePath("/platform/tenants");
    return { id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Provisioning failed" };
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
    await publicDb.tenant.update({ where: { id }, data: { status: "active" } });
    revalidatePath("/platform/tenants");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reactivate tenant" };
  }
}
