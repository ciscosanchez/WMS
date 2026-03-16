import { generateBinBarcode, generateProductBarcode } from "@/lib/barcode";

describe("Barcode generation", () => {
  it("generates bin barcode from location hierarchy", () => {
    const barcode = generateBinBarcode("WH1", "A", "01", "02", "03", "04");
    expect(barcode).toBe("WH1-A-01-02-03-04");
  });

  it("generates product barcode from SKU", () => {
    const barcode = generateProductBarcode("WIDGET-001");
    expect(barcode).toBe("WIDGET-001");
  });
});
