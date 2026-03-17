import { getShipment } from "@/modules/receiving/actions";
import { ShipmentDetail } from "@/components/receiving/shipment-detail";
import { notFound } from "next/navigation";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await getShipment(id);
  if (!shipment) notFound();
  return <ShipmentDetail shipment={shipment} />;
}
