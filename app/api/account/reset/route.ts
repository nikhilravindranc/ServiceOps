import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  if (!rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const { email, token, password } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  if (typeof password !== "string" || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!e || !token || !(await consumeToken(e, "reset", String(token)))) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 400 });
  await db.user.update({ where: { email: e }, data: { passwordHash: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: null, emailVerifiedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
