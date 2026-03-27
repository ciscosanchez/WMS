/**
 * @jest-environment node
 */

import { armstrongSeedUsers } from "../../scripts/seed-data/armstrong-personas";

describe("Armstrong seed persona matrix", () => {
  it("includes the expected platform and tenant personas", () => {
    expect(armstrongSeedUsers).toHaveLength(7);
    expect(armstrongSeedUsers.map((user) => user.email)).toEqual(
      expect.arrayContaining([
        "superadmin@ramola.io",
        "admin@armstrong.com",
        "manager@armstrong.com",
        "receiving@armstrong.com",
        "warehouse@armstrong.com",
        "viewer@armstrong.com",
        "portal@arteriors.com",
      ])
    );
  });

  it("includes at least one user for each required tenant persona", () => {
    const roles = armstrongSeedUsers.map((user) => user.role);

    expect(roles.filter((role) => role === "admin")).toHaveLength(2);
    expect(roles.filter((role) => role === "manager")).toHaveLength(1);
    expect(roles.filter((role) => role === "warehouse_worker")).toHaveLength(2);
    expect(roles.filter((role) => role === "viewer")).toHaveLength(2);
  });

  it("keeps the platform superadmin distinct from the tenant admin", () => {
    const superadmins = armstrongSeedUsers.filter((user) => user.isSuperadmin);
    const tenantAdmins = armstrongSeedUsers.filter(
      (user) => user.role === "admin" && !user.isSuperadmin
    );

    expect(superadmins).toHaveLength(1);
    expect(superadmins[0]?.email).toBe("superadmin@ramola.io");
    expect(tenantAdmins).toHaveLength(1);
    expect(tenantAdmins[0]?.email).toBe("admin@armstrong.com");
  });

  it("keeps exactly one portal-scoped persona bound to Arteriors", () => {
    const portalUsers = armstrongSeedUsers.filter((user) => user.portalClientCode);

    expect(portalUsers).toHaveLength(1);
    expect(portalUsers[0]).toMatchObject({
      email: "portal@arteriors.com",
      role: "viewer",
      portalClientCode: "ARTERIORS",
    });
  });
});
