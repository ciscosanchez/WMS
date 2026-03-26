"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { asTenantDb } from "@/lib/tenant/db-types";
import { logAudit } from "@/lib/audit";
import { attributeDefinitionSchema, type AttributeScope } from "./schemas";

const SETTINGS_PATH = "/settings";

export async function getOperationalAttributeDefinitions(
  scope?: AttributeScope,
  permission = "settings:read"
) {
  const { tenant } = await requireTenantContext(permission);
  const db = asTenantDb(tenant.db);

  return db.operationalAttributeDefinition.findMany({
    where: scope ? { entityScope: scope } : undefined,
    include: {
      options: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      },
      _count: { select: { values: true } },
    },
    orderBy: [{ entityScope: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function getOperationalAttributeDefinition(id: string) {
  const { tenant } = await requireTenantContext("settings:read");
  const db = asTenantDb(tenant.db);

  return db.operationalAttributeDefinition.findUnique({
    where: { id },
    include: {
      options: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] },
      _count: { select: { values: true } },
    },
  });
}

export async function createOperationalAttributeDefinition(data: unknown) {
  const { user, tenant } = await requireTenantContext("settings:write");
  const db = asTenantDb(tenant.db);
  const parsed = attributeDefinitionSchema.parse(data);

  const definition = await db.operationalAttributeDefinition.create({
    data: {
      key: parsed.key,
      label: parsed.label,
      description: parsed.description ?? null,
      entityScope: parsed.entityScope,
      dataType: parsed.dataType,
      isRequired: parsed.isRequired,
      isActive: parsed.isActive,
      allowSuggestions: parsed.allowSuggestions,
      validationRules: parsed.validationRules,
      displayRules: parsed.displayRules,
      behaviorFlags: parsed.behaviorFlags,
      sortOrder: parsed.sortOrder,
      options: {
        create: parsed.options.map((option) => ({
          value: option.value,
          label: option.label,
          sortOrder: option.sortOrder,
          isActive: option.isActive,
        })),
      },
    },
    include: { options: true },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "create",
    entityType: "operational_attribute_definition",
    entityId: definition.id,
  });

  revalidatePath(SETTINGS_PATH);
  return definition;
}

export async function updateOperationalAttributeDefinition(id: string, data: unknown) {
  const { user, tenant } = await requireTenantContext("settings:write");
  const db = asTenantDb(tenant.db);
  const parsed = attributeDefinitionSchema.parse(data);

  const existing = await db.operationalAttributeDefinition.findUnique({
    where: { id },
    include: { options: true },
  });
  if (!existing) throw new Error("Operational attribute definition not found");

  const definition = (await db.$transaction(async (tx) => {
    const transactionalDb = asTenantDb(tx);
    await transactionalDb.operationalAttributeOption.deleteMany({ where: { definitionId: id } });

    return transactionalDb.operationalAttributeDefinition.update({
      where: { id },
      data: {
        key: parsed.key,
        label: parsed.label,
        description: parsed.description ?? null,
        entityScope: parsed.entityScope,
        dataType: parsed.dataType,
        isRequired: parsed.isRequired,
        isActive: parsed.isActive,
        allowSuggestions: parsed.allowSuggestions,
        validationRules: parsed.validationRules,
        displayRules: parsed.displayRules,
        behaviorFlags: parsed.behaviorFlags,
        sortOrder: parsed.sortOrder,
        options: {
          create: parsed.options.map((option) => ({
            value: option.value,
            label: option.label,
            sortOrder: option.sortOrder,
            isActive: option.isActive,
          })),
        },
      },
      include: { options: true },
    });
  })) as Awaited<ReturnType<typeof db.operationalAttributeDefinition.update>>;

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "operational_attribute_definition",
    entityId: definition.id,
    changes: {
      key: { old: existing.key, new: parsed.key },
      label: { old: existing.label, new: parsed.label },
      entityScope: { old: existing.entityScope, new: parsed.entityScope },
      dataType: { old: existing.dataType, new: parsed.dataType },
    },
  });

  revalidatePath(SETTINGS_PATH);
  return definition;
}

export async function archiveOperationalAttributeDefinition(id: string) {
  const { user, tenant } = await requireTenantContext("settings:write");
  const db = asTenantDb(tenant.db);

  const existing = await db.operationalAttributeDefinition.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!existing) throw new Error("Operational attribute definition not found");

  const definition = await db.operationalAttributeDefinition.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit(tenant.db, {
    userId: user.id,
    action: "update",
    entityType: "operational_attribute_definition",
    entityId: definition.id,
    changes: { isActive: { old: existing.isActive, new: false } },
  });

  revalidatePath(SETTINGS_PATH);
  return definition;
}
