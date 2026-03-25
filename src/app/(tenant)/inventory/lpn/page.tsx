import { getLpns } from "@/modules/lpn/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Container, Plus } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";

function formatLocation(bin: {
  code: string;
  shelf?: {
    code: string;
    rack?: {
      code: string;
      aisle?: {
        code: string;
        zone?: { code: string; warehouse?: { code: string } };
      };
    };
  };
}) {
  const parts = [
    bin.shelf?.rack?.aisle?.zone?.warehouse?.code,
    bin.shelf?.rack?.aisle?.zone?.code,
    bin.shelf?.rack?.aisle?.code,
    bin.shelf?.rack?.code,
    bin.shelf?.code,
    bin.code,
  ].filter(Boolean);
  return parts.join("-");
}

export default async function LpnPage() {
  const t = await getTranslations("tenant.lpn");
  const lpns = await getLpns();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/inventory/lpn/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("newLpn")}
          </Link>
        </Button>
      </PageHeader>

      {lpns.length === 0 ? (
        <EmptyState icon={Container} title={t("noLpns")} description={t("noLpnsDesc")}>
          <Button asChild>
            <Link href="/inventory/lpn/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newLpn")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("lpnNumber")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("palletType")}</TableHead>
                <TableHead>{t("location")}</TableHead>
                <TableHead>{t("contents")}</TableHead>
                <TableHead>{t("weight")}</TableHead>
                <TableHead>{t("created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {lpns.map((lpn: any) => (
                <TableRow key={lpn.id}>
                  <TableCell className="font-medium font-mono">{lpn.lpnNumber}</TableCell>
                  <TableCell>
                    <StatusBadge status={lpn.status} />
                  </TableCell>
                  <TableCell className="capitalize">{lpn.palletType || "-"}</TableCell>
                  <TableCell>{lpn.bin ? formatLocation(lpn.bin) : "-"}</TableCell>
                  <TableCell>
                    {lpn.contents?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lpn.contents.slice(0, 3).map((c: any) => (
                          <Badge key={c.id} variant="secondary" className="text-xs">
                            {c.product?.sku} x{c.quantity}
                          </Badge>
                        ))}
                        {lpn.contents.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{lpn.contents.length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{lpn.totalWeight ? `${lpn.totalWeight} lb` : "-"}</TableCell>
                  <TableCell>{format(new Date(lpn.createdAt), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
