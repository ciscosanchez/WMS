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
import { useTranslations } from "next-intl";

const INITIAL_WAREHOUSES = [
  { id: "1", code: "WH1", name: "Main Warehouse" },
  { id: "2", code: "WH2", name: "Cold Storage Annex" },
];

export default function BulkGeneratePage() {
  const t = useTranslations("tenant.warehouse");
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
      <PageHeader title={t("bulkGenerateTitle")} description={t("bulkGenerateDesc")} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{t("warehouseZone")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label>{t("warehouse")} *</Label>
              <select
                {...register("warehouseId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">{t("selectWarehouse")}</option>
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
                <Label>{t("zoneCode")} *</Label>
                <Input {...register("zoneCode")} placeholder="B" />
              </div>
              <div className="space-y-2">
                <Label>{t("zoneName")} *</Label>
                <Input {...register("zoneName")} placeholder="Zone B - Bulk" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("type")}</Label>
              <select
                {...register("zoneType")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="storage">{t("storage")}</option>
                <option value="staging">{t("staging")}</option>
                <option value="dock">{t("dock")}</option>
                <option value="quarantine">{t("quarantine")}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("locationStructure")}</CardTitle>
            <CardDescription>
              {t("willCreate")} {totalBins} {t("binsTotal")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("aisles")}</Label>
              <Input type="number" min={1} {...register("aisles")} />
            </div>
            <div className="space-y-2">
              <Label>{t("racksPerAisle")}</Label>
              <Input type="number" min={1} {...register("racksPerAisle")} />
            </div>
            <div className="space-y-2">
              <Label>{t("shelvesPerRack")}</Label>
              <Input type="number" min={1} {...register("shelvesPerRack")} />
            </div>
            <div className="space-y-2">
              <Label>{t("binsPerShelf")}</Label>
              <Input type="number" min={1} {...register("binsPerShelf")} />
            </div>
            <div className="space-y-2">
              <Label>{t("binType")}</Label>
              <select
                {...register("binType")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="standard">{t("standard")}</option>
                <option value="bulk">{t("bulk")}</option>
                <option value="pick">{t("pick")}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("generating") : `${t("generate")} ${totalBins} ${t("bins")}`}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
