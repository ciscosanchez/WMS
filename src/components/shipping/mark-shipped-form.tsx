"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markShipmentShipped } from "@/modules/shipping/ship-actions";
import { toast } from "sonner";
import { Truck } from "lucide-react";

const CARRIERS = ["UPS", "FedEx", "USPS", "DHL", "OnTrac", "LSO", "Other"];

interface MarkShippedFormProps {
  shipmentId: string;
  currentCarrier?: string | null;
}

export function MarkShippedForm({ shipmentId, currentCarrier }: MarkShippedFormProps) {
  const t = useTranslations("tenant.shipping");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState(currentCarrier ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!carrier.trim()) {
      toast.error(t("carrierRequired"));
      return;
    }
    if (!trackingNumber.trim()) {
      toast.error(t("trackingRequired"));
      return;
    }
    startTransition(async () => {
      const result = await markShipmentShipped(shipmentId, trackingNumber.trim(), carrier.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("shipmentMarkedShipped"));
        router.refresh();
      }
    });
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4" />
          {t("markShipped")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="carrier">{t("carrier")}</Label>
            <select
              id="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">{t("selectCarrier")}</option>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-48">
            <Label htmlFor="tracking">
              {t("trackingNumber")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tracking"
              placeholder={t("trackingPlaceholder")}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("saving") : t("markShipped")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
