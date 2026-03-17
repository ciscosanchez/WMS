"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getShipment, receiveLine, updateShipmentStatus } from "@/modules/receiving/actions";
import { getBinByBarcode } from "@/modules/operator/actions";

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

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [binBarcode, setBinBarcode] = useState("");
  const [binId, setBinId] = useState<string | null>(null);
  const [qty, setQty] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getShipment(id)
      .then((data) => {
        if (!data) {
          toast.error("Shipment not found");
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
      .catch(() => toast.error("Failed to load shipment"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleBinScan(barcode: string) {
    const bin = await getBinByBarcode(barcode);
    if (!bin) {
      toast.error(`Bin not found: ${barcode}`);
      return;
    }
    setBinBarcode(barcode);
    setBinId(bin.id);
    toast.success(`Bin: ${bin.barcode}`);
  }

  async function handleReceiveLine(line: ShipmentLine) {
    if (!qty || parseInt(qty) < 1) {
      toast.error("Enter a valid quantity");
      return;
    }

    setSubmitting(true);
    try {
      await receiveLine(shipment!.id, {
        lineId: line.id,
        binId: binId ?? undefined,
        quantity: parseInt(qty),
        condition: "good",
      });

      toast.success(`Received ${qty} × ${line.product.sku}`);

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
          toast.success("All lines received!");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to receive line");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      await updateShipmentStatus(id, "completed");
      toast.success("Shipment completed");
      router.push("/receive");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete shipment");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading shipment...
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
              <label className="text-xs font-medium text-muted-foreground">SCAN DESTINATION BIN</label>
              <div className="mt-1">
                <BarcodeScannerInput
                  placeholder="Scan bin barcode..."
                  onScan={handleBinScan}
                  showFeedback
                  value={binBarcode}
                />
              </div>
              {binBarcode && (
                <p className="mt-1 text-xs text-green-600">Bin: {binBarcode}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">QUANTITY RECEIVED</label>
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
              Confirm Receive
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Complete shipment */}
      {allDone && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4">
            <p className="font-semibold text-green-700">All lines received</p>
            <p className="mb-4 text-sm text-green-600">
              Ready to complete this shipment and update inventory.
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
              Complete Shipment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
