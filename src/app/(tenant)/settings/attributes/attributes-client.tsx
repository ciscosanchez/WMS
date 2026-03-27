"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  archiveOperationalAttributeDefinition,
  createOperationalAttributeDefinition,
  updateOperationalAttributeDefinition,
} from "@/modules/attributes/actions";
import type { AttributeDataType, AttributeScope } from "@/modules/attributes/schemas";
import {
  DEFAULT_COMMON_ATTRIBUTE_FLAGS,
  extractCommonAttributeFlags,
  mergeCommonAttributeFlags,
  type CommonAttributeFlagState,
} from "@/modules/attributes/form-metadata";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type AttributeDefinitionRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  entityScope: AttributeScope;
  dataType: AttributeDataType;
  isRequired: boolean;
  isActive: boolean;
  allowSuggestions: boolean;
  validationRules: Record<string, unknown>;
  displayRules: Record<string, unknown>;
  behaviorFlags: Record<string, unknown>;
  sortOrder: number;
  options: Array<{ value: string; label: string; sortOrder: number; isActive: boolean }>;
  _count?: { values: number };
};

const SCOPE_OPTIONS: Array<{ value: AttributeScope; label: string }> = [
  { value: "inbound_shipment", label: "Inbound Shipment" },
  { value: "inbound_shipment_line", label: "Inbound Shipment Line" },
  { value: "order_line", label: "Order Line" },
  { value: "lpn", label: "LPN" },
  { value: "inventory_unit", label: "Inventory Unit" },
  { value: "inventory_record", label: "Inventory Record" },
];

const TYPE_OPTIONS: Array<{ value: AttributeDataType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "json", label: "JSON" },
];

function parseJsonObject(input: string, fieldLabel: string) {
  const trimmed = input.trim();
  if (!trimmed) return {};

  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function serializeJson(value: Record<string, unknown>) {
  return Object.keys(value).length === 0 ? "" : JSON.stringify(value, null, 2);
}

function serializeOptions(
  options: Array<{ value: string; label: string; sortOrder: number; isActive: boolean }>
) {
  return options
    .map((option) => `${option.value}|${option.label}|${option.sortOrder}|${option.isActive ? "true" : "false"}`)
    .join("\n");
}

function parseOptions(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [value, label, sortOrder, isActive] = line.split("|");
      if (!value || !label) {
        throw new Error("Each option row must be value|label or value|label|sortOrder|isActive");
      }
      return {
        value: value.trim(),
        label: label.trim(),
        sortOrder: sortOrder ? Number(sortOrder) : index,
        isActive: isActive ? isActive.trim() !== "false" : true,
      };
    });
}

function buildInitialFormState(definition?: AttributeDefinitionRow | null) {
  return {
    id: definition?.id ?? null,
    key: definition?.key ?? "",
    label: definition?.label ?? "",
    description: definition?.description ?? "",
    entityScope: definition?.entityScope ?? ("inbound_shipment_line" as AttributeScope),
    dataType: definition?.dataType ?? ("text" as AttributeDataType),
    isRequired: definition?.isRequired ?? false,
    isActive: definition?.isActive ?? true,
    allowSuggestions: definition?.allowSuggestions ?? false,
    sortOrder: String(definition?.sortOrder ?? 0),
    validationRules: serializeJson(definition?.validationRules ?? {}),
    displayRules: serializeJson(definition?.displayRules ?? {}),
    behaviorFlags: serializeJson(definition?.behaviorFlags ?? {}),
    options: serializeOptions(definition?.options ?? []),
  };
}

export function AttributesClient({ initialDefinitions }: { initialDefinitions: AttributeDefinitionRow[] }) {
  const [definitions, setDefinitions] = useState(initialDefinitions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(buildInitialFormState());
  const [commonFlags, setCommonFlags] = useState<CommonAttributeFlagState>(
    DEFAULT_COMMON_ATTRIBUTE_FLAGS
  );

  const sortedDefinitions = useMemo(
    () => [...definitions].sort((a, b) => a.entityScope.localeCompare(b.entityScope) || a.sortOrder - b.sortOrder),
    [definitions]
  );

  function updateField(name: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(definition: AttributeDefinitionRow) {
    setEditingId(definition.id);
    setForm(buildInitialFormState(definition));
    setCommonFlags(extractCommonAttributeFlags(definition.behaviorFlags ?? {}));
  }

  function resetForm() {
    setEditingId(null);
    setForm(buildInitialFormState());
    setCommonFlags(DEFAULT_COMMON_ATTRIBUTE_FLAGS);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const payload = {
        key: form.key,
        label: form.label,
        description: form.description || null,
        entityScope: form.entityScope,
        dataType: form.dataType,
        isRequired: form.isRequired,
        isActive: form.isActive,
        allowSuggestions: form.allowSuggestions,
        sortOrder: Number(form.sortOrder || 0),
        validationRules: parseJsonObject(form.validationRules, "Validation rules"),
        displayRules: parseJsonObject(form.displayRules, "Display rules"),
        behaviorFlags: mergeCommonAttributeFlags(
          parseJsonObject(form.behaviorFlags, "Behavior flags"),
          commonFlags
        ),
        options: form.options.trim() ? parseOptions(form.options) : [],
      };

      const result = editingId
        ? await updateOperationalAttributeDefinition(editingId, payload)
        : await createOperationalAttributeDefinition(payload);

      const normalized = {
        ...result,
        description: result.description ?? null,
        validationRules: result.validationRules ?? {},
        displayRules: result.displayRules ?? {},
        behaviorFlags: result.behaviorFlags ?? {},
        options: result.options ?? [],
      } as AttributeDefinitionRow;

      setDefinitions((current) => {
        const next = current.filter((definition) => definition.id !== normalized.id);
        return [...next, normalized];
      });
      toast.success(editingId ? "Attribute updated" : "Attribute created");
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save attribute");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(definitionId: string) {
    try {
      const result = await archiveOperationalAttributeDefinition(definitionId);
      setDefinitions((current) =>
        current.map((definition) =>
          definition.id === result.id ? { ...definition, isActive: false } : definition
        )
      );
      if (editingId === definitionId) resetForm();
      toast.success("Attribute archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive attribute");
    }
  }

  const usesOptions = form.dataType === "single_select" || form.dataType === "multi_select";
  const toggleFlag = (name: keyof CommonAttributeFlagState, checked: boolean) =>
    setCommonFlags((current) => ({ ...current, [name]: checked }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Existing Definitions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedDefinitions.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No operational attributes configured yet.
            </div>
          ) : (
            sortedDefinitions.map((definition) => (
              <div key={definition.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{definition.label}</div>
                      <Badge variant="outline">{definition.key}</Badge>
                      <Badge variant="secondary">{definition.entityScope}</Badge>
                      <Badge variant="secondary">{definition.dataType}</Badge>
                      {!definition.isActive && <Badge variant="destructive">Archived</Badge>}
                    </div>
                    {definition.description && (
                      <p className="text-sm text-muted-foreground">{definition.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {definition.isRequired && <span>Required</span>}
                      {definition.allowSuggestions && <span>Suggestions</span>}
                      {definition._count?.values ? <span>{definition._count.values} stored values</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(definition)}>
                      Edit
                    </Button>
                    {definition.isActive && (
                      <Button variant="ghost" size="sm" onClick={() => handleArchive(definition.id)}>
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Definition" : "Create Definition"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Key</Label>
            <Input value={form.key} onChange={(e) => updateField("key", e.target.value)} placeholder="room_reference" />
          </div>
          <div className="space-y-2">
            <Label>Label</Label>
            <Input value={form.label} onChange={(e) => updateField("label", e.target.value)} placeholder="Room Reference" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Entity Scope</Label>
              <select
                value={form.entityScope}
                onChange={(e) => updateField("entityScope", e.target.value as AttributeScope)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Data Type</Label>
              <select
                value={form.dataType}
                onChange={(e) => updateField("dataType", e.target.value as AttributeDataType)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input value={form.sortOrder} onChange={(e) => updateField("sortOrder", e.target.value)} />
            </div>
            <div className="space-y-3 pt-7">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.isRequired} onCheckedChange={(checked) => updateField("isRequired", !!checked)} />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.isActive} onCheckedChange={(checked) => updateField("isActive", !!checked)} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.allowSuggestions}
                  onCheckedChange={(checked) => updateField("allowSuggestions", !!checked)}
                />
                Allow suggestions
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Common Behavior Flags</Label>
            <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={commonFlags.searchable} onCheckedChange={(checked) => toggleFlag("searchable", !!checked)} />
                Searchable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={commonFlags.allocatable} onCheckedChange={(checked) => toggleFlag("allocatable", !!checked)} />
                Allocatable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={commonFlags.showOnLabel} onCheckedChange={(checked) => toggleFlag("showOnLabel", !!checked)} />
                Show on label
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={commonFlags.showOnManifest} onCheckedChange={(checked) => toggleFlag("showOnManifest", !!checked)} />
                Show on manifest
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={commonFlags.showOnPackingList}
                  onCheckedChange={(checked) => toggleFlag("showOnPackingList", !!checked)}
                />
                Show on packing list
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Advanced Behavior Flags (JSON)</Label>
            <Textarea
              value={form.behaviorFlags}
              onChange={(e) => updateField("behaviorFlags", e.target.value)}
              rows={4}
              placeholder='{"searchable": true, "allocatable": true, "showInReceiving": true}'
            />
            <p className="text-xs text-muted-foreground">
              Use this for advanced flags. The common toggles above are merged automatically.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Validation Rules (JSON)</Label>
            <Textarea
              value={form.validationRules}
              onChange={(e) => updateField("validationRules", e.target.value)}
              rows={3}
              placeholder='{"maxLength": 100}'
            />
          </div>
          <div className="space-y-2">
            <Label>Display Rules (JSON)</Label>
            <Textarea
              value={form.displayRules}
              onChange={(e) => updateField("displayRules", e.target.value)}
              rows={3}
              placeholder='{"receivingGroup": "identity"}'
            />
          </div>
          {usesOptions && (
            <div className="space-y-2">
              <Label>Options</Label>
              <Textarea
                value={form.options}
                onChange={(e) => updateField("options", e.target.value)}
                rows={5}
                placeholder={"living_room|Living Room|0|true\nprimary_bedroom|Primary Bedroom|1|true"}
              />
              <p className="text-xs text-muted-foreground">
                One option per line: value|label|sortOrder|isActive
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Definition" : "Create Definition"}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
