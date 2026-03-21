/**
 * Shared auth helpers for Playwright E2E tests.
 * Sets the tenant cookie so server actions resolve to the correct DB schema.
 * Reusable across WMS + DispatchPro when both share the Next.js stack.
 */
import { test as base, type BrowserContext } from "@playwright/test";

/** Adds the tenant cookie for armstrong to every test in the file that uses this fixture. */
export async function setTenantCookie(context: BrowserContext, slug = "armstrong") {
  await context.addCookies([{ name: "tenant-slug", value: slug, domain: "localhost", path: "/" }]);
}

/**
 * Extended test fixture that automatically sets the tenant cookie.
 * Usage: import { test, expect } from './auth.setup';
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await setTenantCookie(context);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(context);
  },
});

export { expect } from "@playwright/test";
