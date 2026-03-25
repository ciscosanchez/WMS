import { NextRequest, NextResponse } from "next/server";
import {
  buildTenantSsoOptions,
  DEFAULT_TENANT_AUTH_CONFIG,
  getTenantAuthConfigForCurrentRequest,
  getTenantAuthConfigForSlug,
} from "@/lib/auth/tenant-auth";

export async function POST(request: NextRequest) {
  const body = await request
    .json()
    .catch(() => ({})) as { callbackUrl?: string; tenantSlug?: string };

  const requestedCallbackUrl =
    typeof body.callbackUrl === "string" && body.callbackUrl.startsWith("/")
      ? body.callbackUrl
      : null;

  const requestedTenantSlug =
    typeof body.tenantSlug === "string" && body.tenantSlug.trim() ? body.tenantSlug.trim() : null;

  const resolved = requestedTenantSlug
    ? {
        tenantSlug: requestedTenantSlug,
        authConfig: await getTenantAuthConfigForSlug(requestedTenantSlug),
      }
    : await getTenantAuthConfigForCurrentRequest();

  const authConfig = resolved.authConfig ?? DEFAULT_TENANT_AUTH_CONFIG;

  return NextResponse.json({
    tenantSlug: resolved.tenantSlug,
    mode: authConfig.mode,
    sso: resolved.tenantSlug
      ? buildTenantSsoOptions(authConfig, resolved.tenantSlug, requestedCallbackUrl)
      : [],
  });
}
