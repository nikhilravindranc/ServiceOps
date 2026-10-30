import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: { id: string; orgId: string; role: string; onboarded: boolean; name?: string | null; email?: string | null; image?: string | null };
  }
  interface User { orgId?: string; role?: string; onboarded?: boolean }
}
declare module "next-auth/jwt" {
  interface JWT { id?: string; orgId?: string; role?: string; onboarded?: boolean }
}
