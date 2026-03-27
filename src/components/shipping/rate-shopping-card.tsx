"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRatesForShipment, selectShipmentRate } from "@/modules/shipping/actions";
import { toast } from "sonner";
import { Zap, Clock, CheckCircle2 } from "lucide-react";

interface Rate {
  carrier: string;
  service: string;
  serviceCode: string;
  totalCost: number;
  currency: string;
  estimatedDays: number;
  guaranteed: boolean;
}

export function RateShoppingCard({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations("tenant.shipping");
  const router = useRouter();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getRatesForShipment(shipmentId)
      .then((result) => {
        setRates(result.rates);
        setError(result.error ?? null);
      })
      .finally(() => setLoading(false));
  }, [shipmentId]);

  function handleSelect(rate: Rate) {
    setSelectedCode(rate.serviceCode);
    startTransition(async () => {
      const result = await selectShipmentRate(
        shipmentId,
        rate.carrier,
        rate.service,
        rate.totalCost
      );
      if (result.error) {
        toast.error(result.error);
        setSelectedCode(null);
      } else {
        toast.success(t("rateSelected", { carrier: rate.carrier, service: rate.service }));
        router.refresh();
      }
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground animate-pulse">
          {t("shoppingRates")}
        </CardContent>
      </Card>
    );
  }

  if (rates.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("rateShopping")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error ?? t("noRatesAvailable")}</p>
        </CardContent>
      </Card>
    );
  }

  const cheapest = rates[0];
  const fastest = [...rates].sort((a, b) => a.estimatedDays - b.estimatedDays)[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("rateShopping")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rates.map((rate) => {
            const isCheapest = rate.serviceCode === cheapest.serviceCode;
            const isFastest =
              rate.serviceCode === fastest.serviceCode &&
              fastest.estimatedDays < cheapest.estimatedDays;

            return (
              <div
                key={`${rate.carrier}-${rate.serviceCode}`}
                className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {rate.carrier} — {rate.service}
                      {isCheapest && (
                        <Badge variant="secondary" className="text-xs">
                          <Zap className="mr-1 h-3 w-3" />
                          {t("bestPrice")}
                        </Badge>
                      )}
                      {isFastest && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          {t("fastest")}
                        </Badge>
                      )}
                      {rate.guaranteed && (
                        <Badge variant="outline" className="text-xs text-green-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {t("guaranteed")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {rate.estimatedDays === 1
                        ? t("nextDay")
                        : t("businessDays", { count: rate.estimatedDays })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">${rate.totalCost.toFixed(2)}</span>
                  <Button
                    size="sm"
                    variant={selectedCode === rate.serviceCode ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() => handleSelect(rate)}
                  >
                    {selectedCode === rate.serviceCode && isPending ? t("saving") : t("select")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("ratesEstimateNote")}</p>
      </CardContent>
    </Card>
  );
}
