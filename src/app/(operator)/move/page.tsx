"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { ArrowRight, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { getBinByBarcode } from "@/modules/operator/actions";
import { moveInventory } from "@/modules/inventory/actions";
import { registerOfflineActions, actionKey } from "@/hooks/use-offline";
import { useSharedOffline } from "@/providers/offline-provider";

type Bin = NonNullable<Awaited<ReturnType<typeof getBinByBarcode>>>;
type InventoryItem = Bin["inventory"][number];

// Register mutations for offline replay
registerOfflineActions("inventory", {
  moveInventory: moveInventory as (...args: unknown[]) => Promise<unknown>,
});

export default function OperatorMovePage() {
  const [fromBin, setFromBin] = useState<Bin | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [toBin, setToBin] = useState<Bin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { executeAction } = useSharedOffline();

  function reset() {
    setFromBin(null);
    setSelectedItem(null);
    setQuantity("1");
    setToBin(null);
  }

  async function handleFromBinScan(barcode: string) {
    const bin = await getBinByBarcode(barcode);
    if (!bin) {
      toast.error(`Bin not found: ${barcode}`);
      return;
    }
    if (bin.inventory.length === 0) {
      toast.error("That bin has no inventory");
      return;
    }
    setFromBin(bin);
    setSelectedItem(null);
    setToBin(null);
    toast.success(`Source: ${bin.barcode}`);
  }

  async function handleProductScan(barcode: string) {
    if (!fromBin) return;
    const item = fromBin.inventory.find(
      (i) => i.product.sku === barcode || i.product.barcode === barcode
    );
    if (!item) {
      toast.error(`Product not in bin: ${barcode}`);
      return;
    }
    setSelectedItem(item);
    toast.success(`Product: ${item.product.sku}`);
  }

  async function handleToBinScan(barcode: string) {
    if (fromBin && barcode === fromBin.barcode) {
      toast.error("Source and destination bins must differ");
      return;
    }
    const bin = await getBinByBarcode(barcode);
    if (!bin) {
      toast.error(`Bin not found: ${barcode}`);
      return;
    }
    setToBin(bin);
    toast.success(`Destination: ${bin.barcode}`);
  }

  async function handleConfirmMove() {
    if (!fromBin || !selectedItem || !toBin || !quantity) return;

    const qty = parseInt(quantity);
    if (qty < 1) { toast.error("Invalid quantity"); return; }
    if (qty > selectedItem.available) {
      toast.error(`Only ${selectedItem.available} available`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: selectedItem.productId,
        fromBinId: fromBin.id,
        toBinId: toBin.id,
        quantity: qty,
        lotNumber: selectedItem.lotNumber,
        serialNumber: selectedItem.serialNumber,
      };

      const { queued } = await executeAction(
        actionKey("inventory", "moveInventory"),
        moveInventory as (...args: unknown[]) => Promise<unknown>,
        [payload]
      );

      if (queued) {
        toast.info("Move queued — will complete when online");
      } else {
        toast.success("Move complete");
      }
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm = !!fromBin && !!selectedItem && !!toBin && parseInt(quantity) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Move Inventory</h1>
        <p className="text-sm text-muted-foreground">Transfer stock between bins</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          {/* Step 1: Source bin */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">1. SCAN SOURCE BIN</label>
            <div className="mt-1">
              <BarcodeScannerInput
                placeholder="Scan source bin..."
                onScan={handleFromBinScan}
                showFeedback
              />
            </div>
            {fromBin && (
              <p className="mt-1 text-xs text-green-600">
                {fromBin.barcode} — {fromBin.inventory.length} SKU(s)
              </p>
            )}
          </div>

          {/* Step 2: Product */}
          {fromBin && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                2. SCAN PRODUCT (or tap below)
              </label>
              <div className="mt-1">
                <BarcodeScannerInput
                  placeholder="Scan product barcode or SKU..."
                  onScan={handleProductScan}
                  showFeedback
                />
              </div>
              {/* Tap to select from list */}
              <div className="mt-2 space-y-1">
                {fromBin.inventory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`w-full rounded border p-2 text-left text-sm transition-colors ${
                      selectedItem?.id === item.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <span className="font-mono font-medium">{item.product.sku}</span>
                    <span className="ml-2 text-muted-foreground">{item.product.name}</span>
                    <span className="float-right text-muted-foreground">
                      {item.available} avail
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Quantity */}
          {selectedItem && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                3. QUANTITY (max {selectedItem.available})
              </label>
              <Input
                type="number"
                min={1}
                max={selectedItem.available}
                className="mt-1 h-12 text-lg"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          )}

          {/* Arrow divider */}
          {selectedItem && (
            <div className="flex items-center justify-center py-1">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          {/* Step 4: Destination bin */}
          {selectedItem && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                4. SCAN DESTINATION BIN
              </label>
              <div className="mt-1">
                <BarcodeScannerInput
                  placeholder="Scan destination bin..."
                  onScan={handleToBinScan}
                  showFeedback
                />
              </div>
              {toBin && (
                <p className="mt-1 text-xs text-green-600">Destination: {toBin.barcode}</p>
              )}
            </div>
          )}

          {/* Summary */}
          {canConfirm && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>
                  Move <strong>{quantity}</strong> × <strong>{selectedItem!.product.sku}</strong>
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {fromBin!.barcode} → {toBin!.barcode}
              </p>
            </div>
          )}

          <Button
            className="h-12 w-full"
            size="lg"
            disabled={!canConfirm || submitting}
            onClick={handleConfirmMove}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : null}
            Confirm Move
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
