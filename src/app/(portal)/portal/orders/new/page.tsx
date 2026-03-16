"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
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
import { Plus, Trash2, ArrowLeft } from "lucide-react";

const availableProducts = [
  { sku: "WIDGET-001", name: "Standard Widget" },
  { sku: "GADGET-001", name: "Premium Gadget" },
  { sku: "BOLT-M8X40", name: "M8x40 Hex Bolt" },
  { sku: "VALVE-BV2", name: '2" Ball Valve' },
  { sku: "PIPE-SCH40", name: 'Schedule 40 Steel Pipe 2"' },
];

type LineItem = {
  product: string;
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

export default function NewOrderPage() {
  const [submitted, setSubmitted] = useState(false);

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
      lineItems: [{ product: "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const onSubmit = (data: OrderForm) => {
    // Mock submission
    console.log("Order submitted:", data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order Placed" description="Your order has been submitted successfully" />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <p className="text-lg font-medium text-green-600">Order submitted successfully!</p>
            <p className="text-muted-foreground">You will receive a confirmation email shortly.</p>
            <Button asChild variant="outline">
              <Link href="/portal/orders">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Orders
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Place Order" description="Create a new fulfillment order">
        <Button variant="outline" asChild>
          <Link href="/portal/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="shipToName">Ship-To Name</Label>
              <Input
                id="shipToName"
                placeholder="Recipient name or company"
                {...register("shipToName", { required: "Ship-to name is required" })}
              />
              {errors.shipToName && (
                <p className="text-xs text-red-500">{errors.shipToName.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Street address"
                {...register("address", { required: "Address is required" })}
              />
              {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  {...register("city", { required: "City is required" })}
                />
                {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="State"
                  {...register("state", { required: "State is required" })}
                />
                {errors.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  placeholder="ZIP"
                  {...register("zip", { required: "ZIP is required" })}
                />
                {errors.zip && <p className="text-xs text-red-500">{errors.zip.message}</p>}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Shipping Method</Label>
              <Select
                onValueChange={(val) => {
                  // react-hook-form integration via controlled field
                  const event = { target: { name: "shippingMethod", value: val } };
                  register("shippingMethod").onChange(event);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select shipping method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ground">Ground (5-7 business days)</SelectItem>
                  <SelectItem value="express">Express (2-3 business days)</SelectItem>
                  <SelectItem value="overnight">Overnight (next business day)</SelectItem>
                  <SelectItem value="freight">LTL Freight</SelectItem>
                </SelectContent>
              </Select>
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
              onClick={() => append({ product: "", quantity: 1 })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-4">
                <div className="grid flex-1 gap-2">
                  <Label>Product</Label>
                  <Select
                    onValueChange={(val) => {
                      const event = {
                        target: { name: `lineItems.${index}.product`, value: val },
                      };
                      register(`lineItems.${index}.product`).onChange(event);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((p) => (
                        <SelectItem key={p.sku} value={p.sku}>
                          {p.sku} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid w-28 gap-2">
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
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Place Order
          </Button>
        </div>
      </form>
    </div>
  );
}
