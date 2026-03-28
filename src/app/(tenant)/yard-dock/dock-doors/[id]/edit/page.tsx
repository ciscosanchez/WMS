import { notFound } from "next/navigation";
import { DockDoorForm } from "../../dock-door-form";
import { getDockDoor } from "@/modules/yard-dock/actions";
import { getWarehouses } from "@/modules/warehouse/actions";

interface EditDockDoorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDockDoorPage({ params }: EditDockDoorPageProps) {
  const { id } = await params;
  const [door, warehouses] = await Promise.all([getDockDoor(id), getWarehouses()]);

  if (!door) {
    notFound();
  }

  return (
    <DockDoorForm
      mode="edit"
      warehouses={warehouses.map((warehouse) => ({
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
      }))}
      dockDoorId={door.id}
      initialValues={{
        code: door.code,
        name: door.name,
        warehouseId: door.warehouseId,
        type: door.type,
        notes: door.notes ?? "",
      }}
    />
  );
}
