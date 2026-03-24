"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getRma, inspectReturnLine, finalizeReturn } from "@/modules/returns/actions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReturnLine {
  id: string;
  expectedQty: number;
  receivedQty: number;
  dispositionQty: number;
  disposition: string | null;
  product: { sku: string; name: string };
}

interface RmaDetail {
  id: string;
  rmaNumber: string;
  status: string;
  client: { code: string; name: string };
  lines: ReturnLine[];
}

type Condition = "good" | "damaged" | "quarantine";
type Disposition = "restock" | "quarantine" | "dispose" | "repair";

interface LineForm {
  quantity: string;
  condition: Condition;
  disposition: Disposition;
  notes: string;
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function InspectRmaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [rma, setRma] = useState<RmaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // Per-line form state keyed by line id
  const [forms, setForms] = useState<Record<string, LineForm>>({});

  useEffect(() => {
    getRma(id)
      .then((data) => {
        if (!data) {
          toast.error("RMA not found");
          router.push("/inspect");
          return;
        }
        const rmaData = data as unknown as RmaDetail;
        setRma(rmaData);
        // Initialize form state for uninspected lines
        const initial: Record<string, LineForm> = {};
        for (const line of rmaData.lines) {
          if (line.dispositionQty < line.receivedQty) {
            initial[line.id] = {
              quantity: String(line.receivedQty - line.dispositionQty),
              condition: "good",
              disposition: "restock",
              notes: "",
            };
          }
        }
        setForms(initial);
      })
      .catch(() => toast.error("Failed to load RMA"))
      .finally(() => setLoading(false));
  }, [id, router]);

  function updateForm(lineId: string, patch: Partial<LineForm>) {
    setForms((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], ...patch },
    }));
  }

  async function handleInspect(line: ReturnLine) {
    const form = forms[line.id];
    if (!form) return;

    const qty = parseInt(form.quantity);
    if (!qty || qty < 1) {
      toast.error("Enter a valid quantity");
      return;
    }

    setSubmitting(line.id);
    try {
      const result = await inspectReturnLine(id, {
        lineId: line.id,
        quantity: qty,
        condition: form.condition,
        disposition: form.disposition,
        notes: form.notes || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Inspected ${qty} x ${line.product.sku}`);

      // Refresh RMA
      const updated = await getRma(id);
      if (updated) {
        const updatedData = updated as unknown as RmaDetail;
        setRma(updatedData);
        // Rebuild forms for remaining uninspected lines
        const newForms: Record<string, LineForm> = {};
        for (const l of updatedData.lines) {
          if (l.dispositionQty < l.receivedQty) {
            newForms[l.id] = forms[l.id] ?? {
              quantity: String(l.receivedQty - l.dispositionQty),
              condition: "good",
              disposition: "restock",
              notes: "",
            };
            // Update quantity to remaining
            newForms[l.id].quantity = String(l.receivedQty - l.dispositionQty);
          }
        }
        setForms(newForms);
      }
    } catch {
      toast.error("Failed to submit inspection");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const result = await finalizeReturn(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Return finalized successfully");
      router.push("/inspect");
    } catch {
      toast.error("Failed to finalize return");
    } finally {
      setFinalizing(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading RMA...
      </div>
    );
  }

  if (!rma) return null;

  const allInspected = rma.lines.every(
    (l) => l.dispositionQty >= l.receivedQty && l.receivedQty > 0
  );
  const canFinalize = allInspected && rma.status !== "rma_completed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/inspect")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{rma.rmaNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {rma.client.name} ({rma.client.code})
          </p>
        </div>
      </div>

      {/* Lines */}
      <div className="space-y-4">
        {rma.lines.map((line) => {
          const needsInspection = line.dispositionQty < line.receivedQty;
          const form = forms[line.id];
          const isSubmitting = submitting === line.id;

          return (
            <Card
              key={line.id}
              className={needsInspection ? "border-amber-300" : "border-green-300 bg-green-50"}
            >
              <CardContent className="space-y-4 p-4">
                {/* Line header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-lg font-bold">{line.product.sku}</p>
                    <p className="text-sm text-muted-foreground">{line.product.name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">Expected: {line.expectedQty}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Received: {line.receivedQty} &middot; Inspected: {line.dispositionQty}
                    </p>
                  </div>
                </div>

                {/* Inspection complete indicator */}
                {!needsInspection && line.receivedQty > 0 && (
                  <div className="flex items-center gap-2 text-green-700">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Inspected &mdash; {line.disposition?.replace(/_/g, " ") ?? "done"}
                    </span>
                  </div>
                )}

                {/* Not yet received */}
                {line.receivedQty === 0 && (
                  <p className="text-sm text-muted-foreground">Not yet received</p>
                )}

                {/* Inspection form */}
                {needsInspection && form && (
                  <div className="space-y-3">
                    {/* Quantity */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Quantity to Inspect
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={line.receivedQty - line.dispositionQty}
                        className="mt-1 h-12 text-center text-2xl font-bold"
                        value={form.quantity}
                        onChange={(e) => updateForm(line.id, { quantity: e.target.value })}
                      />
                    </div>

                    {/* Condition */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Condition</label>
                      <Select
                        value={form.condition}
                        onValueChange={(v) => updateForm(line.id, { condition: v as Condition })}
                      >
                        <SelectTrigger className="mt-1 h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="quarantine">Quarantine</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Disposition */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Disposition
                      </label>
                      <Select
                        value={form.disposition}
                        onValueChange={(v) =>
                          updateForm(line.id, { disposition: v as Disposition })
                        }
                      >
                        <SelectTrigger className="mt-1 h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="restock">Restock</SelectItem>
                          <SelectItem value="quarantine">Quarantine</SelectItem>
                          <SelectItem value="dispose">Dispose</SelectItem>
                          <SelectItem value="repair">Repair</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Notes</label>
                      <Input
                        className="mt-1 h-12"
                        placeholder="Optional inspection notes..."
                        value={form.notes}
                        onChange={(e) => updateForm(line.id, { notes: e.target.value })}
                      />
                    </div>

                    {/* Submit */}
                    <Button
                      className="h-14 w-full text-base"
                      size="lg"
                      disabled={isSubmitting || !form.quantity || parseInt(form.quantity) < 1}
                      onClick={() => handleInspect(line)}
                    >
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-5 w-5" />
                      )}
                      Submit Inspection
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Finalize */}
      {canFinalize && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4">
            <p className="font-semibold text-green-700">All lines inspected</p>
            <p className="mb-4 text-sm text-green-600">
              Finalize this return to process dispositions and update inventory.
            </p>
            <Button
              className="h-14 w-full text-base"
              size="lg"
              onClick={handleFinalize}
              disabled={finalizing}
            >
              {finalizing ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Check className="mr-2 h-5 w-5" />
              )}
              Finalize Return
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
