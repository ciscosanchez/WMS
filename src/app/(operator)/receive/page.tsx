"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getShipments } from "@/modules/receiving/actions";
import { getShipmentByBarcode } from "@/modules/operator/actions";

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  carrier: string | null;
  client: { name: string };
  lines: Array<{ id: string; receivedQty: number; expectedQty: number }>;
  _count: { lines: number };
}

export default function OperatorReceivePage() {
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations("operator.receive");
  const tc = useTranslations("common");

  useEffect(() => {
    getShipments("arrived")
      .then((data) => setShipments(data as unknown as Shipment[]))
      .catch(() => toast.error(t("failedLoadShipments")))
      .finally(() => setLoading(false));
  }, [t]);

  async function handleScan(value: string) {
    const local = shipments.find(
      (s) => s.shipmentNumber === value || value.includes(s.shipmentNumber)
    );
    if (local) {
      router.push(`/receive/${local.id}`);
      return;
    }

    const found = await getShipmentByBarcode(value);
    if (found) {
      router.push(`/receive/${found.id}`);
    } else {
      toast.error(t("noShipmentFound", { value }));
    }
  }

  const completed = shipments.filter((s) => s.status === "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <BarcodeScannerInput placeholder={t("scanBolBarcode")} onScan={handleScan} showFeedback />

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t("arrivedReady")}</h2>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingShipments")}
          </div>
        )}

        {!loading && shipments.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noShipmentsReady")}</p>
        )}

        <div className="space-y-3">
          {shipments
            .filter((s) => s.status === "arrived" || s.status === "receiving")
            .map((s) => {
              const receivedLines = s.lines.filter((l) => l.receivedQty >= l.expectedQty).length;
              return (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold">{s.shipmentNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.client.name} &middot; {s.carrier ?? "—"}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={s.status} />
                        <span className="text-xs text-muted-foreground">
                          {receivedLines}/{s._count.lines} {t("linesReceived")}
                        </span>
                      </div>
                    </div>
                    <Button size="lg" onClick={() => router.push(`/receive/${s.id}`)}>
                      {receivedLines > 0 ? tc("continue") : tc("start")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </div>

      {completed.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t("completedToday")}</h2>
          <div className="space-y-3">
            {completed.slice(0, 5).map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{s.shipmentNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.client.name} &middot; {s.carrier ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-medium">{tc("done")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
