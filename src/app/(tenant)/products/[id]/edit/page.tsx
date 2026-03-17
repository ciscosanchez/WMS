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

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);

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
      toast.success("Product updated");
      router.push("/products");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update product");
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await deleteProduct(params.id);
      toast.success("Product deleted");
      router.push("/products");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (notFound) {
    return <div className="py-10 text-center text-muted-foreground">Product not found</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Product" description="Update product details" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>General Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client *</Label>
              <select
                id="clientId"
                {...register("clientId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select client...</option>
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
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" {...register("sku")} />
              {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register("description")} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hsCode">HS Code</Label>
              <Input id="hsCode" {...register("hsCode")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" {...register("barcode")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUom">Base UOM</Label>
              <Input id="baseUom" {...register("baseUom")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dimensions & Weight</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <Input id="weight" type="number" step="0.01" {...register("weight")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="length">Length</Label>
              <Input id="length" type="number" step="0.01" {...register("length")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="width">Width</Label>
              <Input id="width" type="number" step="0.01" {...register("width")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height</Label>
              <Input id="height" type="number" step="0.01" {...register("height")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracking & Stock Levels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="trackLot"
                  checked={watch("trackLot")}
                  onCheckedChange={(v) => setValue("trackLot", !!v)}
                />
                <Label htmlFor="trackLot">Track by Lot Number</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="trackSerial"
                  checked={watch("trackSerial")}
                  onCheckedChange={(v) => setValue("trackSerial", !!v)}
                />
                <Label htmlFor="trackSerial">Track by Serial Number</Label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minStock">Minimum Stock</Label>
                <Input id="minStock" type="number" {...register("minStock")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxStock">Maximum Stock</Label>
                <Input id="maxStock" type="number" {...register("maxStock")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button type="button" variant="destructive" disabled={deleting} />}
              >
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Product</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the product and all
                    associated inventory data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </form>
    </div>
  );
}
