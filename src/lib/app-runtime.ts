import { defaultLocale, localeLabels, locales, type Locale } from "@/i18n/config";

export function getAppBaseUrl(): string {
  const appDomain = process.env.APP_DOMAIN || "wms.ramola.app";
  const fallback =
    process.env.NODE_ENV === "production" ? `https://${appDomain}` : "http://localhost:3000";
  return process.env.AUTH_URL || process.env.NEXTAUTH_URL || fallback;
}

export function getAppHost(): string {
  return new URL(getAppBaseUrl()).hostname;
}

export function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  const host = getAppHost();
  if (host === "localhost" || host === "127.0.0.1") return undefined;
  return `.${host}`;
}

export function buildTenantAppUrl(tenantSlug: string, path: string): string {
  const url = new URL(getAppBaseUrl());
  url.hostname = `${tenantSlug}.${url.hostname}`;
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && locales.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isSupportedLocale(value) ? value : defaultLocale;
}

export function getLocaleLabels(): Record<Locale, string> {
  return localeLabels;
}

export function getDefaultEmailFrom(appName = "Ramola WMS"): string {
  return process.env.EMAIL_FROM || `${appName} <noreply@${getAppHost()}>`;
}

export { defaultLocale };
