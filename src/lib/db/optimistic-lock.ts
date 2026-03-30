/**
 * Optimistic Locking Helper
 *
 * Uses the `updatedAt` timestamp as a version proxy to prevent concurrent
 * modifications from silently overwriting each other. If the row has been
 * modified since the caller last read it, the update will match zero rows
 * and throw a ConflictError.
 *
 * Pattern:
 *   1. Read the record (capturing its `updatedAt`)
 *   2. Call `optimisticUpdate(...)` with that timestamp
 *   3. If another writer changed the row in between, ConflictError is thrown
 *
 * This is a lightweight alternative to a dedicated `version` column and
 * works with any Prisma model that has an `updatedAt` field.
 */

// ─── ConflictError ────────────────────────────────────────────────────────────

export class ConflictError extends Error {
  public readonly code = "CONFLICT";
  public readonly statusCode = 409;

  constructor(message = "Record was modified concurrently, please retry") {
    super(message);
    this.name = "ConflictError";
  }
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

/**
 * Minimal Prisma delegate shape. We only need `updateMany` and `findUnique`
 * so this works with any model that exposes those methods.
 */
interface PrismaModelDelegate {
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;

  findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
}

export interface OptimisticUpdateOptions {
  /** The Prisma model delegate (e.g. `prisma.inventory`) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;

  /** Primary key of the record */
  id: string;

  /** The `updatedAt` value from the caller's last read */
  expectedUpdatedAt: Date;

  /** Fields to update */
  data: Record<string, unknown>;

  /** Extra `where` conditions beyond id + updatedAt (e.g. `available: { gte: 5 }`) */
  extraWhere?: Record<string, unknown>;
}

// ─── Core helper ──────────────────────────────────────────────────────────────

/**
 * Perform an optimistic-locking update using `updatedAt` as the version.
 *
 * @throws {ConflictError} if the record was modified since `expectedUpdatedAt`
 * @returns the freshly-fetched record after the update
 */
export async function optimisticUpdate<
  T extends Record<string, unknown> = Record<string, unknown>,
>({ model, id, expectedUpdatedAt, data, extraWhere }: OptimisticUpdateOptions): Promise<T> {
  const delegate = model as PrismaModelDelegate;

  const result = await delegate.updateMany({
    where: {
      id,
      updatedAt: expectedUpdatedAt,
      ...extraWhere,
    },
    data,
  });

  if (result.count === 0) {
    throw new ConflictError();
  }

  // Return the updated record
  const updated = await delegate.findUnique({ where: { id } });
  if (!updated) {
    throw new Error(`Record ${id} not found after optimistic update`);
  }

  return updated as T;
}

// ─── Convenience: retry wrapper ───────────────────────────────────────────────

export interface OptimisticRetryOptions<T> {
  /** Max number of attempts (default: 3) */
  maxAttempts?: number;

  /** Async function that reads the record and returns data needed for the update */
  read: () => Promise<{
    record: T & { id: string; updatedAt: Date };
    data: Record<string, unknown>;
  }>;

  /** The Prisma model delegate */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;

  /** Extra where conditions */
  extraWhere?: Record<string, unknown>;
}

/**
 * Retry an optimistic update up to `maxAttempts` times.
 * On each ConflictError, re-reads the record and tries again.
 */
export async function optimisticRetry<T extends Record<string, unknown>>({
  maxAttempts = 3,
  read,
  model,
  extraWhere,
}: OptimisticRetryOptions<T>): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { record, data } = await read();

    try {
      return await optimisticUpdate<T>({
        model,
        id: record.id,
        expectedUpdatedAt: record.updatedAt,
        data,
        extraWhere,
      });
    } catch (err) {
      if (err instanceof ConflictError && attempt < maxAttempts) {
        continue; // retry with fresh read
      }
      throw err;
    }
  }

  // Unreachable, but TypeScript needs it
  throw new ConflictError("Exhausted retry attempts");
}
