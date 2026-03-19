import { getBillingConfig, getInvoices } from "@/modules/billing/actions";
import BillingConfigClient from "./_client";

export default async function BillingConfigPage() {
  const [config, invoices] = await Promise.all([getBillingConfig(), getInvoices()]);
  return (
    <BillingConfigClient
      defaultRateCard={config.defaultCard}
      clients={config.clients}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoices={invoices as any}
    />
  );
}
