import { convertQuantityToBaseUom, getProductUomChoices } from "@/modules/products/uom";

describe("product UOM helpers", () => {
  const product = {
    baseUom: "EA",
    unitsPerCase: 24,
    uomConversions: [{ fromUom: "PLT", toUom: "EA", factor: 960 }],
  };

  it("derives base, case-pack, and configured conversion choices", () => {
    expect(getProductUomChoices(product)).toEqual([
      { code: "EA", factor: 1, source: "base" },
      { code: "CS", factor: 24, source: "case_pack" },
      { code: "PLT", factor: 960, source: "conversion" },
    ]);
  });

  it("converts requested case quantities into base units", () => {
    expect(convertQuantityToBaseUom(product, 2, "CS")).toEqual({
      requestedUom: "CS",
      baseUom: "EA",
      baseQuantity: 48,
      factor: 24,
    });
  });

  it("throws for unsupported UOMs", () => {
    expect(() => convertQuantityToBaseUom(product, 1, "BAG")).toThrow("Unsupported UOM BAG");
  });
});
