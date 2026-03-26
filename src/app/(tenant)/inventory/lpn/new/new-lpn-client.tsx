"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLpn } from "@/modules/lpn/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ProductOption = { id: string; sku: string; name: string };
type BinOption = { id: string; code: string };
type AttributeDefinition = {
  id: string;
  label: string;
  description: string | null;
  dataType: "text" | "number" | "currency" | "date" | "boolean" | "single_select" | "multi_select" | "json";
  options: Array<{ value: string; label: string }>;
};

type ContentRow = {
  productId: string;
  quantity: number;
  lotNumber: string;
  serialNumber: string;
};

export function NewLpnClient({
  bins,
  products,
  attributeDefinitions,
}: {
  bins: BinOption[];
  products: ProductOption[];
  attributeDefinitions: AttributeDefinition[];
}) {
  const router = useRouter();
  const [binId, setBinId] = useState("");
  const [palletType, setPalletType] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [contents, setContents] = useState<ContentRow[]>([
    { productId: "", quantity: 1, lotNumber: "", serialNumber: "" },
  ]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string | boolean | string[]>>(
    Object.fromEntries(
      attributeDefinitions.map((definition) => [definition.id, definition.dataType === "boolean" ? false : ""])
    )
  );
  const [saving, setSaving] = useState(false);

  function updateContentRow(index: number, patch: Partial<ContentRow>) {
    setContents((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function addContentRow() {
    setContents((current) => [
      ...current,
      { productId: "", quantity: 1, lotNumber: "", serialNumber: "" },
    ]);
  }

  function removeContentRow(index: number) {
    setContents((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createLpn({
        binId: binId || null,
        palletType: palletType || null,
        totalWeight: totalWeight ? Number(totalWeight) : null,
        notes: notes || null,
        contents: contents
          .filter((row) => row.productId)
          .map((row) => ({
            productId: row.productId,
            quantity: row.quantity,
            lotNumber: row.lotNumber || null,
            serialNumber: row.serialNumber || null,
          })),
        operationalAttributes: attributeDefinitions.map((definition) => ({
          definitionId: definition.id,
          value: attributeValues[definition.id] ?? null,
        })),
      });
      toast.success("LPN created");
      router.push("/inventory/lpn");
      return created;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create LPN");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New LPN" description="Create a license plate with optional operational attributes." />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>LPN Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Target Bin</Label>
              <select
                value={binId}
                onChange={(e) => setBinId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select bin...</option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Pallet Type</Label>
              <Input value={palletType} onChange={(e) => setPalletType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Total Weight</Label>
              <Input type="number" step="0.01" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        {attributeDefinitions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Operational Attributes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {attributeDefinitions.map((definition) => (
                <div key={definition.id} className="space-y-2">
                  <Label>{definition.label}</Label>
                  {definition.description && (
                    <p className="text-xs text-muted-foreground">{definition.description}</p>
                  )}
                  {definition.dataType === "boolean" ? (
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Checkbox
                        checked={Boolean(attributeValues[definition.id])}
                        onCheckedChange={(checked) =>
                          setAttributeValues((current) => ({
                            ...current,
                            [definition.id]: Boolean(checked),
                          }))
                        }
                      />
                      <span>Enabled</span>
                    </label>
                  ) : definition.dataType === "single_select" ? (
                    <select
                      value={String(attributeValues[definition.id] ?? "")}
                      onChange={(e) =>
                        setAttributeValues((current) => ({
                          ...current,
                          [definition.id]: e.target.value,
                        }))
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      <option value="">Select value...</option>
                      {definition.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : definition.dataType === "multi_select" ? (
                    <Textarea
                      value={
                        Array.isArray(attributeValues[definition.id])
                          ? (attributeValues[definition.id] as string[]).join(", ")
                          : String(attributeValues[definition.id] ?? "")
                      }
                      onChange={(e) =>
                        setAttributeValues((current) => ({
                          ...current,
                          [definition.id]: e.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={2}
                    />
                  ) : (
                    <Input
                      type={
                        definition.dataType === "number" || definition.dataType === "currency"
                          ? "number"
                          : definition.dataType === "date"
                            ? "date"
                            : "text"
                      }
                      value={String(attributeValues[definition.id] ?? "")}
                      onChange={(e) =>
                        setAttributeValues((current) => ({
                          ...current,
                          [definition.id]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Contents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contents.map((row, index) => (
              <div key={index} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Product</Label>
                  <select
                    value={row.productId}
                    onChange={(e) => updateContentRow(index, { productId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">Select product...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) => updateContentRow(index, { quantity: Number(e.target.value || 1) })}
                  />
                </div>
                <div className="flex items-end justify-end">
                  {contents.length > 1 && (
                    <Button type="button" variant="ghost" onClick={() => removeContentRow(index)}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Lot Number</Label>
                  <Input value={row.lotNumber} onChange={(e) => updateContentRow(index, { lotNumber: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input
                    value={row.serialNumber}
                    onChange={(e) => updateContentRow(index, { serialNumber: e.target.value })}
                  />
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addContentRow}>
              Add Content Row
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create LPN"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
