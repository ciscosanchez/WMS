"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { receiveLine } from "@/modules/receiving/actions";
import { toast } from "sonner";

interface ReceiveLineDialogProps {
  shipmentId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lines: any[];
  open: boolean;
  onClose: () => void;
}

export function ReceiveLineDialog({ shipmentId, lines, open, onClose }: ReceiveLineDialogProps) {
  const [lineId, setLineId] = useState(lines[0]?.id || "");
  const [binId, setBinId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<"good" | "damaged" | "quarantine">("good");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [bins] = useState([
    { id: "b1", barcode: "WH1-A-01-01-01-01" },
    { id: "b2", barcode: "WH1-A-01-01-01-02" },
    { id: "b3", barcode: "WH1-B-02-01-01-05" },
    { id: "b4", barcode: "WH1-B-02-02-01-01" },
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await receiveLine(shipmentId, {
        lineId,
        binId: binId || null,
        quantity,
        condition,
        lotNumber: lotNumber || null,
        serialNumber: serialNumber || null,
        notes: notes || null,
      });
      toast.success("Items received");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to receive");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receive Items</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Line Item *</Label>
            <select
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {lines.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.product.sku} — {l.receivedQty}/{l.expectedQty} received
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Bin Location</Label>
            <select
              value={binId}
              onChange={(e) => setBinId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">No bin (staging)</option>
              {bins.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.barcode}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as "good" | "damaged" | "quarantine")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="good">Good</option>
                <option value="damaged">Damaged</option>
                <option value="quarantine">Quarantine</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lot Number</Label>
              <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Receiving..." : "Receive"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
