import type { MarketplaceAdapter } from "./types";
import { ShopifyAdapter } from "./shopify";
import { AmazonAdapter } from "./amazon";
import { WalmartAdapter } from "./walmart";
import { BigCommerceAdapter } from "./bigcommerce";

export { ShopifyAdapter } from "./shopify";
export { AmazonAdapter } from "./amazon";
export { WalmartAdapter } from "./walmart";
export { BigCommerceAdapter } from "./bigcommerce";

export type ChannelType = "shopify" | "amazon" | "walmart" | "bigcommerce" | "manual" | "api";

export interface ChannelConfig {
  type: ChannelType;
  name: string;
  credentials: Record<string, string>;
  enabled: boolean;
}

export function createAdapter(config: ChannelConfig): MarketplaceAdapter | null {
  switch (config.type) {
    case "shopify":
      return new ShopifyAdapter({
        shopDomain: config.credentials.shopDomain || "",
        accessToken: config.credentials.accessToken || "",
        apiVersion: config.credentials.apiVersion || "2024-10",
        locationId: config.credentials.locationId,
      });
    case "amazon":
      return new AmazonAdapter({
        sellerId: config.credentials.sellerId || "",
        marketplaceId: config.credentials.marketplaceId || "ATVPDKIKX0DER",
        refreshToken: config.credentials.refreshToken || "",
        clientId: config.credentials.clientId || "",
        clientSecret: config.credentials.clientSecret || "",
        awsAccessKeyId: config.credentials.awsAccessKeyId || "",
        awsSecretAccessKey: config.credentials.awsSecretAccessKey || "",
        region: "us-east-1",
      });
    case "walmart":
      return new WalmartAdapter({
        clientId: config.credentials.clientId || "",
        clientSecret: config.credentials.clientSecret || "",
        environment: (config.credentials.environment as "production" | "sandbox") ?? "production",
      });
    case "bigcommerce":
      return new BigCommerceAdapter({
        storeHash: config.credentials.storeHash || "",
        accessToken: config.credentials.accessToken || "",
      });
    default:
      return null;
  }
}
