import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { publicDb } from "@/lib/db";
import { getCookieDomain } from "@/lib/app-runtime";
import { RateLimiter } from "@/lib/security/rate-limit";
import {
  WMS_SSO_PROVIDER_COOKIE,
  WMS_SSO_TENANT_COOKIE,
  getEnabledSsoProviders,
  getTenantAuthConfigForCurrentRequest,
  getTenantAuthConfigForSlug,
  isMicrosoftEntraConfigured,
  isPasswordLoginAllowed,
  isSsoEmailAllowed,
} from "@/lib/auth/tenant-auth";
import { normalizePermissionOverrides } from "@/lib/auth/rbac";

/** Login rate limiter: 5 attempts per 15 minutes per email */
const loginLimiter = new RateLimiter(5, 15 * 60_000);

async function getUserWithTenantsByEmail(email: string) {
  return publicDb.user.findUnique({
    where: { email },
    include: {
      tenantUsers: {
        include: { tenant: true },
      },
    },
  });
}

function toAuthUser(user: NonNullable<Awaited<ReturnType<typeof getUserWithTenantsByEmail>>>) {
  const tenantSettings = user.tenantUsers[0]?.tenant?.settings as Record<string, unknown> | null;
  const tenantLocale = (tenantSettings?.locale as string) ?? "en";

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isSuperadmin: user.isSuperadmin,
    authVersion: user.authVersion,
    locale: user.locale ?? undefined,
    tenantLocale,
    tenants: user.tenantUsers.map((tu) => ({
      tenantId: tu.tenantId,
      slug: tu.tenant.slug,
      role: tu.role,
      portalClientId: tu.portalClientId ?? null,
      permissionOverrides: normalizePermissionOverrides(tu.permissionOverrides),
    })),
  };
}

function applyAuthUserToToken(token: Record<string, unknown>, user: ReturnType<typeof toAuthUser>) {
  token.id = user.id;
  token.email = user.email;
  token.name = user.name;
  token.isSuperadmin = user.isSuperadmin;
  token.authVersion = user.authVersion;
  token.tenants = user.tenants;
  token.locale = user.locale;
  token.tenantLocale = user.tenantLocale;
  return token;
}

async function getPendingSsoContext() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get(WMS_SSO_TENANT_COOKIE)?.value ?? null;
  const providerId = cookieStore.get(WMS_SSO_PROVIDER_COOKIE)?.value ?? null;

  return { tenantSlug, providerId };
}

async function clearPendingSsoContext() {
  const cookieStore = await cookies();
  cookieStore.delete(WMS_SSO_TENANT_COOKIE);
  cookieStore.delete(WMS_SSO_PROVIDER_COOKIE);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { authConfig } = await getTenantAuthConfigForCurrentRequest();
        if (!isPasswordLoginAllowed(authConfig)) return null;

        // Rate limit by email address
        const email = (credentials.email as string).toLowerCase().trim();
        const { allowed } = await loginLimiter.check(`login:${email}`);
        if (!allowed) return null;

        const user = await getUserWithTenantsByEmail(email);

        if (!user) return null;

        const isValid = await compare(credentials.password as string, user.passwordHash);
        if (!isValid) return null;

        return toAuthUser(user);
      },
    }),
    ...(isMicrosoftEntraConfigured()
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "microsoft-entra-id") return true;

      try {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        const { tenantSlug, providerId } = await getPendingSsoContext();
        if (!tenantSlug || !providerId) return false;

        const authConfig = await getTenantAuthConfigForSlug(tenantSlug);
        const provider = getEnabledSsoProviders(authConfig).find((item) => item.id === providerId);
        if (!provider || provider.type !== "microsoft") return false;
        if (!isSsoEmailAllowed(provider, email)) return false;

        const dbUser = await getUserWithTenantsByEmail(email);
        if (!dbUser) return false;

        return (
          dbUser.isSuperadmin || dbUser.tenantUsers.some((tu) => tu.tenant.slug === tenantSlug)
        );
      } finally {
        await clearPendingSsoContext();
      }
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "microsoft-entra-id") {
        const email =
          typeof user?.email === "string"
            ? user.email.toLowerCase().trim()
            : typeof token.email === "string"
              ? token.email.toLowerCase().trim()
              : null;

        if (!email) return token;

        const dbUser = await getUserWithTenantsByEmail(email);
        if (!dbUser) return token;

        return applyAuthUserToToken(token, toAuthUser(dbUser));
      }

      if (user) {
        return applyAuthUserToToken(token, user as ReturnType<typeof toAuthUser>);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).isSuperadmin = token.isSuperadmin;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).authVersion = token.authVersion;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).tenants = token.tenants;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).locale = token.locale;
      }
      return session;
    },
  },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  // Scope cookies to the base app domain in production so tenant subdomains
  // share the same auth/session state.
  cookies:
    process.env.NODE_ENV === "production"
      ? {
          sessionToken: {
            name: "__Secure-authjs.session-token",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
              domain: getCookieDomain(),
            },
          },
          callbackUrl: {
            name: "__Secure-authjs.callback-url",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
              domain: getCookieDomain(),
            },
          },
          csrfToken: {
            name: "__Secure-authjs.csrf-token",
            options: {
              httpOnly: false,
              sameSite: "lax",
              path: "/",
              secure: true,
              domain: getCookieDomain(),
            },
          },
        }
      : undefined,
});
