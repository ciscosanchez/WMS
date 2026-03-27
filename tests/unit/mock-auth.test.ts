/**
 * @jest-environment node
 */

import {
  DEFAULT_MOCK_AUTH_USER,
  decodeMockAuthCookie,
  encodeMockAuthCookie,
} from "@/lib/auth/mock-auth";

describe("mock auth cookie helpers", () => {
  it("round-trips a mock auth user", () => {
    const cookie = encodeMockAuthCookie({
      ...DEFAULT_MOCK_AUTH_USER,
      email: "portal@arteriors.com",
      tenants: [
        {
          tenantId: "tenant-1",
          slug: "armstrong",
          role: "viewer",
          portalClientId: "client-1",
        },
      ],
    });

    expect(decodeMockAuthCookie(cookie)).toEqual({
      ...DEFAULT_MOCK_AUTH_USER,
      email: "portal@arteriors.com",
      locale: undefined,
      tenants: [
        {
          tenantId: "tenant-1",
          slug: "armstrong",
          role: "viewer",
          portalClientId: "client-1",
          permissionOverrides: {
            grants: [],
            denies: [],
          },
        },
      ],
    });
  });

  it("returns null for invalid cookie payloads", () => {
    expect(decodeMockAuthCookie("not-base64")).toBeNull();
  });
});
