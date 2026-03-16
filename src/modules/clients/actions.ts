"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { resolveTenant } from "@/lib/tenant/context";
import { requireAuth } from "@/lib/auth/session";
import { logAudit, diffChanges } from "@/lib/audit";
import { clientSchema } from "./schemas";
import { mockClients } from "@/lib/mock-data";

async function getContext() {
  const user = await requireAuth();
  const tenant = await resolveTenant();
  if (!tenant) throw new Error("Tenant not found");
  return { user, tenant };
}

export async function getClients() {
  if (config.useMockData) return mockClients;

  const { tenant } = await getContext();
  return tenant.db.client.findMany({ orderBy: { name: "asc" } });
}

export async function getClient(id: string) {
  if (config.useMockData) return mockClients.find((c) => c.id === id) ?? null;

  const { tenant } = await getContext();
  return tenant.db.client.findUnique({ where: { id } });
}

export async function createClient(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id: "mock-new", ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = clientSchema.parse(data);

  const client = await tenant.db.client.create({
    data: { ...parsed, contactEmail: parsed.contactEmail || null },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (config.useMockData) return { id, ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = clientSchema.parse(data);

  const existing = await tenant.db.client.findUniqueOrThrow({ where: { id } });
  const client = await tenant.db.client.update({
    where: { id },
    data: { ...parsed, contactEmail: parsed.contactEmail || null },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  if (config.useMockData) return;

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
