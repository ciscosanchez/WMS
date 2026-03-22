export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// ─── Cursor-based pagination ──────────────────────────────
// Better performance for large datasets (no OFFSET scan).
// Forward-only — callers keep a stack of cursors client-side for "previous".
// Queries MUST include a secondary `orderBy: { id: "desc" }` tie-breaker
// so cursor position is deterministic even when the primary sort key has dupes.

export type CursorPaginatedResult<T> = {
  data: T[];
  /** Cursor to fetch the next page. null = no more pages. */
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
};

/**
 * Builds Prisma cursor-based pagination args (forward only).
 * Pass cursor = undefined/null for the first page.
 *
 * IMPORTANT: The calling query must also include `orderBy: [{ <primary>, id: "desc" }]`
 * to ensure stable ordering. The cursor is always the `id` of the last item.
 */
export function cursorPaginateQuery(
  pageSize: number,
  cursor?: string | null
): { take: number; skip?: number; cursor?: { id: string } } {
  if (!cursor) {
    return { take: pageSize + 1 };
  }

  return {
    take: pageSize + 1,
    skip: 1, // Skip the cursor record itself
    cursor: { id: cursor },
  };
}

/**
 * Wraps a cursor-paginated query result.
 * Expects data fetched with pageSize + 1 (extra record to detect hasMore).
 */
export function buildCursorResult<T extends { id: string }>(
  data: T[],
  pageSize: number
): CursorPaginatedResult<T> {
  const hasMore = data.length > pageSize;
  const trimmed = hasMore ? data.slice(0, pageSize) : data;

  return {
    data: trimmed,
    nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null,
    hasMore,
    pageSize,
  };
}

/**
 * Converts a 1-based page number + pageSize into Prisma-compatible skip/take values.
 */
export function paginateQuery(page: number, pageSize: number): { skip: number; take: number } {
  const safePage = Math.max(1, page);
  return {
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * Wraps a data slice + total count into a typed paginated result.
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    data,
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
