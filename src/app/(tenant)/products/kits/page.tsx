import { getKitDefinitions } from "@/modules/vas/actions";
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
import { Plus, Puzzle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";

export default async function KitsPage() {
  const t = await getTranslations("tenant.vas");
  const kits = await getKitDefinitions();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/products/kits/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("newKit")}
          </Link>
        </Button>
      </PageHeader>

      {kits.length === 0 ? (
        <EmptyState icon={Puzzle} title={t("noKits")} description={t("noKitsDesc")}>
          <Button asChild>
            <Link href="/products/kits/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newKit")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("kitName")}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">{t("components")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {kits.map((kit: any) => (
                <TableRow key={kit.id}>
                  <TableCell>
                    <Link
                      href={`/products/kits/${kit.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {kit.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{kit.product?.sku ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    {kit._count?.components ?? kit.components?.length ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        kit.isActive
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }
                    >
                      {kit.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(kit.createdAt), "MMM d, yyyy")}
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
