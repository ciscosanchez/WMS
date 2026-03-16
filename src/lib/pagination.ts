export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

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
