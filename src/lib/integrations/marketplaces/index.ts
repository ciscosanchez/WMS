import type { MarketplaceAdapter } from "./types";
import { ShopifyAdapter } from "./shopify";
import { AmazonAdapter } from "./amazon";

export { ShopifyAdapter } from "./shopify";
export { AmazonAdapter } from "./amazon";

export type ChannelType = "shopify" | "amazon" | "walmart" | "manual" | "api";

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
        region: "us-east-1",
      });
    default:
      return null;
  }
}
