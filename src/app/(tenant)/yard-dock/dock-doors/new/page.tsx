import { getWarehouses } from "@/modules/warehouse/actions";
import { DockDoorForm } from "../dock-door-form";

export default async function NewDockDoorPage() {
  const warehouses = await getWarehouses();

  return (
    <DockDoorForm
      mode="create"
      warehouses={warehouses.map((warehouse) => ({
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
      }))}
    />
  );
}
