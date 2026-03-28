"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { Truck, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getShipmentsReadyForRelease, releaseShipment } from "@/modules/shipping/release-actions";

type ReleaseShipment = Awaited<ReturnType<typeof getShipmentsReadyForRelease>>[number];

function qtyLabel(item: ReleaseShipment["items"][number]) {
  const upc = item.product.unitsPerCase;
  if (upc && upc > 1) {
    return `${item.quantity} ${item.product.baseUom ?? "EA"} = ${item.quantity * upc} units`;
  }
  return `${item.quantity} ${item.product.baseUom ?? "EA"}`;
}

export default function OperatorReleasePage() {
  const t = useTranslations("operator.release");
  const [queue, setQueue] = useState<ReleaseShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ReleaseShipment | null>(null);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    const data = await getShipmentsReadyForRelease();
    setQueue(data as ReleaseShipment[]);
  }

  useEffect(() => {
    reload()
      .catch(() => toast.error(t("failedLoadQueue")))
      .finally(() => setLoading(false));
  }, [t]);

  function handleOrderScan(value: string) {
    const ship = queue.find(
      (s) =>
        s.shipmentNumber === value || s.order?.orderNumber === value || s.trackingNumber === value
    );
    if (!ship) {
      toast.error(t("noShipmentFound", { value }));
      return;
    }
    setActive(ship);
    setVerified(new Set());
    toast.success(t("shipmentSelected", { number: ship.shipmentNumber }));
  }

  function handleItemScan(value: string) {
    if (!active) return;
    const item = active.items.find(
      (i) =>
        i.product.sku === value || i.product.barcode === value || i.product.caseBarcode === value
    );
    if (!item) {
      toast.error(t("itemNotInShipment", { value }));
      return;
    }
    setVerified((prev) => new Set([...prev, item.id]));
    toast.success(t("itemVerified", { sku: item.product.sku }));
  }

  async function handleRelease() {
    if (!active) return;
    setSubmitting(true);
    try {
      const result = await releaseShipment(
        active.id,
        active.trackingNumber ?? "",
        active.carrier ?? ""
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("releaseSuccess", { number: active.shipmentNumber }));
      await reload();
      setActive(null);
      setVerified(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("releaseFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const allVerified = active ? active.items.every((i) => verified.has(i.id)) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <BarcodeScannerInput
        placeholder={t("scanOrderBarcode")}
        onScan={handleOrderScan}
        showFeedback
      />

      {active && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">
                  {active.order?.orderNumber ?? active.shipmentNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  {active.carrier} · {active.trackingNumber}
                </p>
              </div>
              {active.order?.priority && (
                <Badge className="bg-blue-100 text-blue-700">{active.order.priority}</Badge>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("scanEachItem")}</p>
              <BarcodeScannerInput
                placeholder={t("scanItemBarcode")}
                onScan={handleItemScan}
                showFeedback
              />
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-right">{t("qty")}</TableHead>
                    <TableHead className="text-center">{t("verified")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-mono font-medium">{item.product.sku}</p>
                        <p className="text-xs text-muted-foreground">{item.product.name}</p>
                      </TableCell>
                      <TableCell className="text-right font-bold">{qtyLabel(item)}</TableCell>
                      <TableCell className="text-center">
                        {verified.has(item.id) ? (
                          <Check className="mx-auto h-5 w-5 text-green-600" />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVerified((p) => new Set([...p, item.id]))}
                          >
                            {t("tap")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              className="h-14 w-full"
              size="lg"
              disabled={!allVerified || submitting}
              onClick={handleRelease}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Truck className="mr-2 h-5 w-5" />
              )}
              {t("releaseToCarrier")}
            </Button>
          </CardContent>
        </Card>
      )}

      {!active && queue.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t("awaitingRelease", { count: queue.length })}
          </h2>
          <div className="space-y-3">
            {queue.map((ship) => (
              <Card
                key={ship.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => {
                  setActive(ship);
                  setVerified(new Set());
                }}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">
                      {ship.order?.orderNumber ?? ship.shipmentNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {ship.carrier} · {ship.items.length} line(s)
                    </p>
                  </div>
                  <Truck className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      )}

      {!loading && !active && queue.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noShipments")}</p>
      )}
    </div>
  );
}
