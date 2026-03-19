import { getBillingConfig } from "@/modules/billing/actions";
import BillingConfigClient from "./_client";

export default async function BillingConfigPage() {
  const config = await getBillingConfig();
  return <BillingConfigClient defaultRateCard={config.defaultCard} clients={config.clients} />;
}
