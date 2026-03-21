import { getBillingData } from "@/modules/platform/actions";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const data = await getBillingData();
  return <BillingClient data={data} />;
}
