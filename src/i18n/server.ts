/**
 * Standalone translator for contexts without a request (BullMQ workers, emails).
 * Imports JSON directly — no request context needed.
 */
import { createTranslator } from "next-intl";
import { defaultLocale, type Locale, locales } from "./config";

export async function getServerTranslations(locale: string, namespace: string) {
  const safeLocale: Locale = locales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale;

  let messages: Record<string, unknown>;
  try {
    messages = (await import(`./locales/${safeLocale}/${namespace}.json`)).default;
  } catch {
    // Fallback to English if namespace file missing
    messages = (await import(`./locales/en/${namespace}.json`)).default;
  }

  return createTranslator({ locale: safeLocale, messages, namespace });
}
