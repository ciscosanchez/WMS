"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTransferOrder } from "@/modules/transfers/actions";

export default function NewTransferPage() {
  const router = useRouter();
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ productId: "", quantity: 1, lotNumber: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addLine() {
    setLines([...lines, { productId: "", quantity: 1, lotNumber: "" }]);
  }

  function updateLine(idx: number, field: string, value: string | number) {
    const updated = [...lines];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    setLines(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const validLines = lines.filter((l) => l.productId && l.quantity > 0);
      if (validLines.length === 0) {
        setError("At least one line item is required");
        setSubmitting(false);
        return;
      }

      await createTransferOrder(
        { fromWarehouseId, toWarehouseId, notes: notes || undefined },
        validLines
      );
      router.push("/inventory/transfers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transfer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Transfer Order</h1>
        <p className="text-muted-foreground">Move inventory between warehouses</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">From Warehouse</label>
            <input
              type="text"
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              placeholder="Warehouse ID"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">To Warehouse</label>
            <input
              type="text"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              placeholder="Warehouse ID"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Line Items</label>
            <button
              type="button"
              onClick={addLine}
              className="text-sm text-primary hover:underline"
            >
              + Add Line
            </button>
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={line.productId}
                onChange={(e) => updateLine(idx, "productId", e.target.value)}
                placeholder="Product ID"
                className="rounded-md border px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={line.quantity}
                onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 0)}
                min={1}
                className="rounded-md border px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={line.lotNumber}
                onChange={(e) => updateLine(idx, "lotNumber", e.target.value)}
                placeholder="Lot # (optional)"
                className="rounded-md border px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Transfer Order"}
        </button>
      </form>
    </div>
  );
}
