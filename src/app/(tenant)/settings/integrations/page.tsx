import { IntegrationsClient } from "./_client";
import { getIntegrationStatuses } from "@/modules/settings/integration-status";

export default async function IntegrationsPage() {
  const statuses = await getIntegrationStatuses();

  return (
    <IntegrationsClient
      shopify={{
        connected: statuses.shopify.connected,
        shopDomain: statuses.shopify.connected ? statuses.shopify.detail : null,
      }}
      amazon={{
        connected: statuses.amazon.connected,
        sellerId: statuses.amazon.connected ? statuses.amazon.detail : null,
      }}
      netsuite={{
        connected: statuses.netsuite.connected,
        accountId: statuses.netsuite.connected ? statuses.netsuite.detail : null,
      }}
      dispatchpro={{ connected: statuses.dispatchpro.connected }}
    />
  );
}
