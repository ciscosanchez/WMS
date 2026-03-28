/**
 * Shared auth helpers for Playwright E2E tests.
 * Sets tenant + mock-auth cookies so server actions and middleware resolve the
 * correct tenant and persona. Reusable across WMS + DispatchPro when both
 * share the Next.js stack.
 */
import { test as base, type BrowserContext } from "@playwright/test";
import {
  MOCK_AUTH_COOKIE,
  encodeMockAuthCookie,
  type MockAuthUser,
} from "../../src/lib/auth/mock-auth";
import { E2E_WAREHOUSE_MEMPHIS } from "./e2e-constants";

export type MockPersona =
  | "superadmin"
  | "admin"
  | "manager"
  | "operator"
  | "viewer"
  | "portal"
  | "location_manager"; // manager scoped to Memphis only (requires db:seed:e2e)

function createPersonaUser(persona: MockPersona, slug: string): MockAuthUser {
  const role =
    persona === "manager" || persona === "location_manager"
      ? "manager"
      : persona === "operator"
        ? "warehouse_worker"
        : persona === "viewer" || persona === "portal"
          ? "viewer"
          : "admin";

  const membership = {
    tenantId: `mock-${slug}`,
    slug,
    role,
    portalClientId: persona === "portal" ? "mock-client-1" : null,
    warehouseAccess:
      persona === "location_manager"
        ? [{ warehouseId: E2E_WAREHOUSE_MEMPHIS, role: null }]
        : null,
  } as const;

  switch (persona) {
    case "superadmin":
      return {
        id: "mock-superadmin",
        email: "superadmin@ramola.io",
        name: "Platform Superadmin",
        isSuperadmin: true,
        authVersion: 0,
        tenants: [membership],
      };
    case "manager":
      return {
        id: "mock-manager",
        email: "manager@armstrong.com",
        name: "Morgan Reyes",
        isSuperadmin: false,
        authVersion: 0,
        tenants: [membership],
      };
    case "operator":
      return {
        id: "mock-operator",
        email: "receiving@armstrong.com",
        name: "Alex Morgan",
        isSuperadmin: false,
        authVersion: 0,
        tenants: [membership],
      };
    case "viewer":
      return {
        id: "mock-viewer",
        email: "viewer@armstrong.com",
        name: "Taylor Brooks",
        isSuperadmin: false,
        authVersion: 0,
        tenants: [membership],
      };
    case "portal":
      return {
        id: "mock-portal",
        email: "portal@arteriors.com",
        name: "Lisa Chen",
        isSuperadmin: false,
        authVersion: 0,
        tenants: [membership],
      };
    case "location_manager":
      return {
        id: "mock-location-manager",
        email: "loc.mgr@armstrong.com",
        name: "Jordan Kim",
        isSuperadmin: false,
        authVersion: 0,
        tenants: [membership],
      };
    case "admin":
    default:
      return {
        id: "mock-admin",
        email: "admin@armstrong.com",
        name: "Cisco Sanchez",
        isSuperadmin: false,
        authVersion: 0,
        tenants: [membership],
      };
  }
}

/** Adds the tenant cookie for armstrong to every test in the file that uses this fixture. */
export async function setTenantCookie(context: BrowserContext, slug = "armstrong") {
  await context.addCookies([{ name: "tenant-slug", value: slug, url: "http://localhost:3000" }]);
}

export async function setMockAuthCookie(
  context: BrowserContext,
  persona: MockPersona = "admin",
  slug = "armstrong"
) {
  await context.addCookies([
    {
      name: MOCK_AUTH_COOKIE,
      value: encodeMockAuthCookie(createPersonaUser(persona, slug)),
      url: "http://localhost:3000",
    },
  ]);
}

/**
 * Extended test fixture that automatically sets the tenant cookie.
 * Usage: import { test, expect } from './auth.setup';
 */
export const test = base.extend<{
  signInAs: (persona: MockPersona, slug?: string) => Promise<void>;
}>({
  context: async ({ context }, use) => {
    await setTenantCookie(context);
    await setMockAuthCookie(context, "admin");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(context);
  },
  signInAs: async ({ context }, use) => {
    await use(async (persona: MockPersona, slug = "armstrong") => {
      await setTenantCookie(context, slug);
      await setMockAuthCookie(context, persona, slug);
    });
  },
});

export { expect } from "@playwright/test";
