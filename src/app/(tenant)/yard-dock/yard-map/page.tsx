import { getYardSpots } from "@/modules/yard-dock/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { YardMapGrid } from "./yard-map-grid";

export default async function YardMapPage() {
  const t = await getTranslations("tenant.yardDock");
  const spots = await getYardSpots();

  return (
    <div className="space-y-6">
      <PageHeader title={t("yardMap")} description={t("yardMapSubtitle")} />

      <Card>
        <CardContent className="pt-6">
          {spots.length === 0 ? (
            <EmptyState icon={MapPin} title={t("noYardSpots")} description={t("noYardSpotsDesc")} />
          ) : (
            <YardMapGrid
              spots={spots.map(
                (spot: {
                  id: string;
                  code: string;
                  name: string;
                  status: string;
                  type: string;
                  row: number | null;
                  col: number | null;
                  yardVisits: { id: string; trailerNumber: string; status: string }[];
                }) => ({
                  id: spot.id,
                  code: spot.code,
                  name: spot.name,
                  status: spot.status,
                  type: spot.type,
                  row: spot.row,
                  col: spot.col,
                  yardVisits: spot.yardVisits,
                })
              )}
              labels={{
                empty: t("spotEmpty"),
                occupied: t("spotOccupied"),
                reserved: t("spotReserved"),
                blocked: t("spotBlocked"),
                trailer: t("trailer"),
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
