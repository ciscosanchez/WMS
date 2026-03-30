/**
 * Inventory-matching helpers for order allocation.
 *
 * Extracted from actions.ts to keep each module file under 500 lines.
 */

type RawOperationalAttributeValue = {
  definition: { key: string };
  textValue?: string | null;
  numberValue?: number | null;
  booleanValue?: boolean | null;
  dateValue?: Date | null;
  jsonValue?: unknown;
};

export type RawOperationalAttributeValueWithEntityId = RawOperationalAttributeValue & {
  entityId: string;
  definition: { key: string; label: string };
};

export function attributeValueToDisplay(value: RawOperationalAttributeValue) {
  if (value.numberValue !== null && value.numberValue !== undefined)
    return String(value.numberValue);
  if (value.booleanValue !== null && value.booleanValue !== undefined)
    return value.booleanValue ? "Yes" : "No";
  if (value.dateValue) return value.dateValue.toISOString().slice(0, 10);
  if (value.jsonValue !== null && value.jsonValue !== undefined) {
    if (Array.isArray(value.jsonValue)) return value.jsonValue.map(String).join(", ");
    return JSON.stringify(value.jsonValue);
  }
  return value.textValue ?? "";
}

function attributeValueToComparable(value: RawOperationalAttributeValue) {
  if (value.booleanValue !== null && value.booleanValue !== undefined)
    return value.booleanValue ? "true" : "false";
  if (value.dateValue) return value.dateValue.toISOString();
  if (value.jsonValue !== null && value.jsonValue !== undefined) {
    if (Array.isArray(value.jsonValue)) {
      return JSON.stringify([...value.jsonValue].map(String).sort());
    }
    return JSON.stringify(value.jsonValue);
  }
  return attributeValueToDisplay(value);
}

/**
 * Finds the best inventory record for an order line, respecting operational
 * attribute matching (lot, serial, custom attributes). Falls back to
 * FEFO + largest-available when no attribute criteria exist on the line.
 */
export async function findInventoryForOrderLine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  line: { id: string; productId: string; quantity: number }
) {
  const criteria = ((await prisma.operationalAttributeValue.findMany({
    where: {
      entityScope: "order_line",
      entityId: line.id,
    },
    include: {
      definition: { select: { key: true } },
    },
  })) ?? []) as RawOperationalAttributeValue[];

  if (criteria.length === 0) {
    return prisma.inventory.findFirst({
      where: { productId: line.productId, available: { gte: line.quantity } },
      orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { available: "desc" }],
    });
  }

  const targetDefinitions = ((await prisma.operationalAttributeDefinition.findMany({
    where: {
      entityScope: "inventory_record",
      isActive: true,
      key: { in: criteria.map((item) => item.definition.key) },
    },
    select: { id: true, key: true },
  })) ?? []) as Array<{ id: string; key: string }>;

  if (targetDefinitions.length === 0) return null;

  const targetByKey = new Map(
    targetDefinitions.map((definition) => [definition.key, definition.id])
  );
  const candidateInventory = ((await prisma.inventory.findMany({
    where: { productId: line.productId, available: { gte: line.quantity } },
    orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { available: "desc" }],
  })) ?? []) as Array<{ id: string }>;

  for (const inventoryRecord of candidateInventory) {
    const inventoryValues = ((await prisma.operationalAttributeValue.findMany({
      where: {
        entityScope: "inventory_record",
        entityId: inventoryRecord.id,
        definitionId: { in: targetDefinitions.map((definition) => definition.id) },
      },
      include: {
        definition: { select: { key: true } },
      },
    })) ?? []) as RawOperationalAttributeValue[];

    const inventoryByKey = new Map(
      inventoryValues.map((value) => [value.definition.key, attributeValueToComparable(value)])
    );

    const matchesAllCriteria = criteria.every((criterion) => {
      const targetDefinitionId = targetByKey.get(criterion.definition.key);
      if (!targetDefinitionId) return false;
      return inventoryByKey.get(criterion.definition.key) === attributeValueToComparable(criterion);
    });

    if (matchesAllCriteria) {
      return inventoryRecord;
    }
  }

  return null;
}
