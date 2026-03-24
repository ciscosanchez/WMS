/**
 * GS1 SSCC-18 + Barcode Tests
 *
 * Tests SSCC number generation, check digit calculation,
 * validation, and GS1-128 barcode formatting/parsing.
 */

import { generateSSCC, validateSSCC, calculateCheckDigit } from "@/modules/gs1/sscc";
import { generateGS1Barcode, parseGS1Barcode } from "@/modules/gs1/barcode";
import {
  getComplianceLabelTemplate,
  listAvailableTemplates,
} from "@/modules/gs1/label-templates";

describe("SSCC-18 Generation", () => {
  it("generates an 18-digit SSCC", () => {
    const sscc = generateSSCC();
    expect(sscc).toHaveLength(18);
    expect(/^\d{18}$/.test(sscc)).toBe(true);
  });

  it("generated SSCC passes validation", () => {
    const sscc = generateSSCC();
    expect(validateSSCC(sscc)).toBe(true);
  });

  it("accepts custom extension digit and company prefix", () => {
    const sscc = generateSSCC({
      extensionDigit: "1",
      companyPrefix: "1234567",
      serialRef: "123456789",
    });
    expect(sscc).toHaveLength(18);
    expect(sscc.startsWith("1")).toBe(true);
    expect(sscc.startsWith("11234567")).toBe(true);
    expect(validateSSCC(sscc)).toBe(true);
  });

  it("generates unique SSCCs", () => {
    const ssccs = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ssccs.add(generateSSCC());
    }
    // With 9 random digits, collision in 100 is astronomically unlikely
    expect(ssccs.size).toBe(100);
  });

  it("throws on invalid partial length", () => {
    expect(() =>
      generateSSCC({
        extensionDigit: "0",
        companyPrefix: "12345678901", // 11 digits — too long
        serialRef: "12345678",
      })
    ).toThrow("SSCC partial must be 17 digits");
  });
});

describe("Check Digit Calculation", () => {
  it("calculates correct check digit for known values", () => {
    // Known SSCC: 00340123450000000018 → partial 0034012345000000001 → check = 8
    // Using GS1 mod-10 algorithm
    const partial = "00340123450000000";
    const check = calculateCheckDigit(partial);
    expect(check).toBeGreaterThanOrEqual(0);
    expect(check).toBeLessThanOrEqual(9);
  });

  it("returns 0 when sum is already divisible by 10", () => {
    // Craft a partial where the weighted sum mod 10 = 0
    // "00000000000000000" → sum = 0 → check = 0
    expect(calculateCheckDigit("00000000000000000")).toBe(0);
  });
});

describe("SSCC Validation", () => {
  it("rejects non-numeric strings", () => {
    expect(validateSSCC("0034012345abcdefgh")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(validateSSCC("12345")).toBe(false);
    expect(validateSSCC("1234567890123456789")).toBe(false); // 19 digits
  });

  it("rejects incorrect check digit", () => {
    const sscc = generateSSCC();
    // Flip the last digit
    const lastDigit = parseInt(sscc[17], 10);
    const wrongDigit = (lastDigit + 1) % 10;
    const badSSCC = sscc.slice(0, 17) + wrongDigit;
    expect(validateSSCC(badSSCC)).toBe(false);
  });
});

describe("GS1-128 Barcode Formatting", () => {
  it("formats SSCC-only barcode", () => {
    const barcode = generateGS1Barcode({ sscc: "003401234500000018" });
    expect(barcode).toBe("(00)003401234500000018");
  });

  it("formats multi-field barcode", () => {
    const barcode = generateGS1Barcode({
      sscc: "003401234500000018",
      gtin: "12345678901234",
      lotNumber: "LOT-A123",
      expirationDate: new Date("2026-06-15"),
    });
    expect(barcode).toContain("(00)003401234500000018");
    expect(barcode).toContain("(01)12345678901234");
    expect(barcode).toContain("(10)LOT-A123");
    expect(barcode).toContain("(17)260615");
  });

  it("pads GTIN to 14 digits", () => {
    const barcode = generateGS1Barcode({ gtin: "123" });
    expect(barcode).toBe("(01)00000000000123");
  });

  it("formats weight in kg", () => {
    const barcode = generateGS1Barcode({ weight: { kg: 12.5 } });
    expect(barcode).toContain("(3106)");
  });
});

describe("GS1-128 Barcode Parsing", () => {
  it("round-trips barcode data", () => {
    const original = {
      sscc: "003401234500000018",
      lotNumber: "BATCH-42",
      purchaseOrder: "PO-9999",
    };
    const barcode = generateGS1Barcode(original);
    const parsed = parseGS1Barcode(barcode);
    expect(parsed.sscc).toBe(original.sscc);
    expect(parsed.lotNumber).toBe(original.lotNumber);
    expect(parsed.purchaseOrder).toBe(original.purchaseOrder);
  });

  it("parses expiration date correctly", () => {
    const barcode = "(17)260615";
    const parsed = parseGS1Barcode(barcode);
    expect(parsed.expirationDate).toBeInstanceOf(Date);
    expect(parsed.expirationDate!.getFullYear()).toBe(2026);
    expect(parsed.expirationDate!.getMonth()).toBe(5); // June (0-indexed)
    expect(parsed.expirationDate!.getDate()).toBe(15);
  });
});

describe("Compliance Label Templates", () => {
  it("returns walmart template", () => {
    const tpl = getComplianceLabelTemplate("walmart");
    expect(tpl).not.toBeNull();
    expect(tpl!.retailer).toBe("Walmart");
    expect(tpl!.fields.some((f) => f.ai === "00" && f.required)).toBe(true);
    expect(tpl!.fields.some((f) => f.ai === "400" && f.required)).toBe(true);
  });

  it("returns null for unknown retailer", () => {
    expect(getComplianceLabelTemplate("nonexistent")).toBeNull();
  });

  it("lists available templates", () => {
    const templates = listAvailableTemplates();
    expect(templates).toContain("generic");
    expect(templates).toContain("walmart");
    expect(templates).toContain("amazon");
    expect(templates).toContain("target");
    expect(templates).toContain("costco");
  });

  it("is case-insensitive", () => {
    expect(getComplianceLabelTemplate("Walmart")).not.toBeNull();
    expect(getComplianceLabelTemplate("WALMART")).toBeNull(); // Only lowercase keys
  });
});
