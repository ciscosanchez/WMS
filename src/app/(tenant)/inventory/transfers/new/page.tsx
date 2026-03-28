import { getWarehouses } from "@/modules/warehouse/actions";
import { getProducts } from "@/modules/products/actions";
import { NewTransferClient } from "./new-transfer-client";

type WarehouseOption = Awaited<ReturnType<typeof getWarehouses>>[number];
type ProductOption = Awaited<ReturnType<typeof getProducts>>[number];

export default async function NewTransferPage() {
  const [warehouses, products] = await Promise.all([getWarehouses(), getProducts()]);

  return (
    <NewTransferClient
      warehouses={warehouses.map((warehouse: WarehouseOption) => ({
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
      }))}
      products={products.map((product: ProductOption) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
      }))}
    />
  );
}
