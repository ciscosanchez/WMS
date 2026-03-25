import { tenantMiddleware } from "@/lib/tenant/middleware";
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

  // --- /platform/* route protection (superadmin only) ---
  if (pathname.startsWith("/platform")) {
    if (!token?.isSuperadmin) {
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
  if (isBaseDomain && !pathname.startsWith("/login") && !pathname.startsWith("/set-password") && !pathname.startsWith("/platform") && !pathname.startsWith("/api")) {
    if (token?.isSuperadmin) {
      return NextResponse.redirect(new URL("/platform", request.url));
    }
    // Non-superadmin on base domain with no tenant — send to login
    if (token) {
      // Logged in but not superadmin — redirect to their first tenant
      const tenants = (token.tenants as Array<{ slug: string }>) ?? [];
      if (tenants.length > 0) {
        const tenantUrl = `https://${tenants[0].slug}.wms.ramola.app${pathname}`;
        return NextResponse.redirect(tenantUrl);
      }
    }
  }

  // --- Tenant resolution (existing behaviour) ---
  const response = tenantMiddleware(request);

  // --- Locale resolution ---
  // Priority: cookie (instant update) > JWT locale > tenant default > "en"
  const localeCookie = request.cookies.get("locale")?.value;
  const locale =
    localeCookie ?? (token?.locale as string | undefined) ?? (token?.tenantLocale as string | undefined) ?? "en";
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
