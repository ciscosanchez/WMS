import { getEdiPartners } from "@/modules/settings/actions";
import { EdiClient } from "./edi-client";

export default async function EDIConfigurationPage() {
  const partners = await getEdiPartners();
  return <EdiClient initialPartners={partners} />;
}
