import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signIn } from "@/lib/auth/auth-options";
import { getCookieDomain } from "@/lib/app-runtime";
import {
  WMS_SSO_COOKIE_MAX_AGE_SECONDS,
  WMS_SSO_PROVIDER_COOKIE,
  WMS_SSO_TENANT_COOKIE,
  getEnabledSsoProviders,
  getTenantAuthConfigForSlug,
  isMicrosoftEntraConfigured,
} from "@/lib/auth/tenant-auth";

function redirectToLogin(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}

function getSsoCookieOptions() {
  const cookieDomain = getCookieDomain();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WMS_SSO_COOKIE_MAX_AGE_SECONDS,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug")?.trim();
  const providerId = request.nextUrl.searchParams.get("providerId")?.trim();
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");

  if (!tenantSlug || !providerId) {
    return redirectToLogin(request);
  }

  const authConfig = await getTenantAuthConfigForSlug(tenantSlug);
  const provider = getEnabledSsoProviders(authConfig).find((item) => item.id === providerId);
  if (!provider) {
    return redirectToLogin(request);
  }

  const safeCallbackUrl = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";

  if (provider.type === "microsoft") {
    if (!isMicrosoftEntraConfigured()) {
      return redirectToLogin(request);
    }

    const cookieStore = await cookies();
    const cookieOptions = getSsoCookieOptions();
    cookieStore.set(WMS_SSO_TENANT_COOKIE, tenantSlug, cookieOptions);
    cookieStore.set(WMS_SSO_PROVIDER_COOKIE, provider.id, cookieOptions);

    const authUrl = await signIn(
      "microsoft-entra-id",
      {
        redirect: false,
        redirectTo: safeCallbackUrl,
      },
      {
        prompt: "select_account",
      }
    );

    return NextResponse.redirect(authUrl);
  }

  const target = new URL(provider.startUrl, request.nextUrl.origin);
  if (safeCallbackUrl && target.origin === request.nextUrl.origin) {
    target.searchParams.set("callbackUrl", safeCallbackUrl);
  }

  return NextResponse.redirect(target);
}
