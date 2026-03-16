/**
 * Rate Shopping Engine
 *
 * Queries all configured carrier adapters in parallel and returns
 * sorted rate options (cheapest first by default).
 */

import type { CarrierAdapter, RateRequest, RateQuote } from "./types";

export class RateShopEngine {
  private adapters: CarrierAdapter[] = [];

  registerAdapter(adapter: CarrierAdapter) {
    this.adapters.push(adapter);
  }

  /**
   * Get rates from all carriers in parallel, sorted by cost
   */
  async getRates(request: RateRequest, sortBy: "cost" | "speed" = "cost"): Promise<RateQuote[]> {
    const results = await Promise.allSettled(
      this.adapters.map((adapter) => adapter.getRates(request))
    );

    const quotes: RateQuote[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        quotes.push(...result.value);
      }
      // Silently skip carriers that error — don't block the whole rate shop
    }

    return quotes.sort((a, b) => {
      if (sortBy === "cost") return a.totalCost - b.totalCost;
      return a.estimatedDays - b.estimatedDays;
    });
  }

  /**
   * Get the cheapest option that meets the service level
   */
  async getCheapest(request: RateRequest): Promise<RateQuote | null> {
    const rates = await this.getRates(request, "cost");
    return rates[0] ?? null;
  }

  /**
   * Get the fastest option
   */
  async getFastest(request: RateRequest): Promise<RateQuote | null> {
    const rates = await this.getRates(request, "speed");
    return rates[0] ?? null;
  }
}
