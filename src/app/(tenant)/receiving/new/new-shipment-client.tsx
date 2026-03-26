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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type ClientOption = { id: string; code: string; name: string };
type AttributeDefinition = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  dataType: "text" | "number" | "currency" | "date" | "boolean" | "single_select" | "multi_select" | "json";
  isRequired: boolean;
  options: Array<{ value: string; label: string; sortOrder: number; isActive: boolean }>;
};

export function NewShipmentClient({
  clients,
  attributeDefinitions,
}: {
  clients: ClientOption[];
  attributeDefinitions: AttributeDefinition[];
}) {
  const router = useRouter();
  const t = useTranslations("tenant.receiving");
  const tv = useTranslations("validation");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<InboundShipmentFormData>({
    resolver: zodResolver(inboundShipmentSchema(tv)),
    defaultValues: {
      operationalAttributes: attributeDefinitions.map((definition) => ({
        definitionId: definition.id,
        value: definition.dataType === "boolean" ? false : "",
      })),
    },
  });

  const watchedAttributes = watch("operationalAttributes") ?? [];

  async function onSubmit(data: InboundShipmentFormData) {
    try {
      const shipment = await createShipment(data);
      toast.success("Shipment created");
      router.push(`/receiving/${shipment.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create shipment");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("newInboundTitle")} description={t("newInboundDesc")} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
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

        {attributeDefinitions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Operational Attributes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {attributeDefinitions.map((definition, index) => {
                const fieldName = `operationalAttributes.${index}.value` as const;
                const currentValue = watchedAttributes[index]?.value;

                return (
                  <div key={definition.id} className="space-y-2">
                    <Label>
                      {definition.label}
                      {definition.isRequired ? " *" : ""}
                    </Label>
                    {definition.description && (
                      <p className="text-xs text-muted-foreground">{definition.description}</p>
                    )}

                    <input
                      type="hidden"
                      {...register(`operationalAttributes.${index}.definitionId` as const)}
                      value={definition.id}
                    />

                    {definition.dataType === "boolean" ? (
                      <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <Checkbox
                          checked={Boolean(currentValue)}
                          onCheckedChange={(checked) => setValue(fieldName, Boolean(checked))}
                        />
                        <span>Enabled</span>
                      </label>
                    ) : definition.dataType === "single_select" ? (
                      <select
                        {...register(fieldName)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      >
                        <option value="">Select value</option>
                        {definition.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : definition.dataType === "date" ? (
                      <Input type="date" {...register(fieldName)} />
                    ) : definition.dataType === "number" || definition.dataType === "currency" ? (
                      <Input type="number" step="0.01" {...register(fieldName)} />
                    ) : definition.dataType === "json" ? (
                      <Textarea
                        {...register(fieldName)}
                        rows={3}
                        placeholder='{"key":"value"}'
                      />
                    ) : definition.dataType === "multi_select" ? (
                      <Textarea
                        value={Array.isArray(currentValue) ? currentValue.join(", ") : String(currentValue ?? "")}
                        onChange={(e) =>
                          setValue(
                            fieldName,
                            e.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean)
                          )
                        }
                        rows={3}
                        placeholder="Comma-separated values"
                      />
                    ) : (
                      <Input {...register(fieldName)} />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

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
