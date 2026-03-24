import { getProductsForDropdown, getBinsForDropdown } from "@/modules/inventory/putaway-actions";
import { NewAdjustmentForm } from "./form";

export default async function NewAdjustmentPage() {
  const [products, bins] = await Promise.all([getProductsForDropdown(), getBinsForDropdown()]);

  return <NewAdjustmentForm products={products} bins={bins} />;
}
