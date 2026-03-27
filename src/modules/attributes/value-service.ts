import { asTenantDb } from "@/lib/tenant/db-types";
import { logAudit } from "@/lib/audit";
import type { PrismaClient as TenantClient } from "../../../node_modules/.prisma/tenant-client";
import type { AttributeValueInput } from "./schemas";

function isBlankValue(value: AttributeValueInput["value"]) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.filter(Boolean).length === 0)
  );
}

function normalizeValue(dataType: string, value: AttributeValueInput["value"]) {
  if (isBlankValue(value)) {
    return {
      textValue: null,
      numberValue: null,
      booleanValue: null,
      dateValue: null,
      jsonValue: null,
    };
  }

  switch (dataType) {
    case "number":
    case "currency":
      return {
        textValue: null,
        numberValue: typeof value === "number" ? value : Number(value),
        booleanValue: null,
        dateValue: null,
        jsonValue: null,
      };
    case "boolean":
      return {
        textValue: null,
        numberValue: null,
        booleanValue: typeof value === "boolean" ? value : value === "true",
        dateValue: null,
        jsonValue: null,
      };
    case "date":
      return {
        textValue: null,
        numberValue: null,
        booleanValue: null,
        dateValue: new Date(String(value)),
        jsonValue: null,
      };
    case "multi_select":
    case "json":
      return {
        textValue: null,
        numberValue: null,
        booleanValue: null,
        dateValue: null,
        jsonValue: value,
      };
    case "single_select":
    case "text":
    default:
      return {
        textValue: String(value),
        numberValue: null,
        booleanValue: null,
        dateValue: null,
        jsonValue: null,
      };
  }
}

export async function saveOperationalAttributeValuesForEntity(opts: {
  db: unknown;
  userId: string;
  entityScope: string;
  entityId: string;
  values: AttributeValueInput[];
}) {
  const db = asTenantDb(opts.db);
  if (opts.values.length === 0) return;

  const definitionIds = [...new Set(opts.values.map((item) => item.definitionId))];
  const definitions = await db.operationalAttributeDefinition.findMany({
    where: {
      id: { in: definitionIds },
      entityScope: opts.entityScope,
      isActive: true,
    },
  });

  const definitionsById = new Map(
    (definitions as Array<{ id: string; dataType: string }>).map((definition) => [
      definition.id,
      definition,
    ])
  );

  for (const item of opts.values) {
    const definition = definitionsById.get(item.definitionId);
    if (!definition) {
      throw new Error(`Operational attribute definition not found for scope ${opts.entityScope}`);
    }

    if (isBlankValue(item.value)) continue;

    const normalized = normalizeValue(definition.dataType, item.value);
    const saved = await db.operationalAttributeValue.upsert({
      where: {
        definitionId_entityScope_entityId: {
          definitionId: definition.id,
          entityScope: opts.entityScope,
          entityId: opts.entityId,
        },
      },
      update: {
        ...normalized,
        updatedBy: opts.userId,
      },
      create: {
        definitionId: definition.id,
        entityScope: opts.entityScope,
        entityId: opts.entityId,
        ...normalized,
        createdBy: opts.userId,
        updatedBy: opts.userId,
      },
    });

    await logAudit(opts.db as TenantClient, {
      userId: opts.userId,
      action: "create",
      entityType: "operational_attribute_value",
      entityId: saved.id,
    });
  }
}

export async function copyOperationalAttributeValuesBetweenScopes(opts: {
  db: unknown;
  userId: string;
  sourceScope: string;
  sourceEntityId: string;
  targetScope: string;
  targetEntityId: string;
}) {
  const db = asTenantDb(opts.db);

  const sourceValues = (await db.operationalAttributeValue.findMany({
    where: {
      entityScope: opts.sourceScope,
      entityId: opts.sourceEntityId,
    },
    include: { definition: true },
  })) as Array<{
    definition: { key: string };
    textValue?: string | null;
    numberValue?: number | null;
    booleanValue?: boolean | null;
    dateValue?: Date | null;
    jsonValue?: unknown;
  }>;

  if (sourceValues.length === 0) return;

  const targetDefinitions = (await db.operationalAttributeDefinition.findMany({
    where: {
      entityScope: opts.targetScope,
      isActive: true,
      key: { in: sourceValues.map((value) => value.definition.key) },
    },
  })) as Array<{ id: string; key: string; dataType: string }>;

  const targetByKey = new Map(targetDefinitions.map((definition) => [definition.key, definition]));

  const mappedValues = sourceValues
    .map((value) => {
      const targetDefinition = targetByKey.get(value.definition.key);
      if (!targetDefinition) return null;

      let normalizedValue: string | number | boolean | string[] | null = value.textValue ?? null;
      if (value.numberValue !== null && value.numberValue !== undefined) normalizedValue = value.numberValue;
      if (value.booleanValue !== null && value.booleanValue !== undefined) normalizedValue = value.booleanValue;
      if (value.dateValue) normalizedValue = value.dateValue.toISOString();
      if (value.jsonValue !== null && value.jsonValue !== undefined) {
        normalizedValue = Array.isArray(value.jsonValue)
          ? (value.jsonValue as string[])
          : JSON.stringify(value.jsonValue);
      }

      return {
        definitionId: targetDefinition.id,
        value: normalizedValue,
      };
    })
    .filter(Boolean) as AttributeValueInput[];

  await saveOperationalAttributeValuesForEntity({
    db,
    userId: opts.userId,
    entityScope: opts.targetScope,
    entityId: opts.targetEntityId,
    values: mappedValues,
  });
}
