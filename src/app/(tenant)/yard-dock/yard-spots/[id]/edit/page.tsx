import { notFound } from "next/navigation";
import { getYardSpot } from "@/modules/yard-dock/actions";
import { YardSpotForm } from "../../yard-spot-form";
import { getWarehouses } from "@/modules/warehouse/actions";

interface EditYardSpotPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditYardSpotPage({ params }: EditYardSpotPageProps) {
  const { id } = await params;
  const [spot, warehouses] = await Promise.all([getYardSpot(id), getWarehouses()]);

  if (!spot) {
    notFound();
  }

  return (
    <YardSpotForm
      mode="edit"
      warehouses={warehouses.map((warehouse) => ({
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
      }))}
      yardSpotId={spot.id}
      initialValues={{
        code: spot.code,
        name: spot.name,
        warehouseId: spot.warehouseId,
        type: spot.type,
        row: spot.row?.toString() ?? "",
        col: spot.col?.toString() ?? "",
        notes: spot.notes ?? "",
      }}
    />
  );
}
