import type { NextAuthConfig } from "next-auth";

/** Edge-safe part of the Auth.js config (no database access) — shared with the middleware. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name; // the stored account name, not whatever a social provider reports
        token.orgId = user.orgId;
        token.role = user.role;
        token.onboarded = user.onboarded;
      }
      if (trigger === "update" && typeof session?.onboarded === "boolean") token.onboarded = session.onboarded;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.orgId = token.orgId as string;
      session.user.role = token.role as string;
      session.user.onboarded = token.onboarded as boolean;
      return session;
    },
  },
} satisfies NextAuthConfig;
