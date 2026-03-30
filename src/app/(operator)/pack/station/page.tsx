"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { Package, Check, Loader2, Box, ScanLine, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { getTasksReadyToPack, confirmPack } from "@/modules/operator/actions";
import { autoCartonize } from "@/modules/cartonization/actions";
import type { PackedCarton } from "@/modules/cartonization/algorithm";

type PackTask = Awaited<ReturnType<typeof getTasksReadyToPack>>[number];

type PackLineItem = {
  id: string;
  productId: string;
  pickedQty: number;
  product: { sku: string; name: string; barcode?: string | null };
};

export default function PackStationPage() {
  const [tasks, setTasks] = useState<PackTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<PackTask | null>(null);
  const [verified, setVerified] = useState<Map<string, number>>(new Map());
  const [boxCount, setBoxCount] = useState("1");
  const [cartonPlan, setCartonPlan] = useState<PackedCarton[] | null>(null);
  const [cartonLoading, setCartonLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadTasks();
  }, []);

  function loadTasks() {
    setLoading(true);
    getTasksReadyToPack()
      .then((data) => setTasks(data as PackTask[]))
      .catch(() => toast.error("Failed to load packing queue"))
      .finally(() => setLoading(false));
  }

  function handleOrderScan(value: string) {
    const task = tasks.find(
      (t) => t.taskNumber === value || t.order?.orderNumber === value
    );
    if (!task) {
      toast.error(`No task found for "${value}"`);
      return;
    }
    selectTask(task);
  }

  function selectTask(task: PackTask) {
    setActiveTask(task);
    setVerified(new Map());
    setCartonPlan(null);
    setBoxCount("1");
    toast.success(`Loaded: ${task.order?.orderNumber ?? task.taskNumber}`);
  }

  function handleItemScan(value: string) {
    if (!activeTask) return;

    const line = activeTask.lines.find(
      (l: PackLineItem) =>
        l.product.sku === value || l.product.barcode === value
    );

    if (!line) {
      toast.error(`Item "${value}" is not in this order`);
      return;
    }

    const typedLine = line as PackLineItem;
    const currentCount = verified.get(typedLine.id) ?? 0;
    const requiredQty = typedLine.pickedQty;

    if (currentCount >= requiredQty) {
      toast.info(`${typedLine.product.sku} already fully verified`);
      return;
    }

    const newCount = currentCount + 1;
    setVerified((prev) => new Map(prev).set(typedLine.id, newCount));

    if (newCount >= requiredQty) {
      toast.success(`${typedLine.product.sku} verified (${newCount}/${requiredQty})`);
    } else {
      toast(`${typedLine.product.sku}: ${newCount}/${requiredQty} scanned`);
    }
  }

  async function handleAutoCartonize() {
    if (!activeTask) return;

    // Find the shipment for cartonization — we need an orderId to look up
    const orderId = activeTask.orderId;
    if (!orderId) {
      toast.error("No order linked to this pick task");
      return;
    }

    setCartonLoading(true);
    try {
      // autoCartonize expects a shipment ID — for orders in packed status
      // we'll call it if a shipment exists, otherwise show the items summary
      const result = await autoCartonize(orderId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.plan) {
        setCartonPlan(result.plan);
        setBoxCount(String(result.plan.length || 1));
        toast.success(`Suggested ${result.plan.length} carton(s)`);
      }
    } catch {
      toast.error("Cartonization failed — verify carton types are configured");
    } finally {
      setCartonLoading(false);
    }
  }

  function handleCompletePacking() {
    if (!activeTask) return;

    startTransition(async () => {
      try {
        const boxes = parseInt(boxCount) || 1;
        await confirmPack(activeTask.id, boxes);
        toast.success("Packing completed successfully");

        // Reset and reload
        setActiveTask(null);
        setVerified(new Map());
        setCartonPlan(null);
        setBoxCount("1");
        loadTasks();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to complete packing");
      }
    });
  }

  function isLineVerified(line: PackLineItem): boolean {
    return (verified.get(line.id) ?? 0) >= line.pickedQty;
  }

  const allVerified = activeTask
    ? activeTask.lines.every((l: PackLineItem) => isLineVerified(l as PackLineItem))
    : false;

  const verifiedCount = activeTask
    ? activeTask.lines.filter((l: PackLineItem) => isLineVerified(l as PackLineItem)).length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PackageCheck className="h-5 w-5" />
          Packing Station
        </h1>
        <p className="text-sm text-muted-foreground">
          Scan order barcode to begin, then verify each item
        </p>
      </div>

      {/* Scan order/shipment barcode */}
      <BarcodeScannerInput
        placeholder="Scan order or task barcode..."
        onScan={handleOrderScan}
        showFeedback
      />

      {/* Active packing task */}
      {activeTask && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Order header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">
                  {activeTask.order?.orderNumber ?? activeTask.taskNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeTask.order?.shipToName ?? "---"} &middot;{" "}
                  {activeTask.order?.shipToCity ?? "---"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeTask.order?.priority && (
                  <Badge className="bg-blue-100 text-blue-700">
                    {activeTask.order.priority}
                  </Badge>
                )}
                <Badge variant={allVerified ? "default" : "secondary"}>
                  {verifiedCount}/{activeTask.lines.length} verified
                </Badge>
              </div>
            </div>

            {/* Item scan area */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <ScanLine className="h-3 w-3" />
                Scan each item barcode to verify
              </p>
              <BarcodeScannerInput
                placeholder="Scan item SKU or barcode..."
                onScan={handleItemScan}
                showFeedback
              />
            </div>

            {/* Items table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-center">Scanned</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTask.lines.map((line: PackLineItem) => {
                  const scanned = verified.get(line.id) ?? 0;
                  const done = scanned >= line.pickedQty;
                  return (
                    <TableRow key={line.id} className={done ? "bg-green-50 dark:bg-green-950/30" : ""}>
                      <TableCell className="font-mono font-medium">
                        {line.product.sku}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {line.product.name}
                      </TableCell>
                      <TableCell className="text-right text-lg font-bold">
                        {line.pickedQty}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {scanned}/{line.pickedQty}
                      </TableCell>
                      <TableCell className="text-center">
                        {done ? (
                          <Check className="mx-auto h-5 w-5 text-green-600" />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setVerified((prev) =>
                                new Map(prev).set(line.id, line.pickedQty)
                              );
                            }}
                          >
                            Manual
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Cartonization suggestion */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Box className="h-4 w-4" />
                  Carton Suggestion
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cartonLoading}
                  onClick={handleAutoCartonize}
                >
                  {cartonLoading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Package className="mr-1 h-3 w-3" />
                  )}
                  Auto-Cartonize
                </Button>
              </div>

              {cartonPlan && cartonPlan.length > 0 && (
                <div className="space-y-2">
                  {cartonPlan.map((carton) => (
                    <div
                      key={carton.cartonSeq}
                      className="flex items-center justify-between rounded bg-muted px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        Box {carton.cartonSeq}: {carton.cartonTypeCode}
                      </span>
                      <span className="text-muted-foreground">
                        {carton.items.reduce((s, i) => s + i.quantity, 0)} items
                        &middot; {carton.totalWeight.toFixed(1)} lb
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual box count override */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground whitespace-nowrap">
                  Box count:
                </label>
                <Input
                  type="number"
                  min={1}
                  className="h-9 w-20 text-center font-bold"
                  value={boxCount}
                  onChange={(e) => setBoxCount(e.target.value)}
                />
              </div>
            </div>

            {/* Complete packing */}
            <Button
              className="h-12 w-full"
              size="lg"
              disabled={!allVerified || isPending}
              onClick={handleCompletePacking}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <PackageCheck className="mr-2 h-5 w-5" />
              )}
              Complete Packing
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Task queue — shown when no active task */}
      {!activeTask && tasks.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Ready to Pack ({tasks.length})
          </h2>
          <div className="space-y-2">
            {tasks.map((task) => (
              <Card
                key={task.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => selectTask(task)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">
                      {task.order?.orderNumber ?? task.taskNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {task.lines.length} line(s) &middot;{" "}
                      {task.order?.shipToName ?? "---"}
                    </p>
                  </div>
                  {task.order?.priority && (
                    <Badge className="bg-blue-100 text-blue-700">
                      {task.order.priority}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading packing queue...
        </div>
      )}

      {/* Empty state */}
      {!loading && tasks.length === 0 && !activeTask && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No orders ready to pack</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders will appear here once picking is complete
          </p>
        </div>
      )}
    </div>
  );
}
