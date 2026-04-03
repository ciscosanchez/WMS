"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { MapPin } from "lucide-react";

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

  // Debounce the address for the map embed so it doesn't reload on every keystroke
  const [debouncedAddress, setDebouncedAddress] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedAddress(fullAddress);
    }, 800);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [fullAddress]);

  const mapEmbedUrl = useMemo(() => {
    if (!debouncedAddress) return "";
    return `https://www.google.com/maps?q=${encodeURIComponent(debouncedAddress)}&output=embed&z=15`;
  }, [debouncedAddress]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("newWarehouse")} />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_480px]"
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
              <Button type="button" variant="outline" onClick={() => router.push("/warehouse")}>
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="sticky top-6 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("mapPreview")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fullAddress && (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <p>{fullAddress}</p>
              </div>
            )}
            <div className="overflow-hidden rounded-lg border">
              {mapEmbedUrl ? (
                <iframe
                  key={debouncedAddress}
                  src={mapEmbedUrl}
                  className="h-80 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Warehouse location preview"
                />
              ) : (
                <div className="flex h-80 flex-col items-center justify-center gap-2 bg-muted/20 text-sm text-muted-foreground">
                  <MapPin className="h-8 w-8 opacity-40" />
                  <p>Start typing an address to see a live map preview</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
