import type { TenantRole } from "../../node_modules/.prisma/public-client";

export type ArmstrongSeedUser = {
  email: string;
  name: string;
  password: string;
  isSuperadmin: boolean;
  role: TenantRole;
  portalClientCode?: string;
};

export const armstrongSeedUsers: ArmstrongSeedUser[] = [
  {
    email: "superadmin@ramola.io",
    name: "Platform Superadmin",
    password: "admin123",
    isSuperadmin: true,
    role: "admin",
  },
  {
    email: "admin@armstrong.com",
    name: "Cisco Sanchez",
    password: "admin123",
    isSuperadmin: false,
    role: "admin",
  },
  {
    email: "manager@armstrong.com",
    name: "Morgan Reyes",
    password: "manager123",
    isSuperadmin: false,
    role: "manager",
  },
  {
    email: "receiving@armstrong.com",
    name: "Alex Morgan",
    password: "receiving123",
    isSuperadmin: false,
    role: "warehouse_worker",
  },
  {
    email: "warehouse@armstrong.com",
    name: "Jamie Lee",
    password: "warehouse123",
    isSuperadmin: false,
    role: "warehouse_worker",
  },
  {
    email: "viewer@armstrong.com",
    name: "Taylor Brooks",
    password: "viewer123",
    isSuperadmin: false,
    role: "viewer",
  },
  {
    email: "portal@arteriors.com",
    name: "Lisa Chen",
    password: "portal123",
    isSuperadmin: false,
    role: "viewer",
    portalClientCode: "ARTERIORS",
  },
];
