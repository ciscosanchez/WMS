export interface TenantContext {
  tenantId: string;
  slug: string;
  dbSchema: string;
  db: any;
}

// Mock tenant context — no database required
// Replace with real implementation when DB is available
export async function getTenantFromHeaders(): Promise<string | null> {
  return "demo";
}

export async function resolveTenant(): Promise<TenantContext | null> {
  return {
    tenantId: "mock-tenant-1",
    slug: "demo",
    dbSchema: "tenant_demo",
    db: null, // No DB connection
  };
}
