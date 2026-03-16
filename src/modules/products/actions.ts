"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { resolveTenant } from "@/lib/tenant/context";
import { requireAuth } from "@/lib/auth/session";
import { logAudit, diffChanges } from "@/lib/audit";
import { productSchema } from "./schemas";
import { mockProducts } from "@/lib/mock-data";

async function getContext() {
  const [user, tenant] = await Promise.all([requireAuth(), resolveTenant()]);
  if (!tenant) throw new Error("Tenant not found");
  return { user, tenant };
}

export async function getProducts(clientId?: string) {
  if (config.useMockData)
    return clientId ? mockProducts.filter((p) => p.clientId === clientId) : mockProducts;

  const { tenant } = await getContext();
  return tenant.db.product.findMany({
    where: clientId ? { clientId } : undefined,
    include: { client: true },
    orderBy: { sku: "asc" },
  });
}

export async function getProduct(id: string) {
  if (config.useMockData) return mockProducts.find((p) => p.id === id) ?? null;

  const { tenant } = await getContext();
  return tenant.db.product.findUnique({
    where: { id },
    include: { client: true, uomConversions: true },
  });
}

export async function createProduct(data: unknown) {
  if (config.useMockData) return { id: "mock-new", ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = productSchema.parse(data);

  const product = await tenant.db.product.create({ data: parsed });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "product",
    entityId: product.id,
  });

  revalidatePath("/products");
  return product;
}

export async function updateProduct(id: string, data: unknown) {
  if (config.useMockData) return { id, ...(data as any) };

  const { user, tenant } = await getContext();
  const parsed = productSchema.parse(data);

  const existing = await tenant.db.product.findUniqueOrThrow({ where: { id } });
  const product = await tenant.db.product.update({
    where: { id },
    data: parsed,
  });

  const changes = diffChanges(existing as any, parsed as any);
  if (changes) {
    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "product",
      entityId: id,
      changes,
    });
  }

  revalidatePath("/products");
  return product;
}

export async function deleteProduct(id: string) {
  if (config.useMockData) return;

  const { user, tenant } = await getContext();
  await tenant.db.product.delete({ where: { id } });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "delete",
    entityType: "product",
    entityId: id,
  });

  revalidatePath("/products");
}
