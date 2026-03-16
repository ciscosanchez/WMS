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

interface PendingItem {
  id: string;
  productSku: string;
  productName: string;
  clientCode: string;
  quantity: number;
  uom: string;
  receivedDate: string;
  shipmentNumber: string;
  suggestions: { binId: string; barcode: string; reason: string }[];
}

const mockPendingItems: PendingItem[] = [
  {
    id: "pend-1",
    productSku: "BOLT-M8X40",
    productName: "M8x40 Hex Bolt",
    clientCode: "GLOBEX",
    quantity: 95,
    uom: "EA",
    receivedDate: "2026-03-15",
    shipmentNumber: "ASN-2026-0002",
    suggestions: [
      { binId: "bin-b2", barcode: "WH1-B-02-01-01-05", reason: "Consolidate with existing stock" },
      { binId: "bin-b1", barcode: "WH1-B-02-01-01-01", reason: "First available bin in Zone B" },
      { binId: "bin-a2", barcode: "WH1-A-01-01-01-02", reason: "Nearest empty bin" },
    ],
  },
  {
    id: "pend-2",
    productSku: "PIPE-SCH40",
    productName: 'Schedule 40 Steel Pipe 2"',
    clientCode: "GLOBEX",
    quantity: 50,
    uom: "FT",
    receivedDate: "2026-03-15",
    shipmentNumber: "ASN-2026-0002",
    suggestions: [
      { binId: "bin-b3", barcode: "WH1-B-02-02-01-01", reason: "Consolidate with existing stock" },
      { binId: "bin-b4", barcode: "WH1-B-02-02-01-02", reason: "First available bin in Zone B" },
    ],
  },
  {
    id: "pend-3",
    productSku: "VALVE-BV2",
    productName: '2" Ball Valve',
    clientCode: "INITECH",
    quantity: 12,
    uom: "EA",
    receivedDate: "2026-03-16",
    shipmentNumber: "ASN-2026-0003",
    suggestions: [
      { binId: "bin-a4", barcode: "WH1-A-01-01-02-01", reason: "Nearest empty bin" },
      { binId: "bin-a2", barcode: "WH1-A-01-01-01-02", reason: "First available bin in Zone A" },
    ],
  },
];

const allBinOptions = [
  { id: "bin-a1", barcode: "WH1-A-01-01-01-01" },
  { id: "bin-a2", barcode: "WH1-A-01-01-01-02" },
  { id: "bin-a3", barcode: "WH1-A-01-01-01-03" },
  { id: "bin-a4", barcode: "WH1-A-01-01-02-01" },
  { id: "bin-b1", barcode: "WH1-B-02-01-01-01" },
  { id: "bin-b2", barcode: "WH1-B-02-01-01-05" },
  { id: "bin-b3", barcode: "WH1-B-02-02-01-01" },
  { id: "bin-b4", barcode: "WH1-B-02-02-01-02" },
  { id: "bin-s1", barcode: "WH1-S-01-01-01-01" },
  { id: "bin-c1", barcode: "WH2-C-01-01-01-01" },
  { id: "bin-c2", barcode: "WH2-C-01-01-01-02" },
];

export default function PutawayPage() {
  const [pending, setPending] = useState<PendingItem[]>(mockPendingItems);
  const [completed, setCompleted] = useState<
    {
      id: string;
      productSku: string;
      productName: string;
      quantity: number;
      uom: string;
      binBarcode: string;
    }[]
  >([]);
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);

  function openDialog(item: PendingItem) {
    setDialogOpen(item.id);
    setSelectedBin(item.suggestions[0]?.binId ?? "");
    setManualMode(false);
  }

  function executePutaway(item: PendingItem) {
    const bin = allBinOptions.find((b) => b.id === selectedBin);
    if (!bin) {
      toast.error("Please select a bin");
      return;
    }

    setPending((prev) => prev.filter((p) => p.id !== item.id));
    setCompleted((prev) => [
      {
        id: item.id,
        productSku: item.productSku,
        productName: item.productName,
        quantity: item.quantity,
        uom: item.uom,
        binBarcode: bin.barcode,
      },
      ...prev,
    ]);
    setDialogOpen(null);
    toast.success(`${item.productSku} put away to ${bin.barcode}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Putaway" description="Assign received items to storage locations">
        <Badge variant="secondary">{pending.length} pending</Badge>
      </PageHeader>

      {/* Pending items */}
      {pending.length === 0 && completed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ArrowDownToLine className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No items pending putaway</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Items will appear here after receiving shipments.
          </p>
        </div>
      )}

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
                    <span className="font-medium">
                      {item.quantity} {item.uom}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Received</span>
                    <span>{item.receivedDate}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipment</span>
                    <span>{item.shipmentNumber}</span>
                  </div>
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
                          Putaway {item.productSku} ({item.quantity} {item.uom})
                        </DialogTitle>
                        <DialogDescription>{item.productName}</DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        {!manualMode && (
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

                        {manualMode && (
                          <div className="space-y-2">
                            <label htmlFor="manual-bin" className="text-sm font-medium">
                              Select bin manually
                            </label>
                            <select
                              id="manual-bin"
                              value={selectedBin}
                              onChange={(e) => setSelectedBin(e.target.value)}
                              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="">Select a bin...</option>
                              {allBinOptions.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.barcode}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

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
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(null)}>
                          Cancel
                        </Button>
                        <Button onClick={() => executePutaway(item)} disabled={!selectedBin}>
                          Confirm Putaway
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
                    <span className="font-medium">
                      {item.quantity} {item.uom}
                    </span>
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
