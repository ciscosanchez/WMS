import { getYardSpots } from "@/modules/yard-dock/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

const typeBadgeColors: Record<string, string> = {
  parking: "bg-blue-100 text-blue-700",
  staging: "bg-purple-100 text-purple-700",
  refrigerated: "bg-cyan-100 text-cyan-700",
  hazmat: "bg-red-100 text-red-700",
};

const statusBadgeColors: Record<string, string> = {
  empty: "bg-green-100 text-green-700",
  occupied: "bg-red-100 text-red-700",
  reserved: "bg-yellow-100 text-yellow-700",
  blocked: "bg-gray-100 text-gray-500",
};

export default async function YardSpotsPage() {
  const t = await getTranslations("tenant.yardDock");
  const spots = await getYardSpots();

  return (
    <div className="space-y-6">
      <PageHeader title={t("yardSpots")} description={t("yardSpotsDesc")}>
        <Button asChild>
          <Link href="/yard-dock/yard-spots/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("newYardSpot")}
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {spots.length === 0 ? (
            <EmptyState icon={MapPin} title={t("noYardSpots")} description={t("noYardSpotsDesc")}>
              <Button asChild>
                <Link href="/yard-dock/yard-spots/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("newYardSpot")}
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("code")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("row")}</TableHead>
                  <TableHead>{t("col")}</TableHead>
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spots.map(
                  (spot: {
                    id: string;
                    code: string;
                    name: string;
                    type: string;
                    status: string;
                    row: number | null;
                    col: number | null;
                    warehouse: { code: string; name: string } | null;
                    yardVisits: unknown[];
                  }) => (
                    <TableRow key={spot.id}>
                      <TableCell className="font-mono font-medium">{spot.code}</TableCell>
                      <TableCell>{spot.name}</TableCell>
                      <TableCell>
                        <Badge
                          className={typeBadgeColors[spot.type] ?? "bg-gray-100 text-gray-700"}
                        >
                          {spot.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={statusBadgeColors[spot.status] ?? "bg-gray-100 text-gray-700"}
                        >
                          {spot.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{spot.row ?? "—"}</TableCell>
                      <TableCell>{spot.col ?? "—"}</TableCell>
                      <TableCell>
                        {spot.warehouse ? `${spot.warehouse.code} - ${spot.warehouse.name}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/yard-dock/yard-spots/${spot.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
