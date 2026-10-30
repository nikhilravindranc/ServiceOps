import { NextResponse } from "next/server";
import { auth } from "@/auth";

export type SessionUser = { id: string; orgId: string; role: string; name?: string | null; email?: string | null };

/** Resolves the signed-in user for a route handler, or a ready-made error response. */
export async function requireUser(roles?: string[]): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (roles && !roles.includes(u.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user: u };
}

export const ADMIN = ["Administrator"];
export const MANAGERS = ["Administrator", "Service manager"];
export const OFFICE = ["Administrator", "Service manager", "Dispatcher", "Service coordinator"];

export async function audit(user: SessionUser | null, action: string, entity?: string, entityId?: string, meta?: unknown) {
  const { db } = await import("@/lib/db");
  await db.auditLog.create({ data: { orgId: user?.orgId, userId: user?.id, action, entity, entityId, meta: meta ? JSON.stringify(meta) : undefined } });
}
