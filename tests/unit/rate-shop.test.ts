import { RateShopEngine } from "@/lib/integrations/carriers/rate-shop";
import type { CarrierAdapter, RateRequest, RateQuote } from "@/lib/integrations/carriers/types";

function makeRequest(): RateRequest {
  return {
    from: {
      name: "Warehouse",
      company: "Acme Inc",
      street1: "100 Main St",
      city: "Houston",
      state: "TX",
      zip: "77001",
      country: "US",
    },
    to: {
      name: "Customer",
      street1: "200 Oak Ave",
      city: "Dallas",
      state: "TX",
      zip: "75201",
      country: "US",
    },
    packages: [{ weight: 10, weightUnit: "lb", length: 12, width: 10, height: 8, dimUnit: "in" }],
  };
}

function makeMockAdapter(name: string, quotes: RateQuote[]): CarrierAdapter {
  return {
    name,
    getRates: jest.fn().mockResolvedValue(quotes),
    createLabel: jest.fn(),
    getTracking: jest.fn(),
    voidLabel: jest.fn(),
  };
}

function makeQuote(carrier: string, service: string, cost: number, days: number): RateQuote {
  return {
    carrier,
    service,
    serviceCode: `${carrier}-${service}`.toUpperCase(),
    totalCost: cost,
    currency: "USD",
    estimatedDays: days,
    guaranteed: false,
  };
}

describe("RateShopEngine", () => {
  let engine: RateShopEngine;
  const request = makeRequest();

  beforeEach(() => {
    engine = new RateShopEngine();
  });

  describe("getRates", () => {
    it("returns sorted results cheapest first by default", async () => {
      const ups = makeMockAdapter("UPS", [
        makeQuote("UPS", "Ground", 15.0, 5),
        makeQuote("UPS", "Express", 35.0, 2),
      ]);
      const fedex = makeMockAdapter("FedEx", [
        makeQuote("FedEx", "Ground", 12.0, 4),
        makeQuote("FedEx", "Overnight", 45.0, 1),
      ]);
      engine.registerAdapter(ups);
      engine.registerAdapter(fedex);

      const rates = await engine.getRates(request);

      expect(rates).toHaveLength(4);
      expect(rates[0].totalCost).toBe(12.0);
      expect(rates[1].totalCost).toBe(15.0);
      expect(rates[2].totalCost).toBe(35.0);
      expect(rates[3].totalCost).toBe(45.0);
    });

    it("sorts by speed when requested", async () => {
      const ups = makeMockAdapter("UPS", [
        makeQuote("UPS", "Ground", 10.0, 5),
      ]);
      const fedex = makeMockAdapter("FedEx", [
        makeQuote("FedEx", "Overnight", 50.0, 1),
      ]);
      engine.registerAdapter(ups);
      engine.registerAdapter(fedex);

      const rates = await engine.getRates(request, "speed");

      expect(rates[0].estimatedDays).toBe(1);
      expect(rates[1].estimatedDays).toBe(5);
    });

    it("returns empty array when no adapters registered", async () => {
      const rates = await engine.getRates(request);
      expect(rates).toEqual([]);
    });

    it("silently skips adapters that throw errors", async () => {
      const failingAdapter: CarrierAdapter = {
        name: "Broken",
        getRates: jest.fn().mockRejectedValue(new Error("API down")),
        createLabel: jest.fn(),
        getTracking: jest.fn(),
        voidLabel: jest.fn(),
      };
      const goodAdapter = makeMockAdapter("UPS", [
        makeQuote("UPS", "Ground", 15.0, 5),
      ]);

      engine.registerAdapter(failingAdapter);
      engine.registerAdapter(goodAdapter);

      const rates = await engine.getRates(request);
      expect(rates).toHaveLength(1);
      expect(rates[0].carrier).toBe("UPS");
    });
  });

  describe("getCheapest", () => {
    it("returns the lowest cost option", async () => {
      const ups = makeMockAdapter("UPS", [makeQuote("UPS", "Ground", 15.0, 5)]);
      const fedex = makeMockAdapter("FedEx", [makeQuote("FedEx", "Ground", 12.0, 4)]);
      engine.registerAdapter(ups);
      engine.registerAdapter(fedex);

      const cheapest = await engine.getCheapest(request);
      expect(cheapest).not.toBeNull();
      expect(cheapest!.totalCost).toBe(12.0);
      expect(cheapest!.carrier).toBe("FedEx");
    });

    it("returns null when no adapters registered", async () => {
      const result = await engine.getCheapest(request);
      expect(result).toBeNull();
    });
  });

  describe("getFastest", () => {
    it("returns the lowest estimated days option", async () => {
      const ups = makeMockAdapter("UPS", [makeQuote("UPS", "Ground", 10.0, 5)]);
      const fedex = makeMockAdapter("FedEx", [makeQuote("FedEx", "Overnight", 50.0, 1)]);
      engine.registerAdapter(ups);
      engine.registerAdapter(fedex);

      const fastest = await engine.getFastest(request);
      expect(fastest).not.toBeNull();
      expect(fastest!.estimatedDays).toBe(1);
      expect(fastest!.carrier).toBe("FedEx");
    });

    it("returns null when no adapters registered", async () => {
      const result = await engine.getFastest(request);
      expect(result).toBeNull();
    });
  });
});
