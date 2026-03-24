"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createAdjustment } from "@/modules/inventory/mutations";

interface Props {
  products: { id: string; sku: string; name: string }[];
  bins: { id: string; barcode: string }[];
}

interface AdjustmentLine {
  id: string;
  productId: string;
  sku: string;
  binId: string;
  binBarcode: string;
  systemQty: number;
  countedQty: number;
}

export function NewAdjustmentForm({ products, bins }: Props) {
  const router = useRouter();
  const [type, setType] = useState("adjustment");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<AdjustmentLine[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addBinId, setAddBinId] = useState("");
  const [addSystemQty, setAddSystemQty] = useState(0);
  const [addCountedQty, setAddCountedQty] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  function addLine() {
    const product = products.find((p) => p.id === addProductId);
    const bin = bins.find((b) => b.id === addBinId);
    if (!product || !bin) return;

    setLines([
      ...lines,
      {
        id: `line-${Date.now()}`,
        productId: product.id,
        sku: product.sku,
        binId: bin.id,
        binBarcode: bin.barcode,
        systemQty: addSystemQty,
        countedQty: addCountedQty,
      },
    ]);
    setAddProductId("");
    setAddBinId("");
    setAddSystemQty(0);
    setAddCountedQty(0);
  }

  function removeLine(lineId: string) {
    setLines(lines.filter((l) => l.id !== lineId));
  }

  const totalVariance = lines.reduce((s, l) => s + (l.countedQty - l.systemQty), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdjustment(
        { type, reason, notes },
        lines.map((l) => ({
          productId: l.productId,
          binId: l.binId,
          systemQty: l.systemQty,
          countedQty: l.countedQty,
        }))
      );
      toast.success("Adjustment created — pending approval");
      router.push("/inventory/adjustments");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create adjustment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Adjustment" description="Correct inventory discrepancies" />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Adjustment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="adjustment">Adjustment</option>
                <option value="cycle_count">Cycle Count</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Damaged goods, cycle count variance, etc."
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {lines.length > 0 && (
                <Badge
                  variant={
                    totalVariance === 0
                      ? "secondary"
                      : totalVariance > 0
                        ? "default"
                        : "destructive"
                  }
                >
                  Variance: {totalVariance > 0 ? "+" : ""}
                  {totalVariance}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Product</Label>
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bin</Label>
                <select
                  value={addBinId}
                  onChange={(e) => setAddBinId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select...</option>
                  {bins.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.barcode}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">System Qty</Label>
                <Input
                  type="number"
                  value={addSystemQty}
                  onChange={(e) => setAddSystemQty(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Counted Qty</Label>
                <Input
                  type="number"
                  value={addCountedQty}
                  onChange={(e) => setAddCountedQty(parseInt(e.target.value) || 0)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addLine}
                disabled={!addProductId || !addBinId}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead className="text-right">System</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => {
                    const variance = line.countedQty - line.systemQty;
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="font-mono">{line.sku}</TableCell>
                        <TableCell className="font-mono text-xs">{line.binBarcode}</TableCell>
                        <TableCell className="text-right">{line.systemQty}</TableCell>
                        <TableCell className="text-right font-medium">{line.countedQty}</TableCell>
                        <TableCell
                          className={`text-right font-bold ${variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : ""}`}
                        >
                          {variance > 0 ? "+" : ""}
                          {variance}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(line.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || lines.length === 0}>
            {submitting ? "Creating..." : "Submit for Approval"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
