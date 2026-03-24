"use client";

import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductFormData } from "@/modules/products/schemas";
import { getProduct, updateProduct, deleteProduct } from "@/modules/products/actions";
import { getClients } from "@/modules/clients/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
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
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const t = useTranslations("tenant.products");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
  });

  useEffect(() => {
    async function load() {
      try {
        const [rawProduct, clientList] = await Promise.all([getProduct(params.id), getClients()]);
        setClients(clientList);
        if (!rawProduct) {
          setNotFound(true);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const product = rawProduct as any;
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
          baseUom: product.baseUom,
          trackLot: product.trackLot,
          trackSerial: product.trackSerial,
          minStock: product.minStock ?? undefined,
          maxStock: product.maxStock ?? undefined,
          isActive: product.isActive,
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, reset]);

  async function onSubmit(data: ProductFormData) {
    try {
      await updateProduct(params.id, data);
      toast.success(t("productUpdated"));
      router.push("/products");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("failedUpdate"));
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await deleteProduct(params.id);
      toast.success(t("productDeleted"));
      router.push("/products");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("failedDelete"));
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
      <PageHeader title={t("editProduct")} description={t("editProductDesc")} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        {imageUrl && (
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <Image
                src={imageUrl}
                alt="Product image"
                width={80}
                height={80}
                className="rounded-md object-cover border"
                unoptimized
              />
              <div className="text-sm text-muted-foreground">
                {t("shopifyImage")}
              </div>
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
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
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
            <div className="space-y-2">
              <Label htmlFor="baseUom">{t("baseUom")}</Label>
              <Input id="baseUom" {...register("baseUom")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dimensionsWeight")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="weight">{t("weight")}</Label>
              <div className="flex gap-2">
                <Input id="weight" type="number" step="0.0001" {...register("weight")} />
                <select
                  {...register("weightUnit")}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm w-20"
                >
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                  <option value="oz">oz</option>
                  <option value="g">g</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="length">{t("length")}</Label>
              <Input id="length" type="number" step="0.01" {...register("length")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="width">{t("width")}</Label>
              <Input id="width" type="number" step="0.01" {...register("width")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">{t("height")}</Label>
              <Input id="height" type="number" step="0.01" {...register("height")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("trackingStockLevels")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="trackLot"
                  checked={watch("trackLot")}
                  onCheckedChange={(v) => setValue("trackLot", !!v)}
                />
                <Label htmlFor="trackLot">{t("trackByLot")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="trackSerial"
                  checked={watch("trackSerial")}
                  onCheckedChange={(v) => setValue("trackSerial", !!v)}
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
            {isSubmitting ? t("saving") : t("saveChanges")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button type="button" variant="destructive" disabled={deleting} />}
              >
                {deleting ? t("deleting") : t("delete")}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteProduct")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteProductConfirm")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>{t("delete")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </form>
    </div>
  );
}
