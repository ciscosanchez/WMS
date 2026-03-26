import { config as appConfig } from "@/lib/config";
import { tenantMiddleware } from "@/lib/tenant/middleware";
import { getDefaultTenantPath, isPortalUser } from "@/lib/auth/personas";
import type { SessionLikeUser } from "@/lib/auth/personas";
import { MOCK_AUTH_COOKIE, decodeMockAuthCookie } from "@/lib/auth/mock-auth";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Security headers applied to every response. */
function getSecurityHeaders(nonce: string): Record<string, string> {
  const isDev = process.env.NODE_ENV !== "production";
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0", // Deprecated; CSP is the real protection
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": [
      "default-src 'self'",
      // In dev, Next.js hot-reload requires unsafe-eval; in prod, use nonce-based loading
      isDev
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        : `script-src 'self' 'nonce-${nonce}'`,
      // unsafe-inline required for styles — React/Radix/Recharts use inline style attributes
      `style-src 'self' 'unsafe-inline'`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.sentry.io https://*.resend.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";

  // --- Fetch JWT token once for all checks below ---
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: sessionCookieName,
    salt: sessionCookieName,
  }).catch(() => null);

  const authUser =
    (token as SessionLikeUser | null) ??
    (appConfig.useMockAuth ? decodeMockAuthCookie(request.cookies.get(MOCK_AUTH_COOKIE)?.value) : null);

  // --- /platform/* route protection (superadmin only) ---
  if (pathname.startsWith("/platform")) {
    if (!authUser?.isSuperadmin) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Base domain redirect ---
  // wms.ramola.app (no tenant) — redirect authenticated users appropriately
  const host = request.headers.get("host") || "";
  const hostParts = host.split(".");
  const isBaseDomain = hostParts.length < 4; // wms.ramola.app = 3 parts
  const isLocalTenantMode =
    process.env.TENANT_RESOLUTION === "header" && process.env.NODE_ENV !== "production";
  if (
    isBaseDomain &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/forgot-password") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/set-password") &&
    !pathname.startsWith("/platform") &&
    !pathname.startsWith("/api")
  ) {
    if (authUser?.isSuperadmin) {
      return NextResponse.redirect(new URL("/platform", request.url));
    }
    // In local header-mode dev/test, stay on localhost and behave like a tenant shell.
    if (authUser && isLocalTenantMode) {
      const tenants = authUser.tenants ?? [];
      if (tenants.length > 0) {
        const tenantSlug = tenants[0].slug;
        const tenantPath =
          pathname === "/" ? getDefaultTenantPath(authUser, tenantSlug) : pathname;

        if (pathname === "/") {
          return NextResponse.redirect(new URL(tenantPath, request.url));
        }

        if (tenantPath !== pathname && (pathname === "/dashboard" || isPortalUser(authUser, tenantSlug))) {
          return NextResponse.redirect(new URL(tenantPath, request.url));
        }
      }
    }

    // Non-superadmin on base domain with no tenant — send to login
    if (authUser) {
      // Logged in but not superadmin — redirect to their first tenant
      const tenants = authUser.tenants ?? [];
      if (tenants.length > 0) {
        const tenantPath =
          pathname === "/" ? getDefaultTenantPath(authUser, tenants[0].slug) : pathname;
        const tenantUrl = `https://${tenants[0].slug}.wms.ramola.app${tenantPath}`;
        return NextResponse.redirect(tenantUrl);
      }
    }
  }

  // --- Tenant persona routing ---
  if (!isBaseDomain && authUser && (pathname === "/" || pathname === "/dashboard")) {
    const tenantSlug = hostParts[0] ?? null;
    const destination = getDefaultTenantPath(authUser, tenantSlug);
    if (destination !== pathname) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  if (
    !isBaseDomain &&
    authUser &&
    isPortalUser(authUser, hostParts[0] ?? null) &&
    !pathname.startsWith("/portal") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/favicon")
  ) {
    return NextResponse.redirect(new URL("/portal/inventory", request.url));
  }

  // --- Tenant resolution (existing behaviour) ---
  const response = tenantMiddleware(request);

  // --- Locale resolution ---
  // Priority: cookie (instant update) > JWT locale > tenant default > "en"
  const localeCookie = request.cookies.get("locale")?.value;
  const locale =
    localeCookie ??
    ((token?.locale as string | undefined) ?? authUser?.locale) ??
    (token?.tenantLocale as string | undefined) ??
    "en";
  response.headers.set("x-locale", locale);

  // --- Security headers ---
  // Generate a per-request nonce for CSP script/style loading
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  response.headers.set("x-nonce", nonce);
  const secHeaders = getSecurityHeaders(nonce);
  for (const [key, value] of Object.entries(secHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
