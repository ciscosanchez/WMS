import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isSuperadmin: boolean;
      tenants: Array<{
        tenantId: string;
        slug: string;
        role: string;
      }>;
    };
  }
}
