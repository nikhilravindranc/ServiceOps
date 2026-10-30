import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";

async function find(token: string) {
  return db.invite.findFirst({ where: { tokenHash: sha256(token), acceptedAt: null, expiresAt: { gt: new Date() } }, include: { org: { select: { name: true } } } });
}

/** Lets the invite page show who invited the person before they choose a password. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const inv = token ? await find(token) : null;
  if (!inv) return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 404 });
  return NextResponse.json({ email: inv.email, role: inv.role, company: inv.org.name });
}

export async function POST(req: Request) {
  const { token, name, password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < 8 || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Enter your name and a password of at least 8 characters." }, { status: 400 });
  }
  const inv = token ? await find(String(token)) : null;
  if (!inv) return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 404 });

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await db.user.findUnique({ where: { email: inv.email } });
  if (existing && existing.status !== "Invited") return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  if (existing) await db.user.update({ where: { id: existing.id }, data: { name: name.trim(), passwordHash, status: "Active", emailVerifiedAt: new Date(), role: inv.role } });
  else await db.user.create({ data: { orgId: inv.orgId, name: name.trim(), email: inv.email, passwordHash, role: inv.role, status: "Active", emailVerifiedAt: new Date() } });
  await db.invite.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  return NextResponse.json({ ok: true, email: inv.email });
}
