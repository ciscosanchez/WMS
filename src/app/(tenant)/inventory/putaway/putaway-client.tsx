"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowDownToLine, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { confirmPutaway } from "@/modules/inventory/actions";

interface PendingItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  clientCode: string;
  quantity: number;
  receivedAt: Date;
  shipmentNumber: string;
  currentBinId: string | null;
  currentBinBarcode: string | null;
  suggestions: { binId: string; barcode: string; reason: string }[];
}

interface BinOption {
  id: string;
  barcode: string;
}

interface Props {
  initialPending: PendingItem[];
  bins: BinOption[];
}

export function PutawayClient({ initialPending, bins }: Props) {
  const [pending, setPending] = useState<PendingItem[]>(initialPending);
  const [completed, setCompleted] = useState<
    {
      id: string;
      productSku: string;
      productName: string;
      quantity: number;
      binBarcode: string;
    }[]
  >([]);
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  function openDialog(item: PendingItem) {
    setDialogOpen(item.id);
    setSelectedBin(item.suggestions[0]?.binId ?? "");
    setManualMode(false);
    setConfirming(false);
  }

  async function executePutaway(item: PendingItem) {
    const bin = bins.find((b) => b.id === selectedBin);
    if (!bin) {
      toast.error("Please select a bin");
      return;
    }

    setConfirming(true);
    try {
      await confirmPutaway(item.id, selectedBin);
      setPending((prev) => prev.filter((p) => p.id !== item.id));
      setCompleted((prev) => [
        {
          id: item.id,
          productSku: item.productSku,
          productName: item.productName,
          quantity: item.quantity,
          binBarcode: bin.barcode,
        },
        ...prev,
      ]);
      setDialogOpen(null);
      toast.success(`${item.productSku} put away to ${bin.barcode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Putaway failed");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Putaway" description="Assign received items to storage locations">
        <Badge variant="secondary">{pending.length} pending</Badge>
      </PageHeader>

      {/* Empty state */}
      {pending.length === 0 && completed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ArrowDownToLine className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No items pending putaway</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Items will appear here after receiving shipments.
          </p>
        </div>
      )}

      {/* Pending items */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Pending Putaway</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pending.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{item.productSku}</span>
                    <Badge variant="outline">{item.clientCode}</Badge>
                  </CardTitle>
                  <CardDescription>{item.productName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium">{item.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Received</span>
                    <span>{new Date(item.receivedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipment</span>
                    <span>{item.shipmentNumber}</span>
                  </div>
                  {item.currentBinBarcode && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <MapPin className="h-3 w-3" />
                      <span>
                        Currently at: <span className="font-mono">{item.currentBinBarcode}</span>
                      </span>
                    </div>
                  )}
                  {item.suggestions.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Suggested locations
                      </span>
                      {item.suggestions.slice(0, 2).map((s) => (
                        <div
                          key={s.binId}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          <MapPin className="h-3 w-3" />
                          <span className="font-mono">{s.barcode}</span>
                          <span className="ml-auto truncate">{s.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Dialog
                    open={dialogOpen === item.id}
                    onOpenChange={(open) => {
                      if (open) openDialog(item);
                      else setDialogOpen(null);
                    }}
                  >
                    <DialogTrigger render={<Button className="w-full" />}>
                      <ArrowDownToLine className="h-4 w-4" />
                      Putaway
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          Putaway {item.productSku} ({item.quantity} units)
                        </DialogTitle>
                        <DialogDescription>{item.productName}</DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        {!manualMode && item.suggestions.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Suggested bins</label>
                            {item.suggestions.map((s) => (
                              <button
                                key={s.binId}
                                type="button"
                                onClick={() => setSelectedBin(s.binId)}
                                className={`flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition-colors ${
                                  selectedBin === s.binId
                                    ? "border-primary bg-primary/5"
                                    : "hover:bg-muted/50"
                                }`}
                              >
                                <div>
                                  <span className="font-mono font-medium">{s.barcode}</span>
                                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                                </div>
                                {selectedBin === s.binId && (
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {(manualMode || item.suggestions.length === 0) && (
                          <div className="space-y-2">
                            <label htmlFor="putaway-bin" className="text-sm font-medium">
                              Select bin manually
                            </label>
                            <select
                              id="putaway-bin"
                              value={selectedBin}
                              onChange={(e) => setSelectedBin(e.target.value)}
                              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="">Select a bin...</option>
                              {bins.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.barcode}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {item.suggestions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setManualMode(!manualMode);
                              if (!manualMode) setSelectedBin("");
                              else setSelectedBin(item.suggestions[0]?.binId ?? "");
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                            {manualMode ? "Use suggested bins" : "Select bin manually"}
                          </button>
                        )}
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(null)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => executePutaway(item)}
                          disabled={!selectedBin || confirming}
                        >
                          {confirming ? "Confirming..." : "Confirm Putaway"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Completed</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completed.map((item) => (
              <Card key={item.id} className="opacity-75">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{item.productSku}</span>
                    <Badge variant="secondary">
                      <CheckCircle2 className="h-3 w-3" />
                      Done
                    </Badge>
                  </CardTitle>
                  <CardDescription>{item.productName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium">{item.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stored in</span>
                    <span className="font-mono">{item.binBarcode}</span>
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
