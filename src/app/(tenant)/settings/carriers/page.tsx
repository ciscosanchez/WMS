import { getCarrierSettings } from "@/modules/settings/actions";
import { CarriersClient } from "./carriers-client";

export default async function CarrierAccountsPage() {
  const carrierCreds = await getCarrierSettings();
  return <CarriersClient initialCreds={carrierCreds} />;
}
