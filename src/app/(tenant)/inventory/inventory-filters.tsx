"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AttributeDefinition = {
  id: string;
  label: string;
};

export function InventoryFilters({
  definitions,
  currentDefinitionId,
  currentAttributeValue,
}: {
  definitions: AttributeDefinition[];
  currentDefinitionId: string;
  currentAttributeValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [definitionId, setDefinitionId] = useState(currentDefinitionId);
  const [attributeValue, setAttributeValue] = useState(currentAttributeValue);

  function buildUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (!value) sp.delete(key);
      else sp.set(key, value);
    }
    sp.delete("page");
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      buildUrl({
        attributeDefinitionId: definitionId || undefined,
        attributeValue: attributeValue || undefined,
      })
    );
  }

  function clearFilters() {
    setDefinitionId("");
    setAttributeValue("");
    router.push(
      buildUrl({
        attributeDefinitionId: undefined,
        attributeValue: undefined,
      })
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>Attribute</Label>
        <select
          value={definitionId}
          onChange={(e) => setDefinitionId(e.target.value)}
          className="flex h-9 min-w-56 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="">Select attribute...</option>
          {definitions.map((definition) => (
            <option key={definition.id} value={definition.id}>
              {definition.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Value contains</Label>
        <Input
          value={attributeValue}
          onChange={(e) => setAttributeValue(e.target.value)}
          placeholder="Search attribute value..."
          className="min-w-64"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Apply</Button>
        <Button type="button" variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>
    </form>
  );
}
