import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { defaultLocale, type Locale, locales } from "./config";

export default getRequestConfig(async () => {
  const hdrs = await headers();
  const raw = hdrs.get("x-locale") ?? defaultLocale;
  const locale: Locale = locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;

  return {
    locale,
    messages: {
      ...(await import(`./locales/${locale}/common.json`)).default,
      ...(await import(`./locales/${locale}/operator.json`)).default,
      ...(await import(`./locales/${locale}/auth.json`)).default,
      ...(await import(`./locales/${locale}/tenant.json`)).default,
      ...(await import(`./locales/${locale}/portal.json`)).default,
      ...(await import(`./locales/${locale}/platform.json`)).default,
      ...(await import(`./locales/${locale}/email.json`)).default,
    },
  };
});
