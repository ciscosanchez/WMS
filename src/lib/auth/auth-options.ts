import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { publicDb } from "@/lib/db";
import { RateLimiter } from "@/lib/security/rate-limit";

/** Login rate limiter: 5 attempts per 15 minutes per email */
const loginLimiter = new RateLimiter(5, 15 * 60_000);

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

        // Rate limit by email address
        const email = (credentials.email as string).toLowerCase().trim();
        const { allowed } = await loginLimiter.check(`login:${email}`);
        if (!allowed) return null;

        const user = await publicDb.user.findUnique({
          where: { email },
          include: {
            tenantUsers: {
              include: { tenant: true },
            },
          },
        });

        if (!user) return null;

        const isValid = await compare(credentials.password as string, user.passwordHash);
        if (!isValid) return null;

        // Resolve tenant locale from first tenant's settings
        const tenantSettings = user.tenantUsers[0]?.tenant?.settings as Record<
          string,
          unknown
        > | null;
        const tenantLocale = (tenantSettings?.locale as string) ?? "en";

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperadmin: user.isSuperadmin,
          locale: user.locale ?? undefined,
          tenantLocale,
          tenants: user.tenantUsers.map((tu) => ({
            tenantId: tu.tenantId,
            slug: tu.tenant.slug,
            role: tu.role,
            portalClientId: tu.portalClientId ?? null,
          })),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.isSuperadmin = (user as any).isSuperadmin;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.tenants = (user as any).tenants;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.locale = (user as any).locale;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.tenantLocale = (user as any).tenantLocale;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).isSuperadmin = token.isSuperadmin;
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
  // Use cookies scoped to .wms.ramola.app so the session is shared
  // across all tenant subdomains (armstrong.wms.ramola.app, etc.)
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
              domain: ".wms.ramola.app",
            },
          },
          callbackUrl: {
            name: "__Secure-authjs.callback-url",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
              domain: ".wms.ramola.app",
            },
          },
          csrfToken: {
            name: "__Secure-authjs.csrf-token",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
              domain: ".wms.ramola.app",
            },
          },
        }
      : undefined,
});
