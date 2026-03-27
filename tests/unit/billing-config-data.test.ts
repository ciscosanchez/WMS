import {
  buildRateLines,
  getBillingServiceConfig,
  validateBillingRateBasis,
} from "@/app/(tenant)/settings/billing/billing-config-data";

describe("billing rate basis config", () => {
  it("builds labeled rate lines from the configured service catalog", () => {
    const lines = buildRateLines([
      { serviceType: "receiving_pallet", unitRate: 9.5, uom: "per_pallet_usd" },
    ]);

    expect(lines.find((line) => line.serviceType === "receiving_pallet")).toMatchObject({
      basisCode: "per_pallet_usd",
      basisLabel: "$ / pallet",
      unitRate: 9.5,
    });
  });

  it("validates only the expected basis code for a service", () => {
    expect(validateBillingRateBasis("receiving_pallet", "per_pallet_usd")).toBe(true);
    expect(validateBillingRateBasis("receiving_pallet", "per_order_usd")).toBe(false);
    expect(validateBillingRateBasis("unknown_service", "per_order_usd")).toBe(false);
  });

  it("exposes service config for downstream billing validation", () => {
    expect(getBillingServiceConfig("shipping_markup")).toMatchObject({
      serviceType: "shipping_markup",
      basisCode: "percent_markup",
    });
  });
});
