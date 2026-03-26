import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { defaultLocale, type Locale, locales } from "./config";
import { loadLocaleMessages } from "./load-messages";

export default getRequestConfig(async () => {
  const hdrs = await headers();
  const raw = hdrs.get("x-locale") ?? defaultLocale;
  const locale: Locale = locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;

  return {
    locale,
    messages: {
      ...(await loadLocaleMessages(locale, "common")),
      ...(await loadLocaleMessages(locale, "operator")),
      ...(await loadLocaleMessages(locale, "auth")),
      ...(await loadLocaleMessages(locale, "tenant")),
      ...(await loadLocaleMessages(locale, "portal")),
      ...(await loadLocaleMessages(locale, "platform")),
      ...(await loadLocaleMessages(locale, "email")),
      ...(await loadLocaleMessages(locale, "validation")),
    },
  };
});
