"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getRatesForShipment(shipmentId)
      .then((result) => setRates(result.rates))
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
        toast.success(`${rate.carrier} ${rate.service} selected`);
        router.refresh();
      }
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground animate-pulse">
          Shopping rates…
        </CardContent>
      </Card>
    );
  }

  if (rates.length === 0) {
    return null;
  }

  const cheapest = rates[0];
  const fastest = [...rates].sort((a, b) => a.estimatedDays - b.estimatedDays)[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rate Shopping</CardTitle>
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
                          Best price
                        </Badge>
                      )}
                      {isFastest && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          Fastest
                        </Badge>
                      )}
                      {rate.guaranteed && (
                        <Badge variant="outline" className="text-xs text-green-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Guaranteed
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {rate.estimatedDays === 1
                        ? "Next day"
                        : `${rate.estimatedDays} business days`}
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
                    {selectedCode === rate.serviceCode && isPending ? "Saving…" : "Select"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          * Rates are estimates. Live rates activate when carrier credentials are configured.
        </p>
      </CardContent>
    </Card>
  );
}
