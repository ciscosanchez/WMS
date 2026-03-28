import { getProducts } from "@/modules/products/actions";
import { KitForm } from "./kit-form";

type ProductOption = Awaited<ReturnType<typeof getProducts>>[number];

export default async function NewKitPage() {
  const products = await getProducts();

  return (
    <KitForm
      products={products.map((product: ProductOption) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
      }))}
    />
  );
}
