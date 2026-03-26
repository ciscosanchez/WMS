import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSlottingRuns, triggerSlottingRun } from "@/modules/slotting/actions";
import { getTranslations } from "next-intl/server";

const statusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  running: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default async function SlottingDashboardPage() {
  const t = await getTranslations("tenant.slotting");
  const runs = await getSlottingRuns();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <form
          action={async () => {
            "use server";
            const { requireTenantContext } = await import("@/lib/tenant/context");
            const { tenant } = await requireTenantContext("inventory:write");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wh = await (tenant.db as any).warehouse.findFirst({
              where: { isActive: true },
              select: { id: true },
            });
            if (!wh) return;
            const result = await triggerSlottingRun(wh.id);
            if (!result.error) {
              revalidatePath("/inventory/slotting");
              redirect("/inventory/slotting");
            }
          }}
        >
          <Button type="submit">
            <BarChart3 className="mr-2 h-4 w-4" />
            {t("runAnalysis")}
          </Button>
        </form>
      </PageHeader>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState icon={BarChart3} title={t("noRuns")} description={t("noRunsDesc")} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("pastRuns")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("productsAnalyzed")}</TableHead>
                  <TableHead>{t("recommendations")}</TableHead>
                  <TableHead>{t("triggered")}</TableHead>
                  <TableHead>{t("completedAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(
                  (run: {
                    id: string;
                    status: string;
                    productCount: number;
                    recommendationCount: number;
                    createdAt: Date;
                    completedAt: Date | null;
                  }) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Link href={`/inventory/slotting/${run.id}`}>
                          <Badge
                            className={statusColors[run.status] ?? "bg-gray-100 text-gray-700"}
                          >
                            {run.status}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>{run.productCount}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{run.recommendationCount}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(run.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell>
                        {run.completedAt
                          ? format(new Date(run.completedAt), "MMM d, yyyy HH:mm")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
