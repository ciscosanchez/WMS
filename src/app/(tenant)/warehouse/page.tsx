import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWarehouses } from "@/modules/warehouse/actions";
import { getTranslations } from "next-intl/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeZoneBinCount(zone: any): number {
  return (
    zone.aisles?.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: number, a: any) =>
        s +
        (a.racks?.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (rs: number, r: any) =>
            rs +
            (r.shelves?.reduce(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (ss: number, sh: any) => ss + (sh.bins?.length ?? 0),
              0
            ) ?? 0),
          0
        ) ?? 0),
      0
    ) ??
    zone.binCount ??
    0
  );
}

export default async function WarehousePage() {
  const t = await getTranslations("tenant.warehouse");
  const warehouses = await getWarehouses();

  if (!warehouses || warehouses.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("noWarehouses")}>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/warehouse/bulk-generate">{t("bulkGenerate")}</Link>
            </Button>
            <Button asChild>
              <Link href="/warehouse/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("addWarehouse")}
              </Link>
            </Button>
          </div>
        </PageHeader>
        <div className="text-center py-12 text-muted-foreground">{t("noWarehousesDesc")}</div>
      </div>
    );
  }

  const totalBins = warehouses.reduce(
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (sum: number, wh: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sum + (wh.zones?.reduce((zs: number, z: any) => zs + computeZoneBinCount(z), 0) ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={`${warehouses.length} ${t("warehouses")}, ${totalBins} ${t("bins")}`}
      >
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/warehouse/bulk-generate">{t("bulkGenerate")}</Link>
          </Button>
          <Button asChild>
            <Link href="/warehouse/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("addWarehouse")}
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {warehouses.map((wh: any) => {
          const binCount =
            wh.zones?.reduce(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (s: number, z: any) => s + computeZoneBinCount(z),
              0
            ) ?? 0;
          return (
            <Link key={wh.id} href={`/warehouse/${wh.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{wh.name}</CardTitle>
                    <Badge variant="outline">{wh.code}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{wh.address}</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t("zones")}</p>
                      <p className="text-lg font-semibold">{wh.zones?.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("bins")}</p>
                      <p className="text-lg font-semibold">{binCount}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {wh.zones?.map((z: any) => (
                      <Badge key={z.id} variant="secondary">
                        {z.code} - {z.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
