/**
 * Standalone translator for contexts without a request (BullMQ workers, emails).
 * Imports JSON directly — no request context needed.
 */
import { defaultLocale, type Locale, locales } from "./config";

function flattenMessages(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenMessages(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

/**
 * Returns a simple translator function for the given locale and namespace.
 * Supports ICU-style {variable} interpolation.
 */
export async function getServerTranslations(locale: string, namespace: string) {
  const safeLocale: Locale = locales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale;

  let raw: Record<string, unknown>;
  try {
    raw = (await import(`./locales/${safeLocale}/${namespace}.json`)).default;
  } catch {
    raw = (await import(`./locales/en/${namespace}.json`)).default;
  }

  // If the JSON has a single top-level key matching the namespace, unwrap it
  const keys = Object.keys(raw);
  const source = keys.length === 1 && typeof raw[keys[0]] === "object"
    ? (raw[keys[0]] as Record<string, unknown>)
    : raw;
  const messages = flattenMessages(source);

  return function t(key: string, params?: Record<string, string | number>): string {
    let text = messages[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return text;
  };
}
