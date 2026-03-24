import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListChecks } from "lucide-react";
import { format } from "date-fns";
import { getCycleCounts } from "@/modules/inventory/putaway-actions";
import { getTranslations } from "next-intl/server";

type CycleCountItem = Awaited<ReturnType<typeof getCycleCounts>>[number];

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

export default async function CycleCountsPage() {
  const t = await getTranslations("tenant.inventory");
  const counts = await getCycleCounts();

  const activeCount = counts.filter(
    (c: CycleCountItem) => !["completed", "rejected"].includes(c.status)
  ).length;
  const completedCount = counts.filter((c: CycleCountItem) => c.status === "completed").length;
  const totalLines = counts.reduce((sum: number, c: CycleCountItem) => sum + c.lines.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("cycleCounts")} description={t("cycleCountsDesc")} />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("active")}</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">{t("completed")}</span>
            <p className="mt-1 text-2xl font-bold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">{t("totalLinesCounted")}</span>
            <p className="mt-1 text-2xl font-bold">{totalLines}</p>
          </CardContent>
        </Card>
      </div>

      {/* Counts table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("cycleCounts")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("number")}</TableHead>
                <TableHead>{t("reason")}</TableHead>
                <TableHead>{t("lines")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("created")}</TableHead>
                <TableHead>{t("completed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("noCycleCounts")}
                  </TableCell>
                </TableRow>
              ) : (
                counts.map((count: CycleCountItem) => (
                  <TableRow key={count.id}>
                    <TableCell className="font-medium font-mono">
                      {count.adjustmentNumber}
                    </TableCell>
                    <TableCell>{count.reason ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{count.lines.length} items</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={statusLabels[count.status] ?? count.status} />
                    </TableCell>
                    <TableCell>{format(count.createdAt, "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {count.completedAt ? format(count.completedAt, "MMM d, yyyy") : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
