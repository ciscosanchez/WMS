import { notFound } from "next/navigation";
import { BinForm } from "../../bin-form";
import { getBin, getShelfOptions } from "@/modules/warehouse/actions";

type ShelfOption = Awaited<ReturnType<typeof getShelfOptions>>[number];

interface EditBinPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBinPage({ params }: EditBinPageProps) {
  const { id } = await params;
  const [bin, shelves] = await Promise.all([getBin(id), getShelfOptions()]);

  if (!bin) {
    notFound();
  }

  return (
    <BinForm
      mode="edit"
      binId={bin.id}
      shelves={shelves.map((shelf: ShelfOption) => ({
        id: shelf.id,
        warehouseCode: shelf.rack.aisle.zone.warehouse.code,
        warehouseName: shelf.rack.aisle.zone.warehouse.name,
        zoneCode: shelf.rack.aisle.zone.code,
        aisleCode: shelf.rack.aisle.code,
        rackCode: shelf.rack.code,
        shelfCode: shelf.code,
      }))}
      initialValues={{
        shelfId: bin.shelfId,
        code: bin.code,
        barcode: bin.barcode,
        type: bin.type,
        status: bin.status,
        capacity: bin.capacity?.toString() ?? "",
      }}
    />
  );
}
