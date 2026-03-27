import { resolveShipmentPackage } from "@/modules/shipping/package-defaults";

describe("resolveShipmentPackage", () => {
  it("uses explicit shipment package values when present", () => {
    expect(
      resolveShipmentPackage(
        {
          packageWeight: 5,
          packageLength: 20,
          packageWidth: 15,
          packageHeight: 8,
        },
        {
          length: 12,
          width: 10,
          height: 6,
          dimUnit: "in",
          tareWeight: 1,
          weightUnit: "lb",
        }
      )
    ).toMatchObject({
      weight: 5,
      length: 20,
      width: 15,
      height: 8,
      weightUnit: "lb",
      dimUnit: "in",
    });
  });

  it("falls back to configured carton defaults before hardcoded package defaults", () => {
    expect(
      resolveShipmentPackage(
        {},
        {
          length: 18,
          width: 14,
          height: 12,
          dimUnit: "cm",
          tareWeight: 2,
          weightUnit: "kg",
        }
      )
    ).toMatchObject({
      weight: 2,
      length: 18,
      width: 14,
      height: 12,
      weightUnit: "kg",
      dimUnit: "cm",
    });
  });
});
