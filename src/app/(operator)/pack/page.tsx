"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { Package, Printer, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTasksReadyToPack, confirmPack } from "@/modules/operator/actions";

type PackTask = Awaited<ReturnType<typeof getTasksReadyToPack>>[number];

export default function OperatorPackPage() {
  const [tasks, setTasks] = useState<PackTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<PackTask | null>(null);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [boxCount, setBoxCount] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getTasksReadyToPack()
      .then((data) => setTasks(data as PackTask[]))
      .catch(() => toast.error("Failed to load packing queue"))
      .finally(() => setLoading(false));
  }, []);

  function handleTaskScan(value: string) {
    const task = tasks.find(
      (t) => t.taskNumber === value || t.order?.orderNumber === value
    );
    if (!task) {
      toast.error(`No packing task found for: ${value}`);
      return;
    }
    setActiveTask(task);
    setVerified(new Set());
    toast.success(`Task: ${task.taskNumber}`);
  }

  function handleItemScan(value: string) {
    if (!activeTask) return;
    const line = activeTask.lines.find(
      (l) => l.product.sku === value || l.product.barcode === value
    );
    if (!line) {
      toast.error(`Item not in this task: ${value}`);
      return;
    }
    setVerified((prev) => new Set([...prev, line.id]));
    toast.success(`Verified: ${line.product.sku}`);
  }

  async function handleConfirmPack() {
    if (!activeTask) return;

    setSubmitting(true);
    try {
      await confirmPack(activeTask.id, parseInt(boxCount) || 1);
      toast.success(`Packed — shipment created`);
      // Reload tasks
      const updated = await getTasksReadyToPack();
      setTasks(updated as PackTask[]);
      setActiveTask(null);
      setVerified(new Set());
      setBoxCount("1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pack failed");
    } finally {
      setSubmitting(false);
    }
  }

  const allVerified = activeTask
    ? activeTask.lines.every((l) => verified.has(l.id))
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Pack</h1>
        <p className="text-sm text-muted-foreground">Verify items and pack for shipment</p>
      </div>

      {/* Scan to select task */}
      <BarcodeScannerInput
        placeholder="Scan order or pick task barcode..."
        onScan={handleTaskScan}
        showFeedback
      />

      {/* Active packing task */}
      {activeTask && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">{activeTask.order?.orderNumber ?? activeTask.taskNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {activeTask.order?.shipToName ?? "—"} &middot; {activeTask.order?.shipToCity ?? "—"}
                </p>
              </div>
              {activeTask.order?.priority && (
                <Badge className="bg-blue-100 text-blue-700">
                  {activeTask.order.priority}
                </Badge>
              )}
            </div>

            {/* Items to verify */}
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                SCAN EACH ITEM TO VERIFY
              </p>
              <BarcodeScannerInput
                placeholder="Scan item barcode..."
                onScan={handleItemScan}
                showFeedback
              />
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-center">Verified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTask.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono font-medium">{line.product.sku}</TableCell>
                      <TableCell>{line.product.name}</TableCell>
                      <TableCell className="text-right text-lg font-bold">
                        {line.pickedQty}
                      </TableCell>
                      <TableCell className="text-center">
                        {verified.has(line.id) ? (
                          <Check className="mx-auto h-5 w-5 text-green-600" />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setVerified((prev) => new Set([...prev, line.id]));
                            }}
                          >
                            Scan
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Box count */}
            <div className="mt-4 rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">BOX COUNT</p>
                  <Input
                    type="number"
                    min={1}
                    className="mt-1 h-10 w-24 text-center text-lg font-bold"
                    value={boxCount}
                    onChange={(e) => setBoxCount(e.target.value)}
                  />
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <Button
                className="h-12 flex-1"
                size="lg"
                disabled={!allVerified || submitting}
                onClick={handleConfirmPack}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-5 w-5" />
                )}
                Complete Pack
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue */}
      {tasks.length > 0 && !activeTask && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            READY TO PACK ({tasks.length})
          </h2>
          <div className="space-y-3">
            {tasks.map((task) => (
              <Card
                key={task.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setActiveTask(task);
                  setVerified(new Set());
                }}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{task.order?.orderNumber ?? task.taskNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.lines.length} line(s) &middot; {task.order?.shipToName ?? "—"}
                    </p>
                  </div>
                  {task.order?.priority && (
                    <Badge className="bg-blue-100 text-blue-700">{task.order.priority}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading packing queue...
        </div>
      )}

      {!loading && tasks.length === 0 && !activeTask && (
        <p className="text-sm text-muted-foreground">No tasks ready to pack.</p>
      )}
    </div>
  );
}
