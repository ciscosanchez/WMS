"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getShipment, receiveLine, updateShipmentStatus } from "@/modules/receiving/actions";
import { getBinByBarcode } from "@/modules/operator/actions";
import { actionKey } from "@/hooks/use-offline";
import { useSharedOffline } from "@/providers/offline-provider";

interface ShipmentLine {
  id: string;
  product: { sku: string; name: string; barcode: string | null };
  expectedQty: number;
  receivedQty: number;
}

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  carrier: string | null;
  client: { name: string };
  lines: ShipmentLine[];
}

export default function ReceiveShipmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const t = useTranslations("operator.receive");

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [binBarcode, setBinBarcode] = useState("");
  const [binId, setBinId] = useState<string | null>(null);
  const [qty, setQty] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const { executeAction } = useSharedOffline();

  useEffect(() => {
    getShipment(id)
      .then((data) => {
        if (!data) {
          toast.error(t("shipmentNotFound"));
          router.push("/receive");
          return;
        }
        const shipmentData = data as unknown as Shipment;
        setShipment(shipmentData);
        // start at the first incomplete line
        const firstIncomplete = shipmentData.lines.findIndex(
          (l) => l.receivedQty < l.expectedQty
        );
        setActiveLineIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
      })
      .catch(() => toast.error(t("failedLoadShipment")))
      .finally(() => setLoading(false));
  }, [id, router, t]);

  async function handleBinScan(barcode: string) {
    const bin = await getBinByBarcode(barcode);
    if (!bin) {
      toast.error(t("binNotFound", { barcode }));
      return;
    }
    setBinBarcode(barcode);
    setBinId(bin.id);
    toast.success(t("binLabel", { binBarcode: bin.barcode }));
  }

  async function handleReceiveLine(line: ShipmentLine) {
    if (!qty || parseInt(qty) < 1) {
      toast.error(t("enterValidQty"));
      return;
    }

    setSubmitting(true);
    try {
      const { queued } = await executeAction(
        actionKey("receiving", "receiveLine"),
        receiveLine as (...args: unknown[]) => Promise<unknown>,
        [shipment!.id, {
          lineId: line.id,
          binId: binId ?? undefined,
          quantity: parseInt(qty),
          condition: "good",
        }]
      );

      if (queued) {
        toast.info(t("receiveQueued", { qty, sku: line.product.sku }));
      } else {
        toast.success(t("received", { qty, sku: line.product.sku }));
      }

      // Refresh shipment
      const updated = await getShipment(id);
      if (updated) {
        const updatedData = updated as unknown as Shipment;
        setShipment(updatedData);
        // advance to next incomplete line
        const next = updatedData.lines.findIndex((l) => l.receivedQty < l.expectedQty);
        if (next >= 0) {
          setActiveLineIdx(next);
          setBinBarcode("");
          setBinId(null);
          setQty("1");
        } else {
          toast.success(t("allLinesReceived") + "!");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedReceiveLine"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      const { queued } = await executeAction(
        actionKey("receiving", "updateShipmentStatus"),
        updateShipmentStatus as (...args: unknown[]) => Promise<unknown>,
        [id, "completed"]
      );

      if (queued) {
        toast.info(t("completionQueued"));
      } else {
        toast.success(t("shipmentCompleted"));
      }
      router.push("/receive");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedCompleteShipment"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("loadingShipment")}
      </div>
    );
  }

  if (!shipment) return null;

  const activeLine = shipment.lines[activeLineIdx];
  const allDone = shipment.lines.every((l) => l.receivedQty >= l.expectedQty);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/receive")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{shipment.shipmentNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {shipment.client.name} &middot; {shipment.carrier ?? "—"}
          </p>
        </div>
      </div>

      {/* Line progress overview */}
      <div className="grid grid-cols-3 gap-2">
        {shipment.lines.map((line, idx) => (
          <button
            key={line.id}
            onClick={() => setActiveLineIdx(idx)}
            className={`rounded-lg border p-2 text-left text-xs transition-colors ${
              idx === activeLineIdx
                ? "border-primary bg-primary/5"
                : line.receivedQty >= line.expectedQty
                ? "border-green-200 bg-green-50"
                : "border-border"
            }`}
          >
            <p className="truncate font-mono font-medium">{line.product.sku}</p>
            <p className="text-muted-foreground">
              {line.receivedQty}/{line.expectedQty}
            </p>
          </button>
        ))}
      </div>

      {/* Active line receiving */}
      {activeLine && !allDone && (
        <Card className="border-primary">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-lg font-bold">{activeLine.product.sku}</p>
                <p className="text-sm text-muted-foreground">{activeLine.product.name}</p>
              </div>
              <Badge variant="outline">
                {activeLine.receivedQty}/{activeLine.expectedQty} EA
              </Badge>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("scanDestBin")}</label>
              <div className="mt-1">
                <BarcodeScannerInput
                  placeholder={t("scanBinBarcode")}
                  onScan={handleBinScan}
                  showFeedback
                  value={binBarcode}
                />
              </div>
              {binBarcode && (
                <p className="mt-1 text-xs text-green-600">{t("binLabel", { binBarcode })}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("quantityReceived")}</label>
              <Input
                type="number"
                min={1}
                max={activeLine.expectedQty - activeLine.receivedQty}
                className="mt-1 h-12 text-center text-2xl font-bold"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>

            <Button
              className="h-12 w-full"
              size="lg"
              disabled={submitting || !qty || parseInt(qty) < 1}
              onClick={() => handleReceiveLine(activeLine)}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Check className="mr-2 h-5 w-5" />
              )}
              {t("confirmReceive")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Complete shipment */}
      {allDone && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4">
            <p className="font-semibold text-green-700">{t("allLinesReceived")}</p>
            <p className="mb-4 text-sm text-green-600">
              {t("allLinesReceivedReady")}
            </p>
            <Button
              className="h-12 w-full"
              size="lg"
              onClick={handleComplete}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Check className="mr-2 h-5 w-5" />
              )}
              {t("completeShipment")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
