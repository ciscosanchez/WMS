import { getShelfOptions } from "@/modules/warehouse/actions";
import { BinForm } from "../bin-form";

type ShelfOption = Awaited<ReturnType<typeof getShelfOptions>>[number];

export default async function NewBinPage() {
  const shelves = await getShelfOptions();

  return (
    <BinForm
      mode="create"
      shelves={shelves.map((shelf: ShelfOption) => ({
        id: shelf.id,
        warehouseCode: shelf.rack.aisle.zone.warehouse.code,
        warehouseName: shelf.rack.aisle.zone.warehouse.name,
        zoneCode: shelf.rack.aisle.zone.code,
        aisleCode: shelf.rack.aisle.code,
        rackCode: shelf.rack.code,
        shelfCode: shelf.code,
      }))}
    />
  );
}
