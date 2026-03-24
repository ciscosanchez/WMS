import { getPendingPutawayItems, getBinsForDropdown } from "@/modules/inventory/actions";
import { PutawayClient } from "./putaway-client";

export default async function PutawayPage() {
  const [pendingItems, bins] = await Promise.all([getPendingPutawayItems(), getBinsForDropdown()]);

  return <PutawayClient initialPending={pendingItems} bins={bins} />;
}
