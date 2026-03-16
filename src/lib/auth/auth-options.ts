import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { publicDb } from "@/lib/db";

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

        const user = await publicDb.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            tenantUsers: {
              include: { tenant: true },
            },
          },
        });

        if (!user) return null;

        const isValid = await compare(credentials.password as string, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperadmin: user.isSuperadmin,
          tenants: user.tenantUsers.map((tu) => ({
            tenantId: tu.tenantId,
            slug: tu.tenant.slug,
            role: tu.role,
          })),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isSuperadmin = (user as any).isSuperadmin;
        token.tenants = (user as any).tenants;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).isSuperadmin = token.isSuperadmin;
        (session.user as any).tenants = token.tenants;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
