import { getDockDoors } from "@/modules/yard-dock/actions";
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
import { DoorOpen, Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

const typeBadgeColors: Record<string, string> = {
  inbound: "bg-blue-100 text-blue-700",
  outbound: "bg-orange-100 text-orange-700",
  both: "bg-purple-100 text-purple-700",
};

const statusBadgeColors: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  occupied: "bg-red-100 text-red-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  blocked: "bg-gray-100 text-gray-500",
};

export default async function DockDoorsPage() {
  const t = await getTranslations("tenant.yardDock");
  const doors = await getDockDoors();

  return (
    <div className="space-y-6">
      <PageHeader title={t("dockDoors")} description={t("dockDoorsDesc")}>
        <Button asChild>
          <Link href="/yard-dock/dock-doors/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("newDockDoor")}
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {doors.length === 0 ? (
            <EmptyState icon={DoorOpen} title={t("noDockDoors")} description={t("noDockDoorsDesc")}>
              <Button asChild>
                <Link href="/yard-dock/dock-doors/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("newDockDoor")}
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
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doors.map(
                  (door: {
                    id: string;
                    code: string;
                    name: string;
                    type: string;
                    status: string;
                    warehouse: { code: string; name: string } | null;
                  }) => (
                    <TableRow key={door.id}>
                      <TableCell className="font-mono font-medium">{door.code}</TableCell>
                      <TableCell>{door.name}</TableCell>
                      <TableCell>
                        <Badge
                          className={typeBadgeColors[door.type] ?? "bg-gray-100 text-gray-700"}
                        >
                          {door.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={statusBadgeColors[door.status] ?? "bg-gray-100 text-gray-700"}
                        >
                          {door.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {door.warehouse ? `${door.warehouse.code} - ${door.warehouse.name}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/yard-dock/dock-doors/${door.id}/edit`}>
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
