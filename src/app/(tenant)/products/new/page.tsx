"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductFormData } from "@/modules/products/schemas";
import { createProduct } from "@/modules/products/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useEffect, useState } from "react";
export default function NewProductPage() {
  const router = useRouter();
  const [clients, setClients] = useState<{ id: string; code: string; name: string }[]>([]);

  useEffect(() => {
    setClients([
      { id: "1", code: "ACME", name: "Acme Corporation" },
      { id: "2", code: "GLOBEX", name: "Globex Industries" },
      { id: "3", code: "INITECH", name: "Initech Logistics" },
    ]);
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      baseUom: "EA",
      weightUnit: "lb",
      dimUnit: "in",
      isActive: true,
      trackLot: false,
      trackSerial: false,
    },
  });

  async function onSubmit(data: ProductFormData) {
    try {
      await createProduct(data);
      toast.success("Product created");
      router.push("/products");
    } catch (e: any) {
      toast.error(e.message || "Failed to create product");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Product" description="Add a new SKU" />

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
            {isSubmitting ? "Creating..." : "Create Product"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
