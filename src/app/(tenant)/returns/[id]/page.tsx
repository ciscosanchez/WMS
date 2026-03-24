import { notFound } from "next/navigation";
import { getRma, updateRmaStatus, finalizeReturn } from "@/modules/returns/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RotateCcw, User, Calendar, FileText, Package, ClipboardCheck } from "lucide-react";
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

const DISPOSITION_COLORS: Record<string, string> = {
  restock: "bg-green-100 text-green-700",
  quarantine: "bg-yellow-100 text-yellow-700",
  dispose: "bg-red-100 text-red-700",
  repair: "bg-blue-100 text-blue-700",
};

interface StatusAction {
  targetStatus: string;
  label: string;
  variant?: "default" | "destructive" | "outline";
  useFinalizeReturn?: boolean;
}

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  requested: [
    { targetStatus: "approved", label: "approve" },
    { targetStatus: "rejected", label: "reject", variant: "destructive" },
  ],
  in_transit: [{ targetStatus: "received", label: "markReceived" }],
  received: [{ targetStatus: "inspecting", label: "startInspection" }],
  dispositioned: [{ targetStatus: "rma_completed", label: "finalize", useFinalizeReturn: true }],
};

export default async function RmaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("tenant.returns");
  const rma = await getRma(id);

  if (!rma) {
    notFound();
  }

  const actions = STATUS_ACTIONS[rma.status] ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={rma.rmaNumber}>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={STATUS_COLORS[rma.status] ?? ""}>
            {rma.status.replace(/_/g, " ")}
          </Badge>
          {actions.map((action) => (
            <form
              key={action.targetStatus}
              action={async () => {
                "use server";
                if (action.useFinalizeReturn) {
                  await finalizeReturn(id);
                } else {
                  await updateRmaStatus(id, action.targetStatus);
                }
              }}
            >
              <Button type="submit" variant={action.variant ?? "default"}>
                {t(action.label)}
              </Button>
            </form>
          ))}
        </div>
      </PageHeader>

      {/* Header Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("rmaNumber")}</span>
            </div>
            <p className="mt-1 font-medium">{rma.rmaNumber}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("client")}</span>
            </div>
            <p className="mt-1 font-medium">{rma.client?.name ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("orderNumber")}</span>
            </div>
            <p className="mt-1 font-medium">
              {rma.order ? (
                <Link href={`/orders/${rma.order.id}`} className="text-primary hover:underline">
                  {rma.order.orderNumber}
                </Link>
              ) : (
                "-"
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("createdDate")}</span>
            </div>
            <p className="mt-1 font-medium">{format(new Date(rma.createdAt), "MMM d, yyyy")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reason & Notes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("reason")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{rma.reason}</p>
          </CardContent>
        </Card>
        {rma.notes && (
          <Card>
            <CardHeader>
              <CardTitle>{t("notes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{rma.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Metadata: requested/approved by, dates */}
      <div className="grid gap-4 md:grid-cols-4">
        {rma.requestedBy && (
          <Card>
            <CardContent className="pt-6">
              <span className="text-sm text-muted-foreground">{t("requestedBy")}</span>
              <p className="mt-1 text-sm font-medium">{rma.requestedBy}</p>
            </CardContent>
          </Card>
        )}
        {rma.approvedBy && (
          <Card>
            <CardContent className="pt-6">
              <span className="text-sm text-muted-foreground">{t("approvedBy")}</span>
              <p className="mt-1 text-sm font-medium">{rma.approvedBy}</p>
            </CardContent>
          </Card>
        )}
        {rma.approvedAt && (
          <Card>
            <CardContent className="pt-6">
              <span className="text-sm text-muted-foreground">{t("approvedDate")}</span>
              <p className="mt-1 text-sm font-medium">
                {format(new Date(rma.approvedAt), "MMM d, yyyy")}
              </p>
            </CardContent>
          </Card>
        )}
        {rma.receivedAt && (
          <Card>
            <CardContent className="pt-6">
              <span className="text-sm text-muted-foreground">{t("receivedDate")}</span>
              <p className="mt-1 text-sm font-medium">
                {format(new Date(rma.receivedAt), "MMM d, yyyy")}
              </p>
            </CardContent>
          </Card>
        )}
        {rma.completedAt && (
          <Card>
            <CardContent className="pt-6">
              <span className="text-sm text-muted-foreground">{t("completedDate")}</span>
              <p className="mt-1 text-sm font-medium">
                {format(new Date(rma.completedAt), "MMM d, yyyy")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Return Lines Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("returnLines")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sku")}</TableHead>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="text-right">{t("expectedQty")}</TableHead>
                  <TableHead className="text-right">{t("receivedQty")}</TableHead>
                  <TableHead>{t("disposition")}</TableHead>
                  <TableHead className="text-right">{t("dispositionQty")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(rma.lines ?? []).map((line: any) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-xs">{line.product?.sku ?? "-"}</TableCell>
                    <TableCell>{line.product?.name ?? "-"}</TableCell>
                    <TableCell className="text-right">{line.expectedQty}</TableCell>
                    <TableCell className="text-right">{line.receivedQty ?? 0}</TableCell>
                    <TableCell>
                      {line.disposition ? (
                        <Badge
                          variant="outline"
                          className={DISPOSITION_COLORS[line.disposition] ?? ""}
                        >
                          {line.disposition}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{line.dispositionQty ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Inspections */}
      {rma.inspections && rma.inspections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {t("inspections")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-right">{t("quantity")}</TableHead>
                    <TableHead>{t("condition")}</TableHead>
                    <TableHead>{t("disposition")}</TableHead>
                    <TableHead>{t("inspector")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {rma.inspections.map((insp: any) => (
                    <TableRow key={insp.id}>
                      <TableCell className="font-mono text-xs">
                        {insp.line?.product?.sku ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">{insp.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{insp.condition}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={DISPOSITION_COLORS[insp.disposition] ?? ""}
                        >
                          {insp.disposition}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{insp.inspectedBy ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {insp.inspectedAt ? format(new Date(insp.inspectedAt), "MMM d, yyyy") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
