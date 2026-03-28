"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import {
  ClipboardList,
  CheckCircle2,
  ScanLine,
  PackageOpen,
  ListChecks,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Clock,
  Wrench,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { getMyTasksSummary } from "@/modules/dashboard/operator-actions";
import { claimPickTask } from "@/modules/operator/actions";

type Summary = Awaited<ReturnType<typeof getMyTasksSummary>>;

export default function OperatorDashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("operator.dashboard");
  const tc = useTranslations("common");

  function load() {
    getMyTasksSummary()
      .then(setData)
      .catch(() => toast.error(t("failedLoadDashboard")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClaim(taskId: string) {
    startTransition(async () => {
      try {
        await claimPickTask(taskId);
        toast.success(t("taskClaimed"));
        setLoading(true);
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("claimFailed"));
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  type PickItem = Summary["pickTasks"][number];
  type AvailableItem = Summary["availableTasks"][number];
  type ReceiveItem = Summary["receivingShipments"][number];
  type CountItem = Summary["cycleCounts"][number];
  type VasItem = Summary["vasTasks"][number];

  const activePicks = data.pickTasks.filter(
    (t: PickItem) => t.status === "assigned" || t.status === "in_progress"
  );
  const completedPicks = data.pickTasks.filter(
    (t: PickItem) => t.status === "completed" || t.status === "short_picked"
  );

  // Format hours worked as "Xh Ym"
  const h = Math.floor(data.shift.hoursWorked);
  const m = Math.round((data.shift.hoursWorked - h) * 60);
  const shiftLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <div className="space-y-6">
      {/* Shift status banner */}
      {data.shift.clockedIn ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm dark:border-green-900 dark:bg-green-950">
          <Clock className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-green-800 dark:text-green-300">
            {t("onShift")} · {shiftLabel}
          </span>
        </div>
      ) : (
        <button
          className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-left dark:border-amber-900 dark:bg-amber-950"
          onClick={() => router.push("/shift")}
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="flex-1 text-amber-800 dark:text-amber-300">{t("notClockedIn")}</span>
          <ChevronRight className="h-4 w-4 text-amber-500 shrink-0" />
        </button>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title={t("activeTasks")} value={data.stats.active} icon={ClipboardList} />
        <KpiCard
          title={t("completedToday")}
          value={data.stats.completedToday}
          icon={CheckCircle2}
        />
      </div>

      {/* Available to Claim */}
      {data.availableTasks.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Plus className="h-4 w-4" /> {t("availableToClaim")}
          </h2>
          <div className="space-y-2">
            {data.availableTasks.map((task: AvailableItem) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{task.taskNumber}</span>
                    {task.priority === "rush" && (
                      <Badge variant="destructive" className="text-xs">
                        {t("rush")}
                      </Badge>
                    )}
                    {task.priority === "expedited" && (
                      <Badge variant="secondary" className="text-xs">
                        {t("expedited")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.orderNumber} — {task.shipTo} ({task.lineCount} {tc("lines")})
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 text-xs"
                  disabled={isPending}
                  onClick={() => handleClaim(task.id)}
                >
                  {t("claim")}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Pick Tasks */}
      {activePicks.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ScanLine className="h-4 w-4" /> {t("picking")}
          </h2>
          <div className="space-y-2">
            {activePicks.map((task: PickItem) => (
              <Card
                key={task.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/pick?task=${task.id}`)}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.taskNumber}</span>
                      {task.priority === "rush" && (
                        <Badge variant="destructive" className="text-xs">
                          {t("rush")}
                        </Badge>
                      )}
                      {task.priority === "expedited" && (
                        <Badge variant="secondary" className="text-xs">
                          {t("expedited")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {task.orderNumber} — {task.shipTo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {task.completedLines}/{task.totalLines}
                      </div>
                      <div className="text-xs text-muted-foreground">{tc("lines")}</div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-8 w-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="w-full rounded-full bg-primary transition-all"
                        style={{
                          height: `${task.totalLines > 0 ? (task.completedLines / task.totalLines) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Active Receiving */}
      {data.receivingShipments.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <PackageOpen className="h-4 w-4" /> {t("receiving")}
          </h2>
          <div className="space-y-2">
            {data.receivingShipments.map((s: ReceiveItem) => (
              <Card
                key={s.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/receive/${s.id}`)}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{s.shipmentNumber}</span>
                    <p className="text-sm text-muted-foreground truncate">{s.clientName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {s.completedLines}/{s.totalLines}
                      </div>
                      <div className="text-xs text-muted-foreground">{tc("lines")}</div>
                    </div>
                    <Badge
                      variant={s.status === "receiving" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {s.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* VAS Tasks */}
      {data.vasTasks.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Wrench className="h-4 w-4" /> {t("vasTasks")}
          </h2>
          <div className="space-y-2">
            {data.vasTasks.map((v: VasItem) => (
              <Card key={v.id} className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-medium">{v.taskNumber}</span>
                    <Badge variant="outline" className="ml-2 text-xs capitalize">
                      {v.type}
                    </Badge>
                  </div>
                  <Badge
                    variant={v.status === "vas_in_progress" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {v.status === "vas_in_progress" ? t("inProgress") : t("pending")}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Cycle Counts */}
      {data.cycleCounts.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ListChecks className="h-4 w-4" /> {t("cycleCounts")}
          </h2>
          <div className="space-y-2">
            {data.cycleCounts.map((c: CountItem) => (
              <Card
                key={c.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push("/count")}
              >
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-medium">{t("count")}</span>
                    {c.reason && (
                      <span className="ml-2 text-sm text-muted-foreground">{c.reason}</span>
                    )}
                  </div>
                  <Badge
                    variant={c.status === "completed" ? "secondary" : "default"}
                    className="text-xs"
                  >
                    {c.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Completed today */}
      {completedPicks.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("completedToday")}
          </h2>
          <div className="space-y-2">
            {completedPicks.map((task: PickItem) => (
              <Card key={task.id} className="opacity-60">
                <CardContent className="flex items-center gap-3 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{task.taskNumber}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{task.orderNumber}</span>
                  </div>
                  <Badge
                    variant={task.status === "short_picked" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {task.status === "short_picked" ? t("short") : tc("done")}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {data.pickTasks.length === 0 &&
        data.availableTasks.length === 0 &&
        data.receivingShipments.length === 0 &&
        data.cycleCounts.length === 0 &&
        data.vasTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t("noTasksTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("noTasksMessage")}</p>
          </div>
        )}
    </div>
  );
}
