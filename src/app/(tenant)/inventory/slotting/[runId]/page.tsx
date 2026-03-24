import { PageHeader } from "@/components/shared/page-header";
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
import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSlottingRun,
  updateRecommendationStatus,
  bulkUpdateRecommendations,
  executeReSlot,
} from "@/modules/slotting/actions";
import { getTranslations } from "next-intl/server";

const statusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  running: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const abcColors: Record<string, string> = {
  A: "bg-red-100 text-red-700",
  B: "bg-yellow-100 text-yellow-700",
  C: "bg-green-100 text-green-700",
};

const recStatusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  executed: "bg-purple-100 text-purple-700",
};

export default async function SlottingRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const t = await getTranslations("tenant.slotting");
  const run = await getSlottingRun(runId);

  if (!run) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("runNotFound")} description={t("runNotFoundDesc")} />
        <Button asChild variant="outline">
          <Link href="/inventory/slotting">{t("backToRuns")}</Link>
        </Button>
      </div>
    );
  }

  const hasAccepted = run.recommendations?.some(
    (rec: {
      status: string;
      id: string;
      productId: string;
      currentBinId: string;
      recommendedBinId: string;
      abcClass: string;
      pickFrequency: number;
      totalScore: unknown;
    }) => rec.status === "rec_accepted"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("runDetail")} ${run.id.slice(0, 8)}...`}
        description={t("runDetailDesc")}
      >
        <Button asChild variant="outline">
          <Link href="/inventory/slotting">{t("backToRuns")}</Link>
        </Button>
      </PageHeader>

      {/* Run Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">{t("status")}</span>
            <div className="mt-1">
              <Badge className={statusColors[run.status] ?? "bg-gray-100 text-gray-700"}>
                {run.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">{t("productsAnalyzed")}</span>
            <p className="mt-1 text-2xl font-bold">{run.productsAnalyzed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">{t("recommendations")}</span>
            <p className="mt-1 text-2xl font-bold">{run.recommendationCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">{t("timing")}</span>
            <p className="mt-1 text-sm font-medium">
              {format(new Date(run.triggeredAt), "MMM d, HH:mm")}
              {run.completedAt && ` - ${format(new Date(run.completedAt), "HH:mm")}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("recommendations")}</span>
            <div className="flex gap-2">
              <form
                action={async () => {
                  "use server";
                  await bulkUpdateRecommendations(runId, "rec_accepted");
                  revalidatePath(`/inventory/slotting/${runId}`);
                  redirect(`/inventory/slotting/${runId}`);
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  {t("acceptAll")}
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await bulkUpdateRecommendations(runId, "rec_rejected");
                  revalidatePath(`/inventory/slotting/${runId}`);
                  redirect(`/inventory/slotting/${runId}`);
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  {t("rejectAll")}
                </Button>
              </form>
              {hasAccepted && (
                <form
                  action={async () => {
                    "use server";
                    await executeReSlot(runId);
                    revalidatePath(`/inventory/slotting/${runId}`);
                    redirect(`/inventory/slotting/${runId}`);
                  }}
                >
                  <Button type="submit" size="sm">
                    {t("executeReSlot")}
                  </Button>
                </form>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("productId")}</TableHead>
                <TableHead>{t("currentBin")}</TableHead>
                <TableHead>{t("recommendedBin")}</TableHead>
                <TableHead>{t("abcClass")}</TableHead>
                <TableHead>{t("pickFrequency")}</TableHead>
                <TableHead>{t("totalScore")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.recommendations?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {t("noRecommendations")}
                  </TableCell>
                </TableRow>
              ) : (
                run.recommendations?.map(
                  (rec: {
                    status: string;
                    id: string;
                    productId: string;
                    currentBinId: string;
                    recommendedBinId: string;
                    abcClass: string;
                    pickFrequency: number;
                    totalScore: unknown;
                  }) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-mono text-sm">
                        {rec.productId.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono">{rec.currentBinId.slice(0, 8)}</TableCell>
                      <TableCell className="font-mono">
                        {rec.recommendedBinId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge className={abcColors[rec.abcClass] ?? "bg-gray-100 text-gray-700"}>
                          {rec.abcClass}
                        </Badge>
                      </TableCell>
                      <TableCell>{rec.pickFrequency}</TableCell>
                      <TableCell>{Number(rec.totalScore).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          className={recStatusColors[rec.status] ?? "bg-gray-100 text-gray-700"}
                        >
                          {rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <form
                            action={async () => {
                              "use server";
                              await updateRecommendationStatus(rec.id, "rec_accepted");
                              revalidatePath(`/inventory/slotting/${runId}`);
                              redirect(`/inventory/slotting/${runId}`);
                            }}
                          >
                            <Button type="submit" variant="outline" size="sm">
                              {t("accept")}
                            </Button>
                          </form>
                          <form
                            action={async () => {
                              "use server";
                              await updateRecommendationStatus(rec.id, "rec_rejected");
                              revalidatePath(`/inventory/slotting/${runId}`);
                              redirect(`/inventory/slotting/${runId}`);
                            }}
                          >
                            <Button type="submit" variant="destructive" size="sm">
                              {t("reject")}
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
