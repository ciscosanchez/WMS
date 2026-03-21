import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

/**
 * Validate the X-API-Key header on inbound DispatchPro → WMS requests.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateDispatchApiKey(request: Request): boolean {
  const key = request.headers.get("X-API-Key");
  const expected = process.env.WMS_API_KEY;

  if (!key || !expected) return false;
  return safeCompare(key, expected);
}

/**
 * Validate API key for a specific tenant.
 * Checks tenant-scoped key from settings first, then falls back to global key
 * but ONLY for the Armstrong tenant (prevents key reuse across tenants).
 */
export function validateTenantApiKey(
  request: Request,
  tenantSlug: string,
  tenantSettings?: Record<string, unknown>
): boolean {
  const key = request.headers.get("X-API-Key");
  if (!key) return false;

  // Check per-tenant API key first (stored in Tenant.settings.apiKey)
  const tenantKey = tenantSettings?.apiKey as string | undefined;
  if (tenantKey) {
    return safeCompare(key, tenantKey);
  }

  // Fall back to shared key ONLY for the default tenant
  const defaultSlug = process.env.ARMSTRONG_TENANT_SLUG ?? process.env.DEFAULT_TENANT_SLUG ?? "armstrong";
  if (tenantSlug !== defaultSlug) {
    return false; // Non-default tenants MUST have their own API key
  }

  const globalKey = process.env.WMS_API_KEY;
  if (!globalKey) return false;
  return safeCompare(key, globalKey);
}
