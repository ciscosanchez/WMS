"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { warehouseSchema, type WarehouseFormData } from "@/modules/warehouse/schemas";
import { createWarehouse } from "@/modules/warehouse/actions";
import {
  composeWarehouseAddress,
  DEFAULT_WAREHOUSE_ADDRESS,
  type WarehouseAddressFields,
} from "@/modules/warehouse/address";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function NewWarehousePage() {
  const t = useTranslations("tenant.warehouse");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [address, setAddress] = useState<WarehouseAddressFields>(DEFAULT_WAREHOUSE_ADDRESS);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema(tv)),
    defaultValues: { isActive: true },
  });

  async function onSubmit(data: WarehouseFormData) {
    try {
      await createWarehouse({
        ...data,
        address: composeWarehouseAddress(address),
      });
      toast.success("Warehouse created");
      router.push("/warehouse");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create warehouse");
    }
  }

  const fullAddress = useMemo(() => composeWarehouseAddress(address), [address]);
  const mapUrl = useMemo(() => {
    if (!fullAddress) return "";
    return `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`;
  }, [fullAddress]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("newWarehouse")} />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("warehouseDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t("code")} *</Label>
              <Input id="code" {...register("code")} placeholder="WH1" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")} *</Label>
              <Input id="name" {...register("name")} placeholder="Main Warehouse" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address1">{t("addressLine1")}</Label>
                <Input
                  id="address1"
                  value={address.address1}
                  onChange={(event) =>
                    setAddress((current) => ({ ...current, address1: event.target.value }))
                  }
                  placeholder="111 Test Address"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address2">{t("addressLine2")}</Label>
                <Input
                  id="address2"
                  value={address.address2}
                  onChange={(event) =>
                    setAddress((current) => ({ ...current, address2: event.target.value }))
                  }
                  placeholder="Suite 200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t("city")}</Label>
                <Input
                  id="city"
                  value={address.city}
                  onChange={(event) =>
                    setAddress((current) => ({ ...current, city: event.target.value }))
                  }
                  placeholder="Memphis"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">{t("stateProvince")}</Label>
                <Input
                  id="state"
                  value={address.state}
                  onChange={(event) =>
                    setAddress((current) => ({ ...current, state: event.target.value }))
                  }
                  placeholder="TN"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">{t("postalCode")}</Label>
                <Input
                  id="postalCode"
                  value={address.postalCode}
                  onChange={(event) =>
                    setAddress((current) => ({ ...current, postalCode: event.target.value }))
                  }
                  placeholder="38103"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t("country")}</Label>
                <Input
                  id="country"
                  value={address.country}
                  onChange={(event) =>
                    setAddress((current) => ({ ...current, country: event.target.value }))
                  }
                  placeholder="US"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("creating") : t("createWarehouse")}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("mapPreview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              {fullAddress ? (
                <p>{fullAddress}</p>
              ) : (
                <p className="text-muted-foreground">{t("mapPreviewEmpty")}</p>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border">
              {mapUrl ? (
                <iframe
                  title={t("mapPreview")}
                  src={mapUrl}
                  className="h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-72 items-center justify-center bg-muted/20 text-sm text-muted-foreground">
                  {t("mapPreviewEmpty")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
