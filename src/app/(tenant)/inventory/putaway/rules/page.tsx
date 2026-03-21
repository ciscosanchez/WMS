import { getPutawayRules, getProductsForDropdown, getZonesForDropdown } from "@/modules/inventory/actions";
import { PutawayRulesClient } from "./rules-client";

export default async function PutawayRulesPage() {
  const [rules, products, zones] = await Promise.all([
    getPutawayRules(),
    getProductsForDropdown(),
    getZonesForDropdown(),
  ]);

  return <PutawayRulesClient initialRules={rules} products={products} zones={zones} />;
}
