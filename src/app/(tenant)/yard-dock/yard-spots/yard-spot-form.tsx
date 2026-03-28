"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createYardSpot, updateYardSpot } from "@/modules/yard-dock/actions";
import { getWarehouses } from "@/modules/warehouse/actions";

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type YardSpotFormData = {
  code: string;
  name: string;
  warehouseId: string;
  type: "parking" | "staging" | "refrigerated" | "hazmat";
  row: string;
  col: string;
  notes: string;
};

const DEFAULT_FORM: YardSpotFormData = {
  code: "",
  name: "",
  warehouseId: "",
  type: "parking",
  row: "",
  col: "",
  notes: "",
};

interface YardSpotFormProps {
  mode: "create" | "edit";
  yardSpotId?: string;
  initialValues?: Partial<YardSpotFormData>;
}

export function YardSpotForm({ mode, yardSpotId, initialValues }: YardSpotFormProps) {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [form, setForm] = useState<YardSpotFormData>({ ...DEFAULT_FORM, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getWarehouses().then((items) =>
      setWarehouses(items.map((warehouse) => ({ id: warehouse.id, code: warehouse.code, name: warehouse.name })))
    );
  }, []);

  const title = mode === "create" ? "New Yard Spot" : "Edit Yard Spot";
  const description =
    mode === "create"
      ? "Create a parking, staging, refrigerated, or hazmat spot in the yard."
      : "Update yard spot details and location metadata.";

  const submitLabel = useMemo(
    () => (isSubmitting ? (mode === "create" ? "Creating..." : "Saving...") : mode === "create" ? "Create Yard Spot" : "Save Changes"),
    [isSubmitting, mode]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload = {
      code: form.code,
      name: form.name,
      warehouseId: form.warehouseId,
      type: form.type,
      row: form.row ? Number(form.row) : null,
      col: form.col ? Number(form.col) : null,
      notes: form.notes || null,
    };

    try {
      if (mode === "create") {
        const result = await createYardSpot(payload);
        toast.success(`Yard spot ${result.code} created`);
      } else if (yardSpotId) {
        const result = await updateYardSpot(yardSpotId, payload);
        toast.success(`Yard spot ${result.code} updated`);
      }

      router.push("/yard-dock/yard-spots");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to save yard spot";
      setError(message);
      toast.error(message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Spot Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                placeholder="e.g. Y-01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="North Yard Spot 1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse *</Label>
              <select
                id="warehouse"
                value={form.warehouseId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, warehouseId: event.target.value }))
                }
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <select
                id="type"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as YardSpotFormData["type"],
                  }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="parking">Parking</option>
                <option value="staging">Staging</option>
                <option value="refrigerated">Refrigerated</option>
                <option value="hazmat">Hazmat</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="row">Row</Label>
              <Input
                id="row"
                type="number"
                min="0"
                value={form.row}
                onChange={(event) => setForm((current) => ({ ...current, row: event.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="col">Column</Label>
              <Input
                id="col"
                type="number"
                min="0"
                value={form.col}
                onChange={(event) => setForm((current) => ({ ...current, col: event.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={4}
                placeholder="Optional notes about access, equipment, or restrictions"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/yard-dock/yard-spots")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
