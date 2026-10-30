import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { authConfig } from "@/auth.config";
import { baseUrl, testIdpEnabled, TEST_CLIENTS } from "@/lib/testIdp";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const asUser = async (u: { id: string; name: string; email: string; role: string; orgId: string }) => {
  const org = await db.organization.findUnique({ where: { id: u.orgId }, select: { onboardedAt: true } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.orgId, onboarded: !!org?.onboardedAt };
};

export const oauthProviders = {
  google: !!process.env.AUTH_GOOGLE_ID,
  microsoft: !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
};

/** Stand-ins for Google and Microsoft in development when no client IDs are set. Same sign-in code path, local fake provider. */
const testProvider = (id: "google" | "microsoft-entra-id", name: string) => ({
  id, name, type: "oauth" as const,
  authorization: { url: `${baseUrl()}/dev-idp/authorize`, params: { scope: "openid email profile" } },
  token: `${baseUrl()}/api/dev-idp/token`,
  userinfo: `${baseUrl()}/api/dev-idp/userinfo`,
  clientId: TEST_CLIENTS[id], clientSecret: "test-secret",
  checks: ["state" as const],
  profile: (p: { sub: string; name: string; email: string }) => ({ id: p.sub, name: p.name, email: p.email }),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || user.status === "Deactivated") return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const fails = user.failedLogins + 1;
          await db.user.update({
            where: { id: user.id },
            data: fails >= MAX_FAILS
              ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
              : { failedLogins: fails },
          });
          return null;
        }
        if (!user.emailVerifiedAt) return null;
        await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
        return asUser(user);
      },
    }),
    Credentials({
      id: "otp",
      credentials: { email: {}, code: {} },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const user = await db.user.findUnique({ where: { email } });
        if (!user || user.status === "Deactivated") return null;
        if (!(await consumeToken(email, "otp", String(raw?.code ?? "")))) return null;
        await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), lastLoginAt: new Date() } });
        return asUser(user);
      },
    }),
    ...(oauthProviders.google ? [Google({})] : testIdpEnabled() ? [testProvider("google", "Google (test)")] : []),
    ...(oauthProviders.microsoft ? [MicrosoftEntraID({})] : testIdpEnabled() ? [testProvider("microsoft-entra-id", "Microsoft (test)")] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Social sign-in: existing people sign in; new people get a fresh organization (provider-verified email only).
    async signIn({ account, user, profile }) {
      if (account?.provider === "credentials" || account?.provider === "otp") return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return existing.status !== "Deactivated";
      if (account?.provider === "google" && !(profile as { email_verified?: boolean } | undefined)?.email_verified) return false;
      const name = user.name?.trim() || email.split("@")[0];
      const org = await db.organization.create({ data: { name: `${name.split(" ")[0]}'s company` } });
      await db.user.create({ data: { orgId: org.id, name, email, role: "Administrator", emailVerifiedAt: new Date() } });
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (account && account.provider !== "credentials" && account.provider !== "otp" && user?.email) {
        const u = await db.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (u) {
          await db.user.update({ where: { id: u.id }, data: { emailVerifiedAt: u.emailVerifiedAt ?? new Date(), lastLoginAt: new Date() } });
          user = (await asUser(u)) as typeof user;
        }
      }
      return authConfig.callbacks.jwt({ token, user, trigger, session } as never);
    },
  },
});
