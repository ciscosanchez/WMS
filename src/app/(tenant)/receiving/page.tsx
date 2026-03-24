import { getShipments } from "@/modules/receiving/actions";
import { getRecentJobs } from "@/modules/receiving/docai-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, PackageOpen, Sparkles, CheckCircle, AlertTriangle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { ShipmentsTable } from "@/components/receiving/shipments-table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDistanceToNow } from "date-fns";
import { getTranslations } from "next-intl/server";

function JobStatusBadge({ status, confidence }: { status: string; confidence: number | null }) {
  switch (status) {
    case "processing":
      return <Badge className="bg-blue-100 text-blue-700 gap-1 text-xs"><Loader2 className="h-3 w-3 animate-spin" />Processing</Badge>;
    case "review":
      return <Badge className="bg-yellow-100 text-yellow-700 gap-1 text-xs"><AlertTriangle className="h-3 w-3" />Review {confidence ? `${Math.round(confidence * 100)}%` : ""}</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-700 gap-1 text-xs"><CheckCircle className="h-3 w-3" />Done</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-700 gap-1 text-xs"><XCircle className="h-3 w-3" />Failed</Badge>;
    default:
      return null;
  }
}

export default async function ReceivingPage() {
  const t = await getTranslations("tenant.receiving");
  const [shipments, recentJobs] = await Promise.all([
    getShipments(),
    getRecentJobs(5),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/receiving/smart">
              <Sparkles className="mr-2 h-4 w-4" />
              {t("smartReceiving")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/receiving/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newShipment")}
            </Link>
          </Button>
        </div>
      </PageHeader>

      {shipments.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title={t("noShipments")}
          description={t("noShipmentsDesc")}
        >
          <Button asChild>
            <Link href="/receiving/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newShipment")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <ShipmentsTable data={shipments} />
      )}

      {/* Recent DocAI Extractions */}
      {recentJobs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-purple-500" />
              {t("recentExtractions")}
            </p>
            <Button variant="ghost" size="sm" asChild className="text-xs h-7">
              <Link href="/receiving/smart">{t("newExtraction")}</Link>
            </Button>
          </div>
          <div className="rounded-md border divide-y">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {recentJobs.map((job: any) => (
              <div key={job.id} className="flex items-center gap-3 px-4 py-3">
                <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    {job.documentType && ` · ${job.documentType.replace("_", " ")}`}
                  </p>
                </div>
                <JobStatusBadge status={job.status} confidence={job.confidence} />
                {job.status === "review" && (
                  <Button variant="outline" size="sm" className="text-xs h-7" asChild>
                    <Link href={`/receiving/review/${job.id}`}>Review</Link>
                  </Button>
                )}
                {job.status === "completed" && job.resultId && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                    <Link href={`/receiving/${job.resultId}`}>View</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
