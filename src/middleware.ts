import { tenantMiddleware } from "@/lib/tenant/middleware";
import type { NextRequest } from "next/server";

/** Security headers applied to every response. */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Tenant resolution (existing behaviour) ---
  const response = tenantMiddleware(request);

  // --- Security headers ---
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // --- /platform/* route protection ---
  // TODO: enforce superadmin check once auth is available in middleware
  // For now this is a marker so the path-based guard is easy to add later.
  if (pathname.startsWith("/platform")) {
    // future: verify superadmin token / session here
  }

  // --- API rate-limit placeholder headers ---
  if (pathname.startsWith("/api")) {
    response.headers.set("X-RateLimit-Limit", "100");
    response.headers.set("X-RateLimit-Remaining", "99");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
