"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inboundShipmentSchema, type InboundShipmentFormData } from "@/modules/receiving/schemas";
import { createShipment } from "@/modules/receiving/actions";
import { getClients } from "@/modules/clients/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export default function NewShipmentPage() {
  const router = useRouter();
  const t = useTranslations("tenant.receiving");
  const tv = useTranslations("validation");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    getClients().then(setClients);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InboundShipmentFormData>({
    resolver: zodResolver(inboundShipmentSchema(tv)),
  });

  async function onSubmit(data: InboundShipmentFormData) {
    try {
      const shipment = await createShipment(data);
      toast.success(`Shipment created`);
      router.push(`/receiving/${shipment.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create shipment");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("newInboundTitle")} description={t("newInboundDesc")} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("shipmentDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("client")} *</Label>
              <select
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
              <Label>{t("carrier")}</Label>
              <Input {...register("carrier")} />
            </div>
            <div className="space-y-2">
              <Label>{t("trackingNumber")}</Label>
              <Input {...register("trackingNumber")} />
            </div>
            <div className="space-y-2">
              <Label>{t("bolNumber")}</Label>
              <Input {...register("bolNumber")} />
            </div>
            <div className="space-y-2">
              <Label>{t("poNumber")}</Label>
              <Input {...register("poNumber")} />
            </div>
            <div className="space-y-2">
              <Label>{t("expectedDate")}</Label>
              <Input type="date" {...register("expectedDate")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("notes")}</Label>
              <Textarea {...register("notes")} rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("creating") : t("createShipment")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
