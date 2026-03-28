"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDockDoor, updateDockDoor } from "@/modules/yard-dock/actions";

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type DockDoorFormData = {
  code: string;
  name: string;
  warehouseId: string;
  type: "inbound" | "outbound" | "both";
  notes: string;
};

const DEFAULT_FORM: DockDoorFormData = {
  code: "",
  name: "",
  warehouseId: "",
  type: "both",
  notes: "",
};

interface DockDoorFormProps {
  mode: "create" | "edit";
  warehouses: WarehouseOption[];
  dockDoorId?: string;
  initialValues?: Partial<DockDoorFormData>;
}

export function DockDoorForm({ mode, warehouses, dockDoorId, initialValues }: DockDoorFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<DockDoorFormData>({ ...DEFAULT_FORM, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = mode === "create" ? "New Dock Door" : "Edit Dock Door";
  const description =
    mode === "create"
      ? "Create an inbound, outbound, or shared dock door."
      : "Update dock door details and warehouse assignment.";

  const submitLabel = useMemo(
    () =>
      isSubmitting
        ? mode === "create"
          ? "Creating..."
          : "Saving..."
        : mode === "create"
          ? "Create Dock Door"
          : "Save Changes",
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
      notes: form.notes || null,
    };

    try {
      if (mode === "create") {
        const result = await createDockDoor(payload);
        toast.success(`Dock door ${result.code} created`);
      } else if (dockDoorId) {
        const result = await updateDockDoor(dockDoorId, payload);
        toast.success(`Dock door ${result.code} updated`);
      }

      router.push("/yard-dock/dock-doors");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to save dock door";
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
            <CardTitle>Door Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="e.g. D-01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Inbound Door 1"
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
                    type: event.target.value as DockDoorFormData["type"],
                  }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={4}
                placeholder="Optional notes about equipment, restrictions, or door usage"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/yard-dock/dock-doors")}
          >
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
