"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bulkLocationSchema, type BulkLocationFormData } from "@/modules/warehouse/schemas";
import { generateBulkLocations } from "@/modules/warehouse/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useState } from "react";

const INITIAL_WAREHOUSES = [
  { id: "1", code: "WH1", name: "Main Warehouse" },
  { id: "2", code: "WH2", name: "Cold Storage Annex" },
];

export default function BulkGeneratePage() {
  const router = useRouter();
  const [warehouses] = useState(INITIAL_WAREHOUSES);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BulkLocationFormData>({
    resolver: zodResolver(bulkLocationSchema),
    defaultValues: {
      zoneType: "storage",
      binType: "standard",
      aisles: 1,
      racksPerAisle: 4,
      shelvesPerRack: 4,
      binsPerShelf: 4,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const aisles = watch("aisles") || 0;
  const racks = watch("racksPerAisle") || 0;
  const shelves = watch("shelvesPerRack") || 0;
  const bins = watch("binsPerShelf") || 0;
  const totalBins = aisles * racks * shelves * bins;

  async function onSubmit(data: BulkLocationFormData) {
    try {
      const result = await generateBulkLocations(data);
      toast.success(`Generated ${result.binCount} bins`);
      router.push("/warehouse");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate locations");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Generate Locations"
        description="Create an entire zone hierarchy at once"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Warehouse & Zone</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label>Warehouse *</Label>
              <select
                {...register("warehouseId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select warehouse...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </option>
                ))}
              </select>
              {errors.warehouseId && (
                <p className="text-xs text-destructive">{errors.warehouseId.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Zone Code *</Label>
                <Input {...register("zoneCode")} placeholder="B" />
              </div>
              <div className="space-y-2">
                <Label>Zone Name *</Label>
                <Input {...register("zoneName")} placeholder="Zone B - Bulk" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Zone Type</Label>
              <select
                {...register("zoneType")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="storage">Storage</option>
                <option value="staging">Staging</option>
                <option value="dock">Dock</option>
                <option value="quarantine">Quarantine</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location Structure</CardTitle>
            <CardDescription>This will create {totalBins} bins total</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Aisles</Label>
              <Input type="number" min={1} {...register("aisles")} />
            </div>
            <div className="space-y-2">
              <Label>Racks per Aisle</Label>
              <Input type="number" min={1} {...register("racksPerAisle")} />
            </div>
            <div className="space-y-2">
              <Label>Shelves per Rack</Label>
              <Input type="number" min={1} {...register("shelvesPerRack")} />
            </div>
            <div className="space-y-2">
              <Label>Bins per Shelf</Label>
              <Input type="number" min={1} {...register("binsPerShelf")} />
            </div>
            <div className="space-y-2">
              <Label>Bin Type</Label>
              <select
                {...register("binType")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="bulk">Bulk</option>
                <option value="pick">Pick</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generating..." : `Generate ${totalBins} Bins`}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
