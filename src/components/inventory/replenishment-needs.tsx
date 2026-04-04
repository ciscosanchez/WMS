"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { executeReplenishment, autoTriggerReplenishment } from "@/modules/replenishment/actions";
import type { ReplenishmentNeed } from "@/modules/replenishment/actions";

interface ReplenishmentNeedsProps {
  needs: ReplenishmentNeed[];
}

export function ReplenishmentNeeds({ needs }: ReplenishmentNeedsProps) {
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());
  const [isExecuting, startExecute] = useTransition();
  const [isAutoRunning, startAutoRun] = useTransition();
  const [autoComplete, setAutoComplete] = useState(false);

  function handleExecute(ruleId: string) {
    startExecute(async () => {
      try {
        const result = await executeReplenishment(ruleId);
        setExecutedIds((prev) => new Set([...prev, ruleId]));
        if (result.movedQty > 0) {
          toast.success(
            `Moved ${result.movedQty} units of ${result.productSku} from ${result.fromBinBarcode} to ${result.toBinBarcode}`
          );
        } else {
          toast.info(`No inventory moved for ${result.productSku}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Replenishment failed");
      }
    });
  }

  function handleAutoReplenish() {
    startAutoRun(async () => {
      try {
        const results = await autoTriggerReplenishment();
        setAutoComplete(true);
        const movedIds = results.map((r) => r.ruleId);
        setExecutedIds((prev) => new Set([...prev, ...movedIds]));

        if (results.length === 0) {
          toast.info("No replenishment moves were needed");
        } else {
          const totalMoved = results.reduce((s, r) => s + r.movedQty, 0);
          toast.success(
            `Auto-replenished ${results.length} rules, moved ${totalMoved} total units`
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Auto-replenishment failed");
      }
    });
  }

  if (needs.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
        <p className="mt-3 font-medium">All Stocked</p>
        <p className="text-sm text-muted-foreground">
          No pick-face bins need replenishment right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Auto-replenish button */}
      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" disabled={isAutoRunning || autoComplete}>
                <Zap className="mr-2 h-4 w-4" />
                {isAutoRunning
                  ? "Running..."
                  : autoComplete
                    ? "Auto-Replenish Done"
                    : "Auto-Replenish All"}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Auto-Replenish All</AlertDialogTitle>
              <AlertDialogDescription>
                This will automatically move inventory from bulk bins to all pick-face bins that are
                below their reorder point. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAutoReplenish}>
                Run Auto-Replenish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Need Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {needs.map((need) => {
          const isExecuted = executedIds.has(need.ruleId);
          const urgencyPct =
            need.reorderPoint > 0 ? (need.currentQty / need.reorderPoint) * 100 : 0;
          const isUrgent = urgencyPct < 50;

          return (
            <Card key={need.ruleId} className={isExecuted ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {isUrgent && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  {need.productSku}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{need.productName}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p
                      className={`text-lg font-bold ${
                        isUrgent ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {need.currentQty}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reorder</p>
                    <p className="text-lg font-medium">{need.reorderPoint}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Suggested</p>
                    <p className="text-lg font-bold text-blue-600">+{need.suggestedQty}</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Bin: {need.binBarcode}</p>

                {/* Progress bar */}
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-2 rounded-full ${isUrgent ? "bg-red-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(urgencyPct, 100)}%` }}
                  />
                </div>

                <Button
                  className="w-full"
                  size="sm"
                  disabled={isExecuting || isExecuted}
                  onClick={() => handleExecute(need.ruleId)}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  {isExecuted ? "Executed" : isExecuting ? "Moving..." : "Execute"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
