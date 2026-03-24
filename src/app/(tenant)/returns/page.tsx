import { getRmas } from "@/modules/returns/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-blue-100 text-blue-700 border-blue-200",
  approved: "bg-indigo-100 text-indigo-700 border-indigo-200",
  in_transit: "bg-yellow-100 text-yellow-700 border-yellow-200",
  received: "bg-orange-100 text-orange-700 border-orange-200",
  inspecting: "bg-purple-100 text-purple-700 border-purple-200",
  dispositioned: "bg-cyan-100 text-cyan-700 border-cyan-200",
  rma_completed: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  rma_cancelled: "bg-gray-100 text-gray-700 border-gray-200",
};

export default async function ReturnsPage() {
  const t = await getTranslations("tenant.returns");
  const rmas = await getRmas();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/returns/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("newReturn")}
          </Link>
        </Button>
      </PageHeader>

      {rmas.length === 0 ? (
        <EmptyState icon={RotateCcw} title={t("noReturns")} description={t("noReturnsDesc")}>
          <Button asChild>
            <Link href="/returns/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newReturn")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rmaNumber")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead>{t("orderNumber")}</TableHead>
                <TableHead>{t("reason")}</TableHead>
                <TableHead className="text-right">{t("lines")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("createdDate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {rmas.map((rma: any) => (
                <TableRow key={rma.id}>
                  <TableCell>
                    <Link
                      href={`/returns/${rma.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {rma.rmaNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{rma.client?.name ?? rma.client?.code ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {rma.order?.orderNumber ?? "-"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={rma.reason}>
                    {rma.reason}
                  </TableCell>
                  <TableCell className="text-right">
                    {rma._count?.lines ?? rma.lines?.length ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[rma.status] ?? ""}>
                      {rma.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(rma.createdAt), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
