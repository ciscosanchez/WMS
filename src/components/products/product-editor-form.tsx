"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { getClients } from "@/modules/clients/actions";
import {
  createProduct,
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/modules/products/actions";
import { productSchema, type ProductFormData } from "@/modules/products/schemas";
import {
  BASE_UOM_OPTIONS,
  DIM_UNIT_OPTIONS,
  PACKAGING_UOM_OPTIONS,
  WEIGHT_UNIT_OPTIONS,
  ensureUomOption,
  normalizeUomCode,
} from "@/modules/products/uom";
import { PageHeader } from "@/components/shared/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ClientOption = {
  id: string;
  code: string;
  name: string;
};

type ProductLookup = Awaited<ReturnType<typeof getProduct>>;
type ProductEditorRecord = NonNullable<ProductLookup> & {
  imageUrl?: string | null;
  barcode?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimUnit?: string | null;
  unitsPerCase?: number | null;
  caseBarcode?: string | null;
  uomConversions?: Array<{ fromUom: string; toUom: string; factor: number }>;
};

type ProductEditorFormProps = {
  mode: "create" | "edit";
  productId?: string;
};

function weightUnitLabel(value: string) {
  return WEIGHT_UNIT_OPTIONS.find((option) => option.code === value)?.label ?? value;
}

function dimUnitLabel(value: string) {
  return DIM_UNIT_OPTIONS.find((option) => option.code === value)?.label ?? value;
}

export function ProductEditorForm({ mode, productId }: ProductEditorFormProps) {
  const router = useRouter();
  const t = useTranslations("tenant.products");
  const tv = useTranslations("validation");
  const [loading, setLoading] = useState(mode === "edit");
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [packagingOpen, setPackagingOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema(tv)),
    defaultValues: {
      clientId: "",
      sku: "",
      name: "",
      description: "",
      hsCode: "",
      barcode: "",
      baseUom: "EA",
      unitsPerCase: undefined,
      caseBarcode: "",
      uomConversions: [],
      weightUnit: "lb",
      dimUnit: "in",
      isActive: true,
      trackLot: false,
      trackSerial: false,
    },
  });

  const baseUom = watch("baseUom") ?? "EA";
  const unitsPerCase = watch("unitsPerCase");
  const caseBarcode = watch("caseBarcode");
  const watchedConversions = watch("uomConversions");
  const conversions = useMemo(() => watchedConversions ?? [], [watchedConversions]);

  useEffect(() => {
    async function load() {
      try {
        const [clientList, rawProduct] = await Promise.all([
          getClients() as Promise<ClientOption[]>,
          mode === "edit" && productId
            ? getProduct(productId)
            : Promise.resolve(null as ProductLookup),
        ]);
        setClients(clientList);
        if (mode === "edit") {
          if (!rawProduct) {
            setNotFound(true);
            return;
          }
          const product = rawProduct as ProductEditorRecord;
          setImageUrl(product.imageUrl ?? null);
          reset({
            clientId: product.clientId,
            sku: product.sku,
            name: product.name,
            description: product.description ?? "",
            hsCode: product.hsCode ?? "",
            barcode: product.barcode ?? "",
            weight: product.weight ? Number(product.weight) : undefined,
            weightUnit: product.weightUnit ?? "lb",
            length: product.length ? Number(product.length) : undefined,
            width: product.width ? Number(product.width) : undefined,
            height: product.height ? Number(product.height) : undefined,
            dimUnit: product.dimUnit ?? "in",
            baseUom: normalizeUomCode(product.baseUom),
            unitsPerCase: product.unitsPerCase ?? undefined,
            caseBarcode: product.caseBarcode ?? "",
            uomConversions:
              product.uomConversions?.map((conversion) => ({
                fromUom: normalizeUomCode(conversion.fromUom),
                toUom: normalizeUomCode(conversion.toUom),
                factor: Number(conversion.factor),
              })) ?? [],
            trackLot: product.trackLot,
            trackSerial: product.trackSerial,
            minStock: product.minStock ?? undefined,
            maxStock: product.maxStock ?? undefined,
            isActive: product.isActive,
          });
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [mode, productId, reset]);

  const baseUomOptions = useMemo(
    () => ensureUomOption(BASE_UOM_OPTIONS, baseUom, "Base UOM"),
    [baseUom]
  );

  const packagingUnitOptions = useMemo(() => {
    let options = ensureUomOption(PACKAGING_UOM_OPTIONS, "CS", "Packaging UOM");
    for (const conversion of conversions) {
      options = ensureUomOption(options, conversion.fromUom, "Packaging UOM");
    }
    return options.filter((option) => option.code !== baseUom);
  }, [baseUom, conversions]);

  function syncBaseUom(nextBaseUom: string) {
    const normalized = normalizeUomCode(nextBaseUom);
    setValue("baseUom", normalized, { shouldDirty: true, shouldValidate: true });
    const nextConversions = (getValues("uomConversions") ?? [])
      .map((conversion) => ({
        ...conversion,
        fromUom: normalizeUomCode(conversion.fromUom),
        toUom: normalized,
      }))
      .filter((conversion) => conversion.fromUom !== normalized);
    setValue("uomConversions", nextConversions, { shouldDirty: true, shouldValidate: true });
  }

  function updateConversionRow(index: number, patch: Partial<{ fromUom: string; factor: number }>) {
    const next = [...conversions];
    next[index] = {
      ...next[index],
      fromUom: normalizeUomCode(patch.fromUom ?? next[index].fromUom),
      toUom: baseUom,
      factor: patch.factor ?? next[index].factor,
    };
    setValue("uomConversions", next, { shouldDirty: true, shouldValidate: true });
  }

  function addConversionRow() {
    const fallback = packagingUnitOptions[0]?.code ?? "CS";
    setValue("uomConversions", [...conversions, { fromUom: fallback, toUom: baseUom, factor: 1 }], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function removeConversionRow(index: number) {
    setValue(
      "uomConversions",
      conversions.filter((_, currentIndex) => currentIndex !== index),
      { shouldDirty: true, shouldValidate: true }
    );
  }

  async function onSubmit(data: ProductFormData) {
    try {
      if (mode === "edit" && productId) {
        await updateProduct(productId, data);
        toast.success(t("productUpdated"));
      } else {
        await createProduct(data);
        toast.success(t("productCreated"));
      }
      router.push("/products");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("failedSave"));
    }
  }

  async function handleDelete() {
    if (!productId) return;
    try {
      setDeleting(true);
      await deleteProduct(productId);
      toast.success(t("productDeleted"));
      router.push("/products");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("failedDelete"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{t("loading")}</div>;
  }

  if (notFound) {
    return <div className="py-10 text-center text-muted-foreground">{t("productNotFound")}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "edit" ? t("editProduct") : t("newProduct")}
        description={mode === "edit" ? t("editProductDesc") : t("newProductDesc")}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
        {imageUrl && (
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Image
                src={imageUrl}
                alt={t("productImageAlt")}
                width={80}
                height={80}
                className="rounded-md border object-cover"
                unoptimized
              />
              <div className="text-sm text-muted-foreground">{t("shopifyImage")}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("generalInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientId">{t("client")} *</Label>
              <select
                id="clientId"
                {...register("clientId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">{t("selectClient")}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.code} - {client.name}
                  </option>
                ))}
              </select>
              {errors.clientId && (
                <p className="text-xs text-destructive">{errors.clientId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">{t("sku")} *</Label>
              <Input id="sku" {...register("sku")} />
              {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">{t("name")} *</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea id="description" {...register("description")} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hsCode">{t("hsCode")}</Label>
              <Input id="hsCode" {...register("hsCode")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">{t("barcode")}</Label>
              <Input id="barcode" {...register("barcode")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("packagingTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="baseUom">{t("baseUom")}</Label>
              <Select value={baseUom} onValueChange={(value) => syncBaseUom(value ?? "EA")}>
                <SelectTrigger id="baseUom" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {baseUomOptions.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.code} - {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("baseUomHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitsPerCase">{t("unitsPerCase")}</Label>
              <Input id="unitsPerCase" type="number" min="1" {...register("unitsPerCase")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caseBarcode">{t("caseBarcode")}</Label>
              <Input id="caseBarcode" {...register("caseBarcode")} />
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 sm:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{t("packagingConfig")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("packagingSummary", {
                      count: conversions.length,
                      baseUom,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {unitsPerCase
                      ? t("casePackSummary", { unitsPerCase, baseUom })
                      : t("noCasePackConfigured")}
                  </div>
                  {caseBarcode ? (
                    <div className="text-xs text-muted-foreground">
                      {t("caseBarcodeSummary", { caseBarcode })}
                    </div>
                  ) : null}
                </div>
                <Button type="button" variant="outline" onClick={() => setPackagingOpen(true)}>
                  {t("configurePackaging")}
                </Button>
              </div>
            </div>
            {errors.baseUom && <p className="text-xs text-destructive">{errors.baseUom.message}</p>}
            {errors.uomConversions?.root?.message ? (
              <p className="text-xs text-destructive sm:col-span-2">
                {errors.uomConversions.root.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dimensionsWeight")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="weight">{t("weight")}</Label>
              <div className="flex gap-2">
                <Input id="weight" type="number" step="0.0001" {...register("weight")} />
                <Select
                  value={watch("weightUnit") ?? "lb"}
                  onValueChange={(value) =>
                    setValue("weightUnit", value ?? "lb", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="h-9 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {WEIGHT_UNIT_OPTIONS.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="length">{t("dimensions")}</Label>
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input
                  id="length"
                  type="number"
                  step="0.01"
                  placeholder={t("length")}
                  {...register("length")}
                />
                <Input
                  id="width"
                  type="number"
                  step="0.01"
                  placeholder={t("width")}
                  {...register("width")}
                />
                <Input
                  id="height"
                  type="number"
                  step="0.01"
                  placeholder={t("height")}
                  {...register("height")}
                />
                <Select
                  value={watch("dimUnit") ?? "in"}
                  onValueChange={(value) =>
                    setValue("dimUnit", value ?? "in", { shouldDirty: true, shouldValidate: true })
                  }
                >
                  <SelectTrigger className="h-9 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {DIM_UNIT_OPTIONS.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("dimensionUnitsSummary", {
                  weightUnit: weightUnitLabel(watch("weightUnit") ?? "lb"),
                  dimUnit: dimUnitLabel(watch("dimUnit") ?? "in"),
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("trackingStockLevels")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="trackLot"
                  checked={watch("trackLot")}
                  onCheckedChange={(value) =>
                    setValue("trackLot", Boolean(value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="trackLot">{t("trackByLot")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="trackSerial"
                  checked={watch("trackSerial")}
                  onCheckedChange={(value) =>
                    setValue("trackSerial", Boolean(value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="trackSerial">{t("trackBySerial")}</Label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minStock">{t("minStock")}</Label>
                <Input id="minStock" type="number" {...register("minStock")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxStock">{t("maxStock")}</Label>
                <Input id="maxStock" type="number" {...register("maxStock")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "edit"
                ? t("saving")
                : t("creating")
              : mode === "edit"
                ? t("saveChanges")
                : t("createProduct")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
          {mode === "edit" && productId ? (
            <div className="ml-auto">
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="destructive" type="button" />}>
                  {deleting ? t("deleting") : t("delete")}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteProduct")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("deleteProductConfirm")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>{t("delete")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>
      </form>

      <Dialog open={packagingOpen} onOpenChange={setPackagingOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("configurePackaging")}</DialogTitle>
            <DialogDescription>{t("configurePackagingDesc", { baseUom })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dialogUnitsPerCase">{t("unitsPerCase")}</Label>
                <Input
                  id="dialogUnitsPerCase"
                  type="number"
                  min="1"
                  value={unitsPerCase ?? ""}
                  onChange={(event) =>
                    setValue(
                      "unitsPerCase",
                      event.target.value ? Number(event.target.value) : undefined,
                      { shouldDirty: true, shouldValidate: true }
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialogCaseBarcode">{t("caseBarcode")}</Label>
                <Input
                  id="dialogCaseBarcode"
                  value={caseBarcode ?? ""}
                  onChange={(event) =>
                    setValue("caseBarcode", event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{t("conversionTitle")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("conversionHelp", { baseUom })}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addConversionRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addConversion")}
                </Button>
              </div>

              {conversions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {t("noConversions")}
                </div>
              ) : (
                <div className="space-y-3">
                  {conversions.map((conversion, index) => {
                    const rowOptions = ensureUomOption(
                      packagingUnitOptions,
                      conversion.fromUom,
                      "Packaging UOM"
                    );
                    return (
                      <div
                        key={`${conversion.fromUom}-${index}`}
                        className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_1fr_auto]"
                      >
                        <div className="space-y-2">
                          <Label>{t("packagingUnit")}</Label>
                          <Select
                            value={conversion.fromUom}
                            onValueChange={(value) =>
                              updateConversionRow(index, { fromUom: value ?? conversion.fromUom })
                            }
                          >
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {rowOptions.map((option) => (
                                <SelectItem key={option.code} value={option.code}>
                                  {option.code} - {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end text-sm text-muted-foreground">=</div>
                        <div className="space-y-2">
                          <Label>{t("conversionFactor")}</Label>
                          <Input
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            value={conversion.factor}
                            onChange={(event) =>
                              updateConversionRow(index, {
                                factor: event.target.value ? Number(event.target.value) : 1,
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("conversionEquation", {
                              fromUom: conversion.fromUom,
                              factor: conversion.factor,
                              baseUom,
                            })}
                          </p>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeConversionRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setPackagingOpen(false)}>
              {t("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
