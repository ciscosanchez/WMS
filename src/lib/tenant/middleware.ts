import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/api/auth", "/set-password"];
const PLATFORM_PATHS = ["/platform"];

export function tenantMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip tenant resolution for public paths, platform paths, and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    PLATFORM_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Header-based tenant resolution (dev/testing only in production)
  if (process.env.TENANT_RESOLUTION === "header") {
    const tenantSlug = request.headers.get("x-tenant-slug");
    if (!tenantSlug && !pathname.startsWith("/api")) {
      // Cookie fallback — dev only
      if (process.env.NODE_ENV !== "production") {
        const cookieSlug = request.cookies.get("tenant-slug")?.value;
        if (cookieSlug) {
          const response = NextResponse.next();
          response.headers.set("x-tenant-slug", cookieSlug);
          return response;
        }
      }
    }
    return NextResponse.next();
  }

  // Production: extract tenant subdomain
  // wms.ramola.app (3 parts) = base domain, no tenant
  // armstrong.wms.ramola.app (4 parts) = tenant "armstrong"
  const host = request.headers.get("host") || "";
  const parts = host.split(".");

  if (parts.length >= 4) {
    const slug = parts[0];
    const response = NextResponse.next();
    response.headers.set("x-tenant-slug", slug);
    return response;
  }

  // Base domain (wms.ramola.app) — no tenant slug
  return NextResponse.next();
}
