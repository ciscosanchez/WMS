/**
 * Standardized application error types.
 *
 * All domain errors extend AppError so catch blocks can inspect
 * `code` (machine-readable) and `statusCode` (HTTP status) without
 * relying on fragile message-string matching.
 */

// ── Base class ───────────────────────────────────────────────────────────────

export class AppError extends Error {
  /** Machine-readable error code, e.g. "NOT_FOUND", "FORBIDDEN" */
  public readonly code: string;

  /** Suggested HTTP status code for API responses */
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Concrete subclasses ──────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, "FORBIDDEN", 403);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, "CONFLICT", 409);
  }
}

export class InsufficientInventoryError extends AppError {
  constructor(message = "Insufficient inventory") {
    super(message, "INSUFFICIENT_INVENTORY", 422);
  }
}

// ── Response helper ──────────────────────────────────────────────────────────

/**
 * Convert any thrown value into a safe JSON-serializable error response.
 *
 * - AppError instances expose their message (already authored to be user-safe).
 * - Unknown errors produce a generic message to avoid leaking internals.
 */
export function toErrorResponse(err: unknown): {
  error: string;
  code?: string;
  statusCode?: number;
} {
  if (err instanceof AppError) {
    return {
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
    };
  }

  if (err instanceof Error) {
    return { error: err.message };
  }

  return { error: "An unexpected error occurred" };
}
