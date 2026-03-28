import { getPickMovementReport } from "@/modules/dashboard/manager-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { MapPin, TrendingUp, Users } from "lucide-react";

export default async function PickMovementPage() {
  const t = await getTranslations("tenant.reports.pickMovement");
  const report = await getPickMovementReport();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{report.totalLinesPickedToday}</p>
              <p className="text-sm text-muted-foreground">{t("totalLinesPickedToday")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{report.zones.length}</p>
              <p className="text-sm text-muted-foreground">{t("activeZones")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">
                {report.zones.reduce((max, z) => Math.max(max, z.uniqueOperators), 0)}
              </p>
              <p className="text-sm text-muted-foreground">{t("peakOperatorsInZone")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zone breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("zoneBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.zones.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("noPicksToday")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-3 font-medium">{t("zone")}</th>
                    <th className="px-4 py-3 font-medium text-right">{t("linesPickedToday")}</th>
                    <th className="px-4 py-3 font-medium text-right">{t("operators")}</th>
                    <th className="px-4 py-3 font-medium text-right">{t("pctOfTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.zones.map((zone, idx) => (
                    <tr key={zone.zoneCode} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="px-4 py-3 font-medium">
                        <span className="font-mono text-xs text-muted-foreground mr-2">
                          {zone.zoneCode}
                        </span>
                        {zone.zoneName}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{zone.linesPickedToday}</td>
                      <td className="px-4 py-3 text-right">{zone.uniqueOperators}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${zone.pctOfTotal}%` }}
                            />
                          </div>
                          <span className="w-8 text-right">{zone.pctOfTotal}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top bins by frequency */}
      {report.topBins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("topBins")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-3 font-medium">{t("rank")}</th>
                    <th className="px-4 py-3 font-medium">{t("binCode")}</th>
                    <th className="px-4 py-3 font-medium text-right">{t("picksToday")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topBins.map((bin, idx) => (
                    <tr key={bin.binBarcode} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="px-4 py-3 text-muted-foreground">#{idx + 1}</td>
                      <td className="px-4 py-3 font-mono font-medium">{bin.binCode}</td>
                      <td className="px-4 py-3 text-right font-bold">{bin.pickCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
