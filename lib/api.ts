import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type SessionUser = { id: string; orgId: string; role: string; name?: string | null; email?: string | null };

/** Resolves the signed-in user for a route handler, or a ready-made error response. */
export async function requireUser(roles?: string[]): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  // The database is the source of truth, not the sign-in token: a changed role or a deactivated person takes effect on the next request.
  const row = await db.user.findUnique({ where: { id: u.id }, select: { role: true, status: true, orgId: true, name: true } });
  if (!row || row.status === "Deactivated") return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = { ...u, role: row.role, orgId: row.orgId, name: row.name };
  if (roles && !roles.includes(user.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export const ADMIN = ["Administrator"];
export const MANAGERS = ["Administrator", "Service manager"];
export const OFFICE = ["Administrator", "Service manager", "Dispatcher", "Service coordinator"];

export async function audit(user: SessionUser | null, action: string, entity?: string, entityId?: string, meta?: unknown) {
  const { db } = await import("@/lib/db");
  await db.auditLog.create({ data: { orgId: user?.orgId, userId: user?.id, action, entity, entityId, meta: meta ? JSON.stringify(meta) : undefined } });
}
