/**
 * Carrier configuration from environment variables.
 * Set these in .env to enable real API calls.
 * When not set, carriers return mock data.
 */

export interface CarrierCredentials {
  ups: {
    clientId: string;
    clientSecret: string;
    accountNumber: string;
    useSandbox: boolean;
  } | null;
  fedex: {
    clientId: string;
    clientSecret: string;
    accountNumber: string;
    useSandbox: boolean;
  } | null;
  usps: {
    userId: string;
    useSandbox: boolean;
  } | null;
}

export function getCarrierCredentials(): CarrierCredentials {
  return {
    ups: process.env.UPS_CLIENT_ID
      ? {
          clientId: process.env.UPS_CLIENT_ID,
          clientSecret: process.env.UPS_CLIENT_SECRET || "",
          accountNumber: process.env.UPS_ACCOUNT_NUMBER || "",
          useSandbox: process.env.UPS_SANDBOX !== "false",
        }
      : null,
    fedex: process.env.FEDEX_CLIENT_ID
      ? {
          clientId: process.env.FEDEX_CLIENT_ID,
          clientSecret: process.env.FEDEX_CLIENT_SECRET || "",
          accountNumber: process.env.FEDEX_ACCOUNT_NUMBER || "",
          useSandbox: process.env.FEDEX_SANDBOX !== "false",
        }
      : null,
    usps: process.env.USPS_USER_ID
      ? {
          userId: process.env.USPS_USER_ID,
          useSandbox: process.env.USPS_SANDBOX !== "false",
        }
      : null,
  };
}

export function getShopifyCredentials() {
  if (!process.env.SHOPIFY_SHOP_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) return null;
  return {
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION || "2024-10",
    locationId: process.env.SHOPIFY_LOCATION_ID,
  };
}

export function getNetSuiteCredentials() {
  if (!process.env.NETSUITE_ACCOUNT_ID) return null;
  return {
    accountId: process.env.NETSUITE_ACCOUNT_ID,
    consumerKey: process.env.NETSUITE_CONSUMER_KEY || "",
    consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || "",
    tokenId: process.env.NETSUITE_TOKEN_ID || "",
    tokenSecret: process.env.NETSUITE_TOKEN_SECRET || "",
    baseUrl: `https://${process.env.NETSUITE_ACCOUNT_ID}.suitetalk.api.netsuite.com`,
  };
}
