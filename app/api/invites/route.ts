import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ADMIN, audit, requireUser } from "@/lib/api";
import { newToken, sha256 } from "@/lib/tokens";
import { appUrl, devLink, sendMail } from "@/lib/mail";

const ROLES = ["Administrator", "Service manager", "Dispatcher", "Service coordinator", "Technician"] as const;
const body = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(ROLES) });

export async function GET() {
  const r = await requireUser(ADMIN);
  if ("error" in r) return r.error;
  const rows = await db.invite.findMany({ where: { orgId: r.user.orgId, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, role: true, expiresAt: true } });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const r = await requireUser(ADMIN);
  if ("error" in r) return r.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and choose a role." }, { status: 400 });
  const { email, role } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.status !== "Invited") return NextResponse.json({ error: "Someone with this email already has an account." }, { status: 409 });

  const token = newToken();
  await db.invite.create({ data: { orgId: r.user.orgId, email, role, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000), invitedById: r.user.id } });
  if (!existing) await db.user.create({ data: { orgId: r.user.orgId, name: email.split("@")[0], email, role, status: "Invited" } });

  const org = await db.organization.findUnique({ where: { id: r.user.orgId }, select: { name: true } });
  const link = `${appUrl()}/invite/${token}`;
  const { delivered } = await sendMail(email, `You're invited to ${org?.name ?? "ServiceOps"}`, `${r.user.name ?? "An administrator"} invited you to ${org?.name} on ServiceOps as ${role}.\n\nSet up your account:\n${link}\n\nThe link works for 7 days.`);
  await audit(r.user, "invite.create", "invite", email, { role });
  return NextResponse.json({ ok: true, email, role, devLink: devLink(delivered, link) });
}
