import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { issueToken } from "@/lib/tokens";
import { appUrl, devLink, sendMail } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  if (!rateLimit(`register:${clientIp(req)}`, 10, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name, a valid email and a password of at least 8 characters." }, { status: 400 });
  const { name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return NextResponse.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });

  const org = await db.organization.create({ data: { name: `${name.split(" ")[0]}'s company` } });
  await db.user.create({ data: { orgId: org.id, name, email, passwordHash: await bcrypt.hash(password, 12), role: "Administrator" } });

  const token = await issueToken(email, "verify", 60 * 24);
  const link = `${appUrl()}/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
  const { delivered } = await sendMail(email, "Verify your ServiceOps email", `Welcome to ServiceOps.\n\nConfirm your email to finish creating your account:\n${link}\n\nThe link works for 24 hours.`);
  return NextResponse.json({ ok: true, devLink: devLink(delivered, link) });
}
