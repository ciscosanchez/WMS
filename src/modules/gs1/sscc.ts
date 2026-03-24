/**
 * GS1 SSCC-18 Generator
 *
 * SSCC format: Extension Digit (1) + GS1 Company Prefix (7-10) + Serial Reference + Check Digit
 * Total: 18 digits
 *
 * Reference: https://www.gs1.org/standards/id-keys/sscc
 */

const DEFAULT_EXTENSION_DIGIT = "0";
const DEFAULT_COMPANY_PREFIX = "0000000"; // 7-digit placeholder

/** Calculate GS1 check digit using mod-10 algorithm */
export function calculateCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = parseInt(digits[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/** Generate a unique SSCC-18 number */
export function generateSSCC(opts?: {
  extensionDigit?: string;
  companyPrefix?: string;
  serialRef?: string;
}): string {
  const ext = opts?.extensionDigit ?? DEFAULT_EXTENSION_DIGIT;
  const prefix = opts?.companyPrefix ?? DEFAULT_COMPANY_PREFIX;

  const serialLength = 17 - 1 - prefix.length;
  const serial =
    opts?.serialRef ??
    String(Math.floor(Math.random() * Math.pow(10, serialLength))).padStart(serialLength, "0");

  const partial = `${ext}${prefix}${serial}`;
  if (partial.length !== 17) {
    throw new Error(`SSCC partial must be 17 digits, got ${partial.length}: "${partial}"`);
  }

  const checkDigit = calculateCheckDigit(partial);
  return `${partial}${checkDigit}`;
}

/** Validate an SSCC-18 string */
export function validateSSCC(sscc: string): boolean {
  if (!/^\d{18}$/.test(sscc)) return false;
  const partial = sscc.slice(0, 17);
  const expected = calculateCheckDigit(partial);
  return parseInt(sscc[17], 10) === expected;
}
