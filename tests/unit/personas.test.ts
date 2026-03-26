/**
 * @jest-environment node
 */

import {
  getDefaultTenantPath,
  getTenantMembership,
  getUserPersonas,
  isOperatorUser,
  isPortalUser,
} from "@/lib/auth/personas";

describe("auth personas", () => {
  const tenantAdmin = {
    isSuperadmin: false,
    tenants: [{ slug: "armstrong", role: "admin" as const, portalClientId: null }],
  };

  const warehouseWorker = {
    isSuperadmin: false,
    tenants: [{ slug: "armstrong", role: "warehouse_worker" as const, portalClientId: null }],
  };

  const portalViewer = {
    isSuperadmin: false,
    tenants: [{ slug: "armstrong", role: "viewer" as const, portalClientId: "client-1" }],
  };

  it("resolves the matching tenant membership", () => {
    expect(getTenantMembership(tenantAdmin, "armstrong")).toMatchObject({ role: "admin" });
    expect(getTenantMembership(tenantAdmin, "missing")).toBeNull();
  });

  it("flags portal users from portal client bindings", () => {
    expect(isPortalUser(portalViewer, "armstrong")).toBe(true);
    expect(isPortalUser(tenantAdmin, "armstrong")).toBe(false);
  });

  it("treats warehouse workers as operator personas", () => {
    expect(isOperatorUser(warehouseWorker, "armstrong")).toBe(true);
    expect(isOperatorUser(tenantAdmin, "armstrong")).toBe(false);
  });

  it("derives product personas without introducing new persisted roles", () => {
    expect(getUserPersonas(tenantAdmin, "armstrong")).toEqual(["tenant_admin"]);
    expect(getUserPersonas(warehouseWorker, "armstrong")).toEqual(
      expect.arrayContaining(["warehouse_worker", "operator"])
    );
    expect(getUserPersonas(portalViewer, "armstrong")).toEqual(
      expect.arrayContaining(["viewer", "portal_user"])
    );
  });

  it("chooses the right default tenant path per persona", () => {
    expect(getDefaultTenantPath(tenantAdmin, "armstrong")).toBe("/dashboard");
    expect(getDefaultTenantPath(warehouseWorker, "armstrong")).toBe("/receive");
    expect(getDefaultTenantPath(portalViewer, "armstrong")).toBe("/portal/inventory");
  });
});
