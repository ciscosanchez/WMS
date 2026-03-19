import { IntegrationsClient } from "./_client";

export default function IntegrationsPage() {
  const shopifyConnected = !!(
    process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN
  );
  const amazonConnected = !!(
    process.env.AMAZON_CLIENT_ID &&
    process.env.AMAZON_REFRESH_TOKEN &&
    process.env.AMAZON_SELLER_ID
  );
  const netsuiteConnected = !!(
    process.env.NETSUITE_ACCOUNT_ID && process.env.NETSUITE_CONSUMER_KEY
  );
  const dispatchproConnected = !!(process.env.DISPATCHPRO_URL && process.env.DISPATCHPRO_API_KEY);

  return (
    <IntegrationsClient
      shopify={{
        connected: shopifyConnected,
        shopDomain: process.env.SHOPIFY_SHOP_DOMAIN ?? null,
      }}
      amazon={{ connected: amazonConnected, sellerId: process.env.AMAZON_SELLER_ID ?? null }}
      netsuite={{ connected: netsuiteConnected, accountId: process.env.NETSUITE_ACCOUNT_ID ?? null }}
      dispatchpro={{ connected: dispatchproConnected }}
    />
  );
}
