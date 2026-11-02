import { NextResponse } from "next/server";
import { auth, signIn } from "@/auth";
import { db } from "@/lib/db";
import { DEMO_TEAM, demoMode, switchToken } from "@/lib/demo";
import { ROLES } from "@/lib/access";

/** People in the signed-in user's company that the demo role switcher can become: the administrator plus one person per role. */
async function people(orgId: string) {
  const emails: string[] = DEMO_TEAM.map(p => p.email);
  const rows = await db.user.findMany({
    where: { orgId, status: "Active", OR: [{ email: { in: emails } }, { role: "Administrator" }] },
    select: { name: true, email: true, role: true },
  });
  // One entry per role, administrator first.
  return ROLES.flatMap(role => rows.filter(r => r.role === role).slice(0, 1));
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !demoMode()) return NextResponse.json({ enabled: false, people: [] });
  return NextResponse.json({ enabled: true, current: session.user.email, people: await people(session.user.orgId) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !demoMode()) return NextResponse.json({ error: "Not available." }, { status: 403 });
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const target = (await people(session.user.orgId)).find(p => p.email === email);
  if (!target) return NextResponse.json({ error: "That person is not part of the demo team." }, { status: 400 });
  try {
    await signIn("demo-switch", { email: target.email, token: switchToken(target.email), redirect: false });
  } catch {
    return NextResponse.json({ error: "Could not switch role." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, role: target.role });
}
