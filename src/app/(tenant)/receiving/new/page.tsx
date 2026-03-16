"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inboundShipmentSchema, type InboundShipmentFormData } from "@/modules/receiving/schemas";
import { createShipment } from "@/modules/receiving/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export default function NewShipmentPage() {
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
    formState: { errors, isSubmitting },
  } = useForm<InboundShipmentFormData>({
    resolver: zodResolver(inboundShipmentSchema),
  });

  async function onSubmit(data: InboundShipmentFormData) {
    try {
      const shipment = await createShipment(data);
      toast.success(`Shipment created`);
      router.push(`/receiving/${shipment.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create shipment");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Inbound Shipment" description="Create an ASN" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Shipment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Client *</Label>
              <select
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
              <Label>Carrier</Label>
              <Input {...register("carrier")} />
            </div>
            <div className="space-y-2">
              <Label>Tracking Number</Label>
              <Input {...register("trackingNumber")} />
            </div>
            <div className="space-y-2">
              <Label>BOL Number</Label>
              <Input {...register("bolNumber")} />
            </div>
            <div className="space-y-2">
              <Label>PO Number</Label>
              <Input {...register("poNumber")} />
            </div>
            <div className="space-y-2">
              <Label>Expected Date</Label>
              <Input type="date" {...register("expectedDate")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea {...register("notes")} rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Shipment"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
