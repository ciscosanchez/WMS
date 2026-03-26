import { getBins } from "@/modules/warehouse/actions";
import { getProducts } from "@/modules/products/actions";
import { getOperationalAttributeDefinitions } from "@/modules/attributes/actions";
import { NewLpnClient } from "./new-lpn-client";

export default async function NewLpnPage() {
  const [bins, products, attributeDefinitions] = await Promise.all([
    getBins(),
    getProducts(),
    getOperationalAttributeDefinitions("lpn", "inventory:write"),
  ]);

  return (
    <NewLpnClient
      bins={bins.map((bin: any) => ({
        id: bin.id,
        code: bin.code,
      }))}
      products={products.map((product: any) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
      }))}
      attributeDefinitions={attributeDefinitions.map((definition: any) => ({
        id: definition.id,
        label: definition.label,
        description: definition.description ?? null,
        dataType: definition.dataType,
        options: definition.options ?? [],
      }))}
    />
  );
}
