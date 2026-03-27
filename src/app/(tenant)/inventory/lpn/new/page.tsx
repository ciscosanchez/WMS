import { getBins } from "@/modules/warehouse/actions";
import { getProducts } from "@/modules/products/actions";
import { getOperationalAttributeDefinitions } from "@/modules/attributes/actions";
import { NewLpnClient } from "./new-lpn-client";

type BinOption = Awaited<ReturnType<typeof getBins>>[number];
type ProductOption = Awaited<ReturnType<typeof getProducts>>[number];
type AttributeDefinition = Awaited<ReturnType<typeof getOperationalAttributeDefinitions>>[number];

export default async function NewLpnPage() {
  const [bins, products, attributeDefinitions] = await Promise.all([
    getBins(),
    getProducts(),
    getOperationalAttributeDefinitions("lpn", "inventory:write"),
  ]);

  return (
    <NewLpnClient
      bins={bins.map((bin: BinOption) => ({
        id: bin.id,
        code: bin.code,
      }))}
      products={products.map((product: ProductOption) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
      }))}
      attributeDefinitions={attributeDefinitions.map((definition: AttributeDefinition) => ({
        id: definition.id,
        key: definition.key,
        label: definition.label,
        description: definition.description ?? null,
        dataType: definition.dataType,
        isRequired: definition.isRequired,
        options: definition.options ?? [],
      }))}
    />
  );
}
