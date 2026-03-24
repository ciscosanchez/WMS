export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Date/number formatting presets keyed by locale. */
export const formats = {
  dateTime: {
    short: { day: "numeric", month: "short", year: "numeric" } as const,
    long: { day: "numeric", month: "long", year: "numeric", weekday: "long" } as const,
  },
  number: {
    integer: { maximumFractionDigits: 0 } as const,
    currency: { style: "currency", currency: "USD" } as const,
  },
} as const;
