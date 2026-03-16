"use server";

import { revalidatePath } from "next/cache";
import { resolveTenant } from "@/lib/tenant/context";
import { requireAuth } from "@/lib/auth/session";
import { logAudit, diffChanges } from "@/lib/audit";
import { clientSchema } from "./schemas";

async function getContext() {
  const [user, tenant] = await Promise.all([requireAuth(), resolveTenant()]);
  if (!tenant) throw new Error("Tenant not found");
  return { user, tenant };
}

export async function getClients() {
  const { tenant } = await getContext();
  return tenant.db.client.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getClient(id: string) {
  const { tenant } = await getContext();
  return tenant.db.client.findUnique({ where: { id } });
}

export async function createClient(data: unknown) {
  const { user, tenant } = await getContext();
  const parsed = clientSchema.parse(data);

  const client = await tenant.db.client.create({
    data: {
      ...parsed,
      contactEmail: parsed.contactEmail || null,
    },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "client",
    entityId: client.id,
  });

  revalidatePath("/clients");
  return client;
}

export async function updateClient(id: string, data: unknown) {
  const { user, tenant } = await getContext();
  const parsed = clientSchema.parse(data);

  const existing = await tenant.db.client.findUniqueOrThrow({ where: { id } });
  const client = await tenant.db.client.update({
    where: { id },
    data: {
      ...parsed,
      contactEmail: parsed.contactEmail || null,
    },
  });

  const changes = diffChanges(existing as any, parsed as any);
  if (changes) {
    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "client",
      entityId: id,
      changes,
    });
  }

  revalidatePath("/clients");
  return client;
}

export async function deleteClient(id: string) {
  const { user, tenant } = await getContext();

  await tenant.db.client.delete({ where: { id } });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "client",
    entityId: id,
  });

  revalidatePath("/clients");
}
