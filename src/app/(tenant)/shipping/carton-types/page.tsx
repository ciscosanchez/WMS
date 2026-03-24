import { getCartonTypes } from "@/modules/cartonization/actions";
import { deleteCartonType } from "@/modules/cartonization/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Boxes, Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function CartonTypesPage() {
  const t = await getTranslations("tenant.cartonization");
  const cartonTypes = await getCartonTypes();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/shipping/carton-types/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("newCartonType")}
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {cartonTypes.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={t("noCartonTypes")}
              description={t("noCartonTypesDesc")}
            >
              <Button asChild>
                <Link href="/shipping/carton-types/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("newCartonType")}
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("code")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("dimensions")}</TableHead>
                  <TableHead className="text-right">{t("maxWeight")}</TableHead>
                  <TableHead className="text-right">{t("tareWeight")}</TableHead>
                  <TableHead className="text-right">{t("materialCost")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartonTypes.map(
                  (carton: {
                    id: string;
                    code: string;
                    name: string;
                    length: number;
                    width: number;
                    height: number;
                    dimUnit: string;
                    maxWeight: number;
                    tareWeight: number;
                    weightUnit: string;
                    cost: number | null;
                  }) => (
                    <TableRow key={carton.id}>
                      <TableCell className="font-mono font-medium">{carton.code}</TableCell>
                      <TableCell>{carton.name}</TableCell>
                      <TableCell>
                        {carton.length} x {carton.width} x {carton.height} {carton.dimUnit}
                      </TableCell>
                      <TableCell className="text-right">
                        {carton.maxWeight} {carton.weightUnit}
                      </TableCell>
                      <TableCell className="text-right">
                        {carton.tareWeight} {carton.weightUnit}
                      </TableCell>
                      <TableCell className="text-right">
                        {carton.cost != null ? `$${carton.cost.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/shipping/carton-types/${carton.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <form
                            action={async () => {
                              "use server";
                              await deleteCartonType(carton.id);
                            }}
                          >
                            <Button variant="ghost" size="sm" type="submit">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </form>
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
