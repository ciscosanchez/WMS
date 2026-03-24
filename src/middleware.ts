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
      isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
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

  // --- /platform/* route protection (superadmin only) ---
  // Uses next-auth/jwt getToken so we never hit the DB from Edge Runtime.
  if (pathname.startsWith("/platform")) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });
    if (!token?.isSuperadmin) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Tenant resolution (existing behaviour) ---
  const response = tenantMiddleware(request);

  // --- Locale resolution ---
  // Priority: user locale from JWT > tenant default > "en"
  const token = pathname.startsWith("/platform")
    ? null // already read above
    : await getToken({ req: request, secret: process.env.AUTH_SECRET }).catch(() => null);
  const locale =
    (token?.locale as string | undefined) ?? (token?.tenantLocale as string | undefined) ?? "en";
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
