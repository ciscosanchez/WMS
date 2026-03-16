/**
 * Input sanitization utilities.
 * Use before passing user input to database queries.
 */

/**
 * Strips HTML tags and trims whitespace from a string.
 */
export function sanitizeString(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Recursively sanitizes all string values in an object.
 * Non-string primitives and nulls are returned as-is.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}
