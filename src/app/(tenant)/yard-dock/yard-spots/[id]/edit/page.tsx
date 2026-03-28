import { notFound } from "next/navigation";
import { getYardSpot } from "@/modules/yard-dock/actions";
import { YardSpotForm } from "../../yard-spot-form";

interface EditYardSpotPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditYardSpotPage({ params }: EditYardSpotPageProps) {
  const { id } = await params;
  const spot = await getYardSpot(id);

  if (!spot) {
    notFound();
  }

  return (
    <YardSpotForm
      mode="edit"
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
