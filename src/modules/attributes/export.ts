import type { ExportColumn } from "@/lib/export/server-csv";

type AttributeDefinition = {
  id: string;
  key: string;
  label: string;
  sortOrder?: number | null;
};

type RawAttributeValue = {
  entityId: string;
  definitionId: string;
  textValue?: string | null;
  numberValue?: number | null;
  booleanValue?: boolean | null;
  dateValue?: Date | null;
  jsonValue?: unknown;
};

export function formatOperationalAttributeValue(value: Omit<RawAttributeValue, "entityId" | "definitionId">) {
  if (value.numberValue !== null && value.numberValue !== undefined) return String(value.numberValue);
  if (value.booleanValue !== null && value.booleanValue !== undefined)
    return value.booleanValue ? "Yes" : "No";
  if (value.dateValue) return value.dateValue.toISOString().slice(0, 10);
  if (value.jsonValue !== null && value.jsonValue !== undefined) {
    if (Array.isArray(value.jsonValue)) return value.jsonValue.map(String).join(", ");
    return JSON.stringify(value.jsonValue);
  }
  return value.textValue ?? "";
}

export function buildOperationalAttributeExportColumns(definitions: AttributeDefinition[]): ExportColumn[] {
  return definitions.map((definition) => ({
    key: `attr_${definition.key}`,
    header: definition.label,
  }));
}

export function attachOperationalAttributesToEntityRows(opts: {
  rows: Array<Record<string, unknown> & { id: string }>;
  definitions: AttributeDefinition[];
  values: RawAttributeValue[];
}) {
  const definitionById = new Map(opts.definitions.map((definition) => [definition.id, definition]));
  const valuesByEntityId = opts.values.reduce<Record<string, RawAttributeValue[]>>((acc, value) => {
    if (!acc[value.entityId]) acc[value.entityId] = [];
    acc[value.entityId].push(value);
    return acc;
  }, {});

  return opts.rows.map((row) => {
    const attributeValues = valuesByEntityId[row.id] ?? [];
    const flattened = attributeValues.reduce<Record<string, string>>((acc, value) => {
      const definition = definitionById.get(value.definitionId);
      if (!definition) return acc;
      acc[`attr_${definition.key}`] = formatOperationalAttributeValue(value);
      return acc;
    }, {});

    return {
      ...row,
      ...flattened,
    };
  });
}

export function attachAggregatedOperationalAttributesToRows(opts: {
  rows: Array<Record<string, unknown> & { id: string }>;
  definitions: AttributeDefinition[];
  values: RawAttributeValue[];
  entityToRowId: Record<string, string>;
}) {
  const definitionById = new Map(opts.definitions.map((definition) => [definition.id, definition]));
  const rowDefinitionValues = opts.values.reduce<Record<string, Record<string, Set<string>>>>((acc, value) => {
    const rowId = opts.entityToRowId[value.entityId];
    if (!rowId) return acc;

    const definition = definitionById.get(value.definitionId);
    if (!definition) return acc;

    if (!acc[rowId]) acc[rowId] = {};
    if (!acc[rowId][definition.key]) acc[rowId][definition.key] = new Set();

    const formatted = formatOperationalAttributeValue(value);
    if (formatted) acc[rowId][definition.key].add(formatted);
    return acc;
  }, {});

  return opts.rows.map((row) => {
    const rowValues = rowDefinitionValues[row.id] ?? {};
    const flattened = Object.entries(rowValues).reduce<Record<string, string>>((acc, [key, values]) => {
      acc[`attr_${key}`] = [...values].join(" | ");
      return acc;
    }, {});

    return {
      ...row,
      ...flattened,
    };
  });
}
