/**
 * Standardized return type for server actions.
 *
 * Usage:
 *   export async function createFoo(data: unknown): Promise<ActionResult<{ id: string }>> {
 *     try {
 *       const foo = await db.foo.create(...)
 *       return { success: true, data: { id: foo.id } };
 *     } catch (err) {
 *       return { success: false, error: err instanceof Error ? err.message : "Failed" };
 *     }
 *   }
 *
 * Consumer:
 *   const result = await createFoo(data);
 *   if (!result.success) { toast.error(result.error); return; }
 *   router.push(`/foo/${result.data.id}`);
 */

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

/**
 * Helper to create a success result.
 */
export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/**
 * Helper to create an error result.
 */
export function err<T = void>(error: string): ActionResult<T> {
  return { success: false, error };
}
