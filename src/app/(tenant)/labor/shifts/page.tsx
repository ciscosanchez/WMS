import { getShifts } from "@/modules/labor/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { HardHat } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { getTranslations } from "next-intl/server";

export default async function ShiftHistoryPage() {
  const t = await getTranslations("tenant.labor");
  const shifts = await getShifts();

  return (
    <div className="space-y-6">
      <PageHeader title={t("shiftHistoryTitle")} description={t("shiftHistorySubtitle")} />

      {shifts.length === 0 ? (
        <EmptyState icon={HardHat} title={t("noShiftsTitle")} description={t("noShiftsDesc")} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("operatorId")}</th>
                    <th className="pb-2 font-medium">{t("clockIn")}</th>
                    <th className="pb-2 font-medium">{t("clockOut")}</th>
                    <th className="pb-2 font-medium">{t("duration")}</th>
                    <th className="pb-2 font-medium">{t("breakTime")}</th>
                    <th className="pb-2 font-medium">{t("tasks")}</th>
                    <th className="pb-2 font-medium">{t("units")}</th>
                    <th className="pb-2 font-medium">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(
                    (shift: {
                      id: string;
                      operatorId: string;
                      operatorLabel: string;
                      clockIn: Date;
                      clockOut: Date | null;
                      breakMinutes: number;
                      status: string;
                      taskTimeLogs: Array<{
                        unitsHandled: number;
                        linesHandled: number;
                        taskType: string;
                      }>;
                    }) => {
                      const totalTasks = shift.taskTimeLogs.length;
                      const totalUnits = shift.taskTimeLogs.reduce(
                        (sum, log) => sum + log.unitsHandled,
                        0
                      );
                      const duration = shift.clockOut
                        ? formatDistanceStrict(new Date(shift.clockOut), new Date(shift.clockIn))
                        : "-";

                      return (
                        <tr key={shift.id} className="border-b last:border-0">
                          <td className="py-2">{shift.operatorLabel}</td>
                          <td className="py-2">
                            {format(new Date(shift.clockIn), "MMM d, yyyy HH:mm")}
                          </td>
                          <td className="py-2">
                            {shift.clockOut
                              ? format(new Date(shift.clockOut), "MMM d, yyyy HH:mm")
                              : "-"}
                          </td>
                          <td className="py-2">{duration}</td>
                          <td className="py-2">{shift.breakMinutes}m</td>
                          <td className="py-2">{totalTasks}</td>
                          <td className="py-2">{totalUnits}</td>
                          <td className="py-2">
                            <Badge
                              className={
                                shift.status === "clocked_in"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }
                            >
                              {shift.status === "clocked_in"
                                ? t("statusActive")
                                : t("statusCompleted")}
                            </Badge>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
