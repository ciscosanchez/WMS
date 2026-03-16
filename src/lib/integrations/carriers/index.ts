/**
 * Carrier Integrations — Barrel Export & Factory
 *
 * Exports all carrier adapters and provides a factory function
 * to create a RateShopEngine from configuration.
 */

export type {
  CarrierAdapter,
  RateRequest,
  RateQuote,
  LabelRequest,
  LabelResult,
  TrackingResult,
  TrackingEvent,
} from "./types";
export { RateShopEngine } from "./rate-shop";
export { UPSAdapter } from "./ups";
export type { UPSConfig } from "./ups";
export { FedExAdapter } from "./fedex";
export type { FedExConfig } from "./fedex";
export { USPSAdapter } from "./usps";
export type { USPSConfig } from "./usps";

import { RateShopEngine } from "./rate-shop";
import { UPSAdapter } from "./ups";
import { FedExAdapter } from "./fedex";
import { USPSAdapter } from "./usps";

/**
 * Configuration for a single carrier account.
 */
export type CarrierConfig = {
  carrier: "ups" | "fedex" | "usps";
  credentials: Record<string, string>;
  enabled: boolean;
};

/**
 * Creates a RateShopEngine with adapters registered based on the provided config.
 *
 * @example
 * ```ts
 * const engine = createRateShopEngine([
 *   {
 *     carrier: "ups",
 *     credentials: { accountNumber: "A1B2C3", accessKey: "...", userId: "...", password: "..." },
 *     enabled: true,
 *   },
 *   {
 *     carrier: "fedex",
 *     credentials: { clientId: "...", clientSecret: "...", accountNumber: "..." },
 *     enabled: true,
 *   },
 *   {
 *     carrier: "usps",
 *     credentials: { userId: "..." },
 *     enabled: false, // skipped
 *   },
 * ]);
 *
 * const rates = await engine.getRates(request);
 * ```
 */
export function createRateShopEngine(configs: CarrierConfig[]): RateShopEngine {
  const engine = new RateShopEngine();

  for (const config of configs) {
    if (!config.enabled) continue;

    switch (config.carrier) {
      case "ups":
        engine.registerAdapter(
          new UPSAdapter({
            accountNumber: config.credentials.accountNumber ?? "",
            accessKey: config.credentials.accessKey ?? "",
            userId: config.credentials.userId ?? "",
            password: config.credentials.password ?? "",
            useSandbox: config.credentials.useSandbox === "true",
          })
        );
        break;

      case "fedex":
        engine.registerAdapter(
          new FedExAdapter({
            clientId: config.credentials.clientId ?? "",
            clientSecret: config.credentials.clientSecret ?? "",
            accountNumber: config.credentials.accountNumber ?? "",
            useSandbox: config.credentials.useSandbox === "true",
          })
        );
        break;

      case "usps":
        engine.registerAdapter(
          new USPSAdapter({
            userId: config.credentials.userId ?? "",
            useSandbox: config.credentials.useSandbox === "true",
          })
        );
        break;

      default:
        console.warn(`Unknown carrier: ${(config as CarrierConfig).carrier}`);
    }
  }

  return engine;
}
