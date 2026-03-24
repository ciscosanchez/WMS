import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { getDiscrepancies } from "@/modules/receiving/actions";
import { getTranslations } from "next-intl/server";

type Discrepancy = Awaited<ReturnType<typeof getDiscrepancies>>[number];

export default async function DiscrepanciesPage() {
  const t = await getTranslations("tenant.receiving");
  const discrepancies = await getDiscrepancies();

  return (
    <div className="space-y-6">
      <PageHeader title={t("discrepancies")} description={t("discrepanciesDesc")} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("shipment")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("description")}</TableHead>
              <TableHead>{t("expected")}</TableHead>
              <TableHead>{t("actual")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("created")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discrepancies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t("noDiscrepancies")}
                </TableCell>
              </TableRow>
            ) : (
              discrepancies.map((d: Discrepancy) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.shipment?.shipmentNumber ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.type} />
                  </TableCell>
                  <TableCell>{d.description}</TableCell>
                  <TableCell>{d.expectedQty ?? "-"}</TableCell>
                  <TableCell>{d.actualQty ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell>{format(d.createdAt, "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
