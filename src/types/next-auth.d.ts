import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isSuperadmin: boolean;
      authVersion: number;
      tenants: Array<{
        tenantId: string;
        slug: string;
        role: string;
        portalClientId?: string | null;
        permissionOverrides?: {
          grants: string[];
          denies: string[];
        } | null;
      }>;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isSuperadmin?: boolean;
    authVersion?: number;
    tenants?: Array<{
      tenantId: string;
      slug: string;
      role: string;
      portalClientId?: string | null;
      permissionOverrides?: {
        grants: string[];
        denies: string[];
      } | null;
    }>;
    locale?: string;
    tenantLocale?: string;
  }
}
