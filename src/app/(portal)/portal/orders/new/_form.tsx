"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createPortalOrder } from "@/modules/portal/actions";

interface Product {
  id: string;
  sku: string;
  name: string;
  baseUom: string;
}

type LineItem = {
  productId: string;
  quantity: number;
};

type OrderForm = {
  shipToName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  shippingMethod: string;
  lineItems: LineItem[];
};

export function NewOrderForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderForm>({
    defaultValues: {
      shipToName: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      shippingMethod: "",
      lineItems: [{ productId: "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });

  function onSubmit(data: OrderForm) {
    const validLines = data.lineItems.filter((li) => li.productId && li.quantity > 0);
    if (validLines.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    startTransition(async () => {
      const result = await createPortalOrder({ ...data, lineItems: validLines });
      if (result.error) {
        toast.error(result.error);
      } else {
        setCreatedOrderNumber(result.orderNumber ?? "");
      }
    });
  }

  if (createdOrderNumber !== null) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="text-lg font-semibold">Order {createdOrderNumber} placed!</p>
          <p className="text-sm text-muted-foreground">
            Your order has been submitted and will be processed shortly.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/portal/orders">View My Orders</Link>
            </Button>
            <Button variant="outline" onClick={() => router.refresh()}>
              Place Another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle>Shipping Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="shipToName">Ship-To Name *</Label>
            <Input
              id="shipToName"
              placeholder="Recipient name or company"
              {...register("shipToName", { required: "Required" })}
            />
            {errors.shipToName && (
              <p className="text-xs text-destructive">{errors.shipToName.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              placeholder="Street address"
              {...register("address", { required: "Required" })}
            />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="city">City *</Label>
              <Input id="city" {...register("city", { required: "Required" })} />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                placeholder="TX"
                maxLength={2}
                {...register("state", { required: "Required" })}
              />
              {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zip">ZIP *</Label>
              <Input id="zip" {...register("zip", { required: "Required" })} />
              {errors.zip && <p className="text-xs text-destructive">{errors.zip.message}</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Shipping Method</Label>
            <Controller
              control={control}
              name="shippingMethod"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select shipping method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ground">Ground (5–7 business days)</SelectItem>
                    <SelectItem value="express">Express (2–3 business days)</SelectItem>
                    <SelectItem value="overnight">Overnight (next business day)</SelectItem>
                    <SelectItem value="freight">LTL Freight</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Products</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ productId: "", quantity: 1 })}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products in your catalog yet. Contact your warehouse.
            </p>
          ) : (
            fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-4">
                <div className="flex-1 grid gap-2">
                  <Label>Product</Label>
                  <Controller
                    control={control}
                    name={`lineItems.${index}.productId`}
                    render={({ field: f }) => (
                      <Select onValueChange={f.onChange} value={f.value}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.sku} — {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="w-28 grid gap-2">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register(`lineItems.${index}.quantity`, {
                      required: true,
                      valueAsNumber: true,
                      min: 1,
                    })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => fields.length > 1 && remove(index)}
                  disabled={fields.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" asChild>
          <Link href="/portal/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button type="submit" size="lg" disabled={isPending || products.length === 0}>
          {isPending ? "Placing Order..." : "Place Order"}
        </Button>
      </div>
    </form>
  );
}
