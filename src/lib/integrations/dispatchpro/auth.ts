import { timingSafeEqual } from "crypto";

/**
 * Validate the X-API-Key header on inbound DispatchPro → WMS requests.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateDispatchApiKey(request: Request): boolean {
  const key = request.headers.get("X-API-Key");
  const expected = process.env.WMS_API_KEY;

  if (!key || !expected) return false;

  try {
    const keyBuf = Buffer.from(key, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    if (keyBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(keyBuf, expectedBuf);
  } catch {
    return false;
  }
}
