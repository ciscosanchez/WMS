"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { BarcodeScannerInput } from "@/components/shared/barcode-scanner-input";
import { ScanLine, MapPin, Check, Clock, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getMyPickTasks,
  getAvailablePickTasks,
  claimPickTask,
  confirmPickLine,
  markPickLineShort,
} from "@/modules/operator/actions";
import { actionKey } from "@/hooks/use-offline";
import { useSharedOffline } from "@/providers/offline-provider";

type PickTask = Awaited<ReturnType<typeof getMyPickTasks>>[number];

export default function OperatorPickPage() {
  const [myTasks, setMyTasks] = useState<PickTask[]>([]);
  const [availableTasks, setAvailableTasks] = useState<PickTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const { executeAction } = useSharedOffline();

  async function reload() {
    const [mine, avail] = await Promise.all([getMyPickTasks(), getAvailablePickTasks()]);
    setMyTasks(mine as PickTask[]);
    setAvailableTasks(avail as PickTask[]);
  }

  useEffect(() => {
    reload()
      .catch(() => toast.error("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  async function handleClaim(taskId: string) {
    setWorking(true);
    try {
      const { result, queued } = await executeAction(
        actionKey("operator", "claimPickTask"),
        claimPickTask as (...args: unknown[]) => Promise<unknown>,
        [taskId]
      );
      if (queued) {
        toast.info("Claim queued — will sync when online");
      } else {
        toast.success(`Claimed task ${(result as PickTask).taskNumber}`);
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to claim task");
    } finally {
      setWorking(false);
    }
  }

  async function handleConfirm(line: PickTask["lines"][number], scannedValue: string) {
    // Accept bin barcode OR product barcode/SKU as verification
    const isBinMatch = scannedValue === line.bin.barcode;
    const isProductMatch =
      scannedValue === line.product.barcode ||
      scannedValue === line.product.sku;
    if (!isBinMatch && !isProductMatch) {
      toast.error(`Wrong scan — expected bin ${line.bin.barcode} or product ${line.product.sku}`);
      return;
    }
    setWorking(true);
    try {
      const qty = line.quantity - line.pickedQty;
      const { queued } = await executeAction(
        actionKey("operator", "confirmPickLine"),
        confirmPickLine as (...args: unknown[]) => Promise<unknown>,
        [line.id, qty]
      );
      if (queued) {
        toast.info(`Pick queued for ${line.product.sku}`);
      } else {
        toast.success(`Picked ${line.product.sku}`);
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm pick");
    } finally {
      setWorking(false);
    }
  }

  async function handleShort(line: PickTask["lines"][number]) {
    setWorking(true);
    try {
      const { queued } = await executeAction(
        actionKey("operator", "markPickLineShort"),
        markPickLineShort as (...args: unknown[]) => Promise<unknown>,
        [line.id, line.pickedQty]
      );
      if (queued) {
        toast.info(`Short pick queued: ${line.product.sku}`);
      } else {
        toast.warning(`Marked short: ${line.product.sku}`);
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark short");
    } finally {
      setWorking(false);
    }
  }

  // For each active task, find the first incomplete line
  function getActiveLine(task: PickTask) {
    return task.lines.find((l) => l.pickedQty < l.quantity) ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Pick</h1>
        <p className="text-sm text-muted-foreground">Your active and available pick tasks</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="My Active" value={myTasks.length} icon={ScanLine} />
        <KpiCard title="Available" value={availableTasks.length} icon={Clock} />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tasks...
        </div>
      )}

      {/* Active tasks */}
      {myTasks.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">MY ACTIVE TASKS</h2>
          {myTasks.map((task) => {
            const activeLine = getActiveLine(task);
            const doneCount = task.lines.filter((l) => l.pickedQty >= l.quantity).length;

            return (
              <ActiveTaskCard
                key={task.id}
                task={task}
                activeLine={activeLine}
                doneCount={doneCount}
                working={working}
                onConfirm={handleConfirm}
                onShort={handleShort}
              />
            );
          })}
        </div>
      )}

      {/* Available tasks */}
      {availableTasks.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">AVAILABLE TASKS</h2>
          <div className="space-y-3">
            {availableTasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{task.taskNumber}</p>
                      {task.order?.priority === "rush" && (
                        <Badge className="bg-orange-100 text-orange-700">Rush</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {task.order?.orderNumber ?? "—"} &middot; {task.lines.length} lines
                    </p>
                  </div>
                  <Button disabled={working} onClick={() => handleClaim(task.id)}>
                    Claim
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && myTasks.length === 0 && availableTasks.length === 0 && (
        <p className="text-sm text-muted-foreground">No pick tasks available.</p>
      )}
    </div>
  );
}

function ActiveTaskCard({
  task,
  activeLine,
  doneCount,
  working,
  onConfirm,
  onShort,
}: {
  task: PickTask;
  activeLine: PickTask["lines"][number] | null;
  doneCount: number;
  working: boolean;
  onConfirm: (line: PickTask["lines"][number], scannedBin: string) => void;
  onShort: (line: PickTask["lines"][number]) => void;
}) {
  const [scanInput, setScanInput] = useState("");

  function getBinLabel(line: PickTask["lines"][number]) {
    const bin = line.bin;
    // Try to build a readable label from the bin barcode
    return bin.barcode;
  }

  return (
    <Card className="border-primary mb-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{task.taskNumber}</p>
            <p className="text-sm text-muted-foreground">{task.order?.orderNumber ?? "—"}</p>
          </div>
          <Badge className="bg-orange-100 text-orange-700">
            {doneCount}/{task.lines.length}
          </Badge>
        </div>

        {activeLine && (
          <>
            <div className="mt-4 rounded-lg bg-muted p-4">
              <p className="text-xs font-medium text-muted-foreground">NEXT PICK</p>
              <div className="mt-2 flex items-center gap-3">
                <MapPin className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-lg font-bold">{getBinLabel(activeLine)}</p>
                  <p className="text-sm">
                    {activeLine.product.sku} &mdash; {activeLine.product.name}
                  </p>
                  {(() => {
                    const qty = activeLine.quantity - activeLine.pickedQty;
                    const upc = (activeLine.product as { unitsPerCase?: number | null }).unitsPerCase;
                    return (
                      <>
                        <p className="text-2xl font-bold text-primary">
                          Pick {qty} {upc ? "EACH" : (activeLine.product as { baseUom?: string }).baseUom ?? "EA"}
                        </p>
                        {upc && upc > 1 && (
                          <p className="text-sm font-medium text-amber-600">
                            {upc} units per case — pick individual units, NOT cartons
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <BarcodeScannerInput
                placeholder="Scan bin or product to confirm..."
                onScan={(v) => {
                  setScanInput(v);
                  onConfirm(activeLine, v);
                }}
                expectedValue={activeLine.bin.barcode}
                showFeedback
              />
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                className="h-12 flex-1"
                size="lg"
                disabled={working || !scanInput}
                onClick={() => onConfirm(activeLine, scanInput)}
              >
                <Check className="mr-2 h-5 w-5" />
                Confirm Pick
              </Button>
              <Button
                variant="outline"
                className="h-12"
                disabled={working}
                onClick={() => onShort(activeLine)}
              >
                Short
              </Button>
            </div>
          </>
        )}

        {!activeLine && (
          <p className="mt-3 text-sm text-green-600 font-medium">All lines picked ✓</p>
        )}
      </CardContent>
    </Card>
  );
}
