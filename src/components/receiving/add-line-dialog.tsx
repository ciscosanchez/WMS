"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addShipmentLine } from "@/modules/receiving/actions";
import { toast } from "sonner";

interface AddLineDialogProps {
  shipmentId: string;
  clientId: string;
  open: boolean;
  onClose: () => void;
}

export function AddLineDialog({ shipmentId, clientId, open, onClose }: AddLineDialogProps) {
  const [products, setProducts] = useState<{ id: string; sku: string; name: string }[]>([]);
  const [productId, setProductId] = useState("");
  const [expectedQty, setExpectedQty] = useState(1);
  const [lotNumber, setLotNumber] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Mock data until DB is connected
    setProducts([
      { id: "4", sku: "BOLT-M8X40", name: "M8x40 Hex Bolt" },
      { id: "5", sku: "PIPE-SCH40", name: "Schedule 40 Steel Pipe 2in" },
      { id: "6", sku: "VALVE-BV2", name: "2in Ball Valve" },
    ]);
  }, [clientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await addShipmentLine(shipmentId, {
        productId,
        expectedQty,
        lotNumber: lotNumber || null,
      });
      toast.success("Line added");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to add line");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Product *</Label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Expected Quantity *</Label>
            <Input
              type="number"
              min={1}
              value={expectedQty}
              onChange={(e) => setExpectedQty(parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Lot Number</Label>
            <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !productId}>
              {loading ? "Adding..." : "Add Line"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
