import { getCustomsEntries, getBondedInventory } from "@/modules/customs/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { FileCheck, Anchor, Package } from "lucide-react";
import { getTranslations } from "next-intl/server";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function formatCurrency(v: number | string | null | undefined) {
  if (v == null) return "—";
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function CustomsPage() {
  const t = await getTranslations("tenant.customs");
  const [entries, bondedRecords] = await Promise.all([getCustomsEntries(), getBondedInventory()]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalEntries")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("pendingClearance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {
                entries.filter(
                  (e: { status: string }) => e.status === "ce_filed" || e.status === "ce_held"
                ).length
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("bondedItems")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {bondedRecords.filter((r: { releaseDate: Date | null }) => !r.releaseDate).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Customs Entries Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {t("entries")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState icon={Anchor} title={t("noEntries")} description={t("noEntriesDesc")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("entryNumber")}</TableHead>
                  <TableHead>{t("entryType")}</TableHead>
                  <TableHead>{t("portOfEntry")}</TableHead>
                  <TableHead>{t("carrier")}</TableHead>
                  <TableHead>{t("broker")}</TableHead>
                  <TableHead>{t("totalDuty")}</TableHead>
                  <TableHead>{t("eta")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  entries as Array<{
                    id: string;
                    entryNumber: string | null;
                    entryType: string;
                    portOfEntry: string | null;
                    carrier: string | null;
                    brokerName: string | null;
                    totalDuty: number | null;
                    estimatedArrival: Date | null;
                    status: string;
                    lines: Array<{ id: string }>;
                  }>
                ).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.entryNumber ?? "—"}</TableCell>
                    <TableCell>{entry.entryType}</TableCell>
                    <TableCell>{entry.portOfEntry ?? "—"}</TableCell>
                    <TableCell>{entry.carrier ?? "—"}</TableCell>
                    <TableCell>{entry.brokerName ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(entry.totalDuty)}</TableCell>
                    <TableCell>{formatDate(entry.estimatedArrival)}</TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Bonded Inventory Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("bondedInventory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bondedRecords.length === 0 ? (
            <EmptyState icon={Package} title={t("noBonded")} description={t("noBondedDesc")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("bondNumber")}</TableHead>
                  <TableHead>{t("bondType")}</TableHead>
                  <TableHead>{t("productId")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead>{t("entryDate")}</TableHead>
                  <TableHead>{t("releaseDate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  bondedRecords as Array<{
                    id: string;
                    bondNumber: string | null;
                    bondType: string | null;
                    productId: string;
                    quantity: number;
                    entryDate: Date;
                    releaseDate: Date | null;
                  }>
                ).map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono">{record.bondNumber ?? "—"}</TableCell>
                    <TableCell>{record.bondType ?? "—"}</TableCell>
                    <TableCell className="font-mono">{record.productId}</TableCell>
                    <TableCell className="text-right">{record.quantity}</TableCell>
                    <TableCell>{formatDate(record.entryDate)}</TableCell>
                    <TableCell>{formatDate(record.releaseDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
