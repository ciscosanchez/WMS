"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import { actionKey } from "@/hooks/use-offline";
import { useSharedOffline } from "@/providers/offline-provider";

type PackTask = Awaited<ReturnType<typeof getTasksReadyToPack>>[number];

export default function OperatorPackPage() {
  const [tasks, setTasks] = useState<PackTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<PackTask | null>(null);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [boxCount, setBoxCount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const { executeAction } = useSharedOffline();
  const t = useTranslations("operator.pack");
  const tc = useTranslations("common");

  useEffect(() => {
    getTasksReadyToPack()
      .then((data) => setTasks(data as PackTask[]))
      .catch(() => toast.error(t("failedLoadQueue")))
      .finally(() => setLoading(false));
  }, [t]);

  function handleTaskScan(value: string) {
    const task = tasks.find(
      (t) => t.taskNumber === value || t.order?.orderNumber === value
    );
    if (!task) {
      toast.error(t("noTaskFound", { value }));
      return;
    }
    setActiveTask(task);
    setVerified(new Set());
    toast.success(t("taskSelected", { taskNumber: task.taskNumber }));
  }

  function handleItemScan(value: string) {
    if (!activeTask) return;
    const line = activeTask.lines.find(
      (l) => l.product.sku === value || l.product.barcode === value
    );
    if (!line) {
      toast.error(t("itemNotInTask", { value }));
      return;
    }
    setVerified((prev) => new Set([...prev, line.id]));
    toast.success(t("verifiedItem", { sku: line.product.sku }));
  }

  async function handleConfirmPack() {
    if (!activeTask) return;

    setSubmitting(true);
    try {
      const boxes = parseInt(boxCount) || 1;
      const { queued } = await executeAction(
        actionKey("operator", "confirmPack"),
        confirmPack as (...args: unknown[]) => Promise<unknown>,
        [activeTask.id, boxes]
      );

      if (queued) {
        toast.info(t("packQueued"));
      } else {
        toast.success(t("packSuccess"));
      }

      // Reload tasks
      const updated = await getTasksReadyToPack();
      setTasks(updated as PackTask[]);
      setActiveTask(null);
      setVerified(new Set());
      setBoxCount("1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("packFailed"));
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
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Scan to select task */}
      <BarcodeScannerInput
        placeholder={t("scanOrderBarcode")}
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
                {t("scanEachItem")}
              </p>
              <BarcodeScannerInput
                placeholder={t("scanItemBarcode")}
                onScan={handleItemScan}
                showFeedback
              />
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sku")}</TableHead>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-right">{t("qty")}</TableHead>
                    <TableHead className="text-center">{t("verified")}</TableHead>
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
                            {t("scan")}
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
                  <p className="text-xs font-medium text-muted-foreground">{t("boxCount")}</p>
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
                {t("completePack")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue */}
      {tasks.length > 0 && !activeTask && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t("readyToPack", { count: tasks.length })}
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
          {t("loadingQueue")}
        </div>
      )}

      {!loading && tasks.length === 0 && !activeTask && (
        <p className="text-sm text-muted-foreground">{t("noTasksReady")}</p>
      )}
    </div>
  );
}
