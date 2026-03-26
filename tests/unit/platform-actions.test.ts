/**
 * @jest-environment node
 */

export {};

const mockRequireAuth = jest.fn();
const mockTenantFindUnique = jest.fn();
const mockTenantFindMany = jest.fn();
const mockTenantUpdate = jest.fn();
const mockTenantDelete = jest.fn();
const mockTenantUserUpsert = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserCreate = jest.fn();
const mockTransaction = jest.fn();
const mockExecuteRawUnsafe = jest.fn();
const mockProvisionTenant = jest.fn();
const mockRunTenantMigrations = jest.fn();
const mockSendPasswordSetLink = jest.fn();
const mockHash = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock("@/lib/auth/session", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    tenant: {
      findUnique: (...args: unknown[]) => mockTenantFindUnique(...args),
      findMany: (...args: unknown[]) => mockTenantFindMany(...args),
      update: (...args: unknown[]) => mockTenantUpdate(...args),
      delete: (...args: unknown[]) => mockTenantDelete(...args),
    },
    tenantUser: {
      upsert: (...args: unknown[]) => mockTenantUserUpsert(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
  },
}));

jest.mock("@/lib/db/provisioner", () => ({
  provisionTenant: (...args: unknown[]) => mockProvisionTenant(...args),
}));

jest.mock("@/lib/db/tenant-migrations", () => ({
  runTenantMigrations: (...args: unknown[]) => mockRunTenantMigrations(...args),
}));

jest.mock("@/lib/email/resend", () => ({
  sendPasswordSetLink: (...args: unknown[]) => mockSendPasswordSetLink(...args),
}));

jest.mock("bcryptjs", () => ({
  hash: (...args: unknown[]) => mockHash(...args),
}));

jest.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

describe("platform tenant actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      id: "superadmin-1",
      isSuperadmin: true,
    });
    mockHash.mockResolvedValue("placeholder-hash");
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        tenant: { delete: (...args: unknown[]) => mockTenantDelete(...args) },
        $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
      })
    );
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
  });

  it("creates a tenant and invites an existing admin with a fresh set-password link", async () => {
    process.env.AUTH_URL = "https://wms.ramola.app";
    mockTenantFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "tenant-1", dbSchema: "tenant_acme" });
    mockProvisionTenant.mockResolvedValue("tenant-1");
    mockTenantUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Existing User",
    });
    mockUserUpdate.mockResolvedValue({});
    mockTenantUserUpsert.mockResolvedValue({});
    mockSendPasswordSetLink.mockResolvedValue({ sent: true });

    const { createTenant } = await import("@/modules/platform/actions");
    const result = await createTenant(
      "Acme Warehousing",
      "acme",
      "professional",
      "admin@acme.com",
      "Acme Admin"
    );

    expect(result).toEqual({ id: "tenant-1", adminInvited: true });
    expect(mockProvisionTenant).toHaveBeenCalledWith("Acme Warehousing", "acme");
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        name: "Existing User",
        passwordSetToken: expect.any(String),
        passwordSetExpires: expect.any(Date),
      },
    });
    expect(mockTenantUserUpsert).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-1" } },
      update: { role: "admin" },
      create: { tenantId: "tenant-1", userId: "user-1", role: "admin" },
    });
    expect(mockSendPasswordSetLink).toHaveBeenCalledWith({
      to: "admin@acme.com",
      name: "Acme Admin",
      tenantName: "Acme Warehousing",
      role: "admin",
      setPasswordUrl: expect.stringMatching(/^https:\/\/wms\.ramola\.app\/set-password\?token=[a-f0-9]+$/),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/platform/tenants");
  });

  it("rejects duplicate tenant slugs before provisioning", async () => {
    mockTenantFindUnique.mockResolvedValue({ id: "existing-tenant" });

    const { createTenant } = await import("@/modules/platform/actions");
    const result = await createTenant("Duplicate", "acme", "starter");

    expect(result).toEqual({ error: 'Slug "acme" is already taken' });
    expect(mockProvisionTenant).not.toHaveBeenCalled();
  });

  it("reactivates a tenant by recreating the schema and rerunning tenant migrations", async () => {
    mockTenantFindUnique.mockResolvedValue({ id: "tenant-1", dbSchema: "tenant_acme" });
    mockExecuteRawUnsafe.mockResolvedValue(undefined);
    mockRunTenantMigrations.mockResolvedValue(undefined);
    mockTenantUpdate.mockResolvedValue({});

    const { reactivateTenant } = await import("@/modules/platform/actions");
    const result = await reactivateTenant("tenant-1");

    expect(result).toEqual({ ok: true });
    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS "tenant_acme"');
    expect(mockRunTenantMigrations).toHaveBeenCalledWith("tenant_acme");
    expect(mockTenantUpdate).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { status: "active" },
    });
  });

  it("blocks deletion of active tenants", async () => {
    mockTenantFindUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Acme",
      status: "active",
      dbSchema: "tenant_acme",
    });

    const { deleteTenant } = await import("@/modules/platform/actions");
    const result = await deleteTenant("tenant-1");

    expect(result).toEqual({ error: "Suspend the tenant before deleting it" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("deletes suspended tenants and drops their schema", async () => {
    mockTenantFindUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Acme",
      status: "suspended",
      dbSchema: "tenant_acme",
    });
    mockTenantDelete.mockResolvedValue({});
    mockExecuteRawUnsafe.mockResolvedValue(undefined);

    const { deleteTenant } = await import("@/modules/platform/actions");
    const result = await deleteTenant("tenant-1");

    expect(result).toEqual({ ok: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTenantDelete).toHaveBeenCalledWith({ where: { id: "tenant-1" } });
    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith('DROP SCHEMA IF EXISTS "tenant_acme" CASCADE');
    expect(mockRevalidatePath).toHaveBeenCalledWith("/platform/users");
  });
});
