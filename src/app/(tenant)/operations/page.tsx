import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, PackageOpen, Users, Zap } from "lucide-react";
import { getOperationsBoard } from "@/modules/dashboard/manager-actions";
import { AssignTaskButton } from "./assign-task-button";
import { getTranslations } from "next-intl/server";

type BoardData = Awaited<ReturnType<typeof getOperationsBoard>>;
type UnassignedTask = BoardData["unassignedTasks"][number];
type _Operator = BoardData["operators"][number];
type Receiving = BoardData["receivingActive"][number];

export default async function OperationsPage() {
  const t = await getTranslations("tenant.operations");
  const tc = await getTranslations("common");
  const data = await getOperationsBoard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title={t("completedToday")} value={data.kpis.completedToday} icon={CheckCircle2} />
        <KpiCard title={t("avgMinutes")} value={data.kpis.avgMinutes} icon={Clock} />
        <KpiCard
          title={t("pendingUnassigned")}
          value={data.kpis.pendingTasks}
          icon={AlertTriangle}
        />
        <KpiCard
          title={t("activeReceiving")}
          value={data.kpis.activeReceiving}
          icon={PackageOpen}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unassigned Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t("unassignedTasks")} ({data.unassignedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.unassignedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("allAssigned")}</p>
            ) : (
              <div className="space-y-3">
                {data.unassignedTasks.map((task: UnassignedTask) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
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
                    <AssignTaskButton taskId={task.id} operators={data.availableOperators ?? []} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operator Workload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              {t("operatorWorkload")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.operators.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noOperatorActivity")}</p>
            ) : (
              <div className="space-y-3">
                {data.operators.map((op) => (
                  <div key={op.userId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{op.name}</span>
                      <div className="flex items-center gap-1.5">
                        {op.active > 0 && (
                          <Badge variant="default" className="text-xs">
                            <Zap className="mr-0.5 h-3 w-3" /> {op.active} {t("active")}
                          </Badge>
                        )}
                        {op.completed > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {op.completed} {t("done")}
                          </Badge>
                        )}
                        {op.shortPicked > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {op.shortPicked} {t("short")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    {op.total > 0 && (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${((op.completed + op.shortPicked) / op.total) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receiving Progress */}
      {data.receivingActive.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageOpen className="h-4 w-4" />
              {t("activeReceiving")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.receivingActive.map((s: Receiving) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.shipmentNumber}</span>
                      <Badge
                        variant={s.status === "receiving" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.clientName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">
                      {s.totalReceived}/{s.totalExpected}
                    </div>
                    <div className="text-xs text-muted-foreground">{tc("units")}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
