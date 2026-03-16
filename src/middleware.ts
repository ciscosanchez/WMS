import { tenantMiddleware } from "@/lib/tenant/middleware";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return tenantMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
