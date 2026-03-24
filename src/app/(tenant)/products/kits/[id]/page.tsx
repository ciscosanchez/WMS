import { getKitDefinition } from "@/modules/vas/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Puzzle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KitDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("tenant.vas");
  const kit = await getKitDefinition(id);

  if (!kit) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={kit.name}
        description={`${t("kitDefinition")} — ${kit.product?.sku ?? ""}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/products/kits">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToKits")}
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5" />
              {t("kitDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("kitName")}</p>
                <p className="font-medium">{kit.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">SKU</p>
                <p className="font-mono font-medium">{kit.product?.sku ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("productName")}</p>
                <p className="font-medium">{kit.product?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("status")}</p>
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
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("components")}</CardTitle>
          </CardHeader>
          <CardContent>
            {kit.components?.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noComponents")}</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("componentProduct")}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">{t("componentQty")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {kit.components.map((comp: any) => (
                      <TableRow key={comp.id}>
                        <TableCell className="font-medium">{comp.product?.name ?? "-"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {comp.product?.sku ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">{comp.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
