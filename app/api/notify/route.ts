import { NextResponse } from "next/server";
import { z } from "zod";
import { OFFICE, audit, requireUser } from "@/lib/api";
import { notify } from "@/lib/notify";

const body = z.object({
  channel: z.enum(["email", "sms", "whatsapp"]).default("email"),
  event: z.string().trim().min(1).max(60),
  to: z.string().trim().max(160),
  subject: z.string().trim().max(200),
  message: z.string().trim().min(1).max(2000),
});

/** Sends one customer message from the office app (for example, "your visit is booked") and records it in the log. */
export async function POST(req: Request) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  const d = parsed.data;
  const status = await notify(r.user.orgId, d.channel, d.event, d.to, d.subject, d.message);
  await audit(r.user, "notify.send", d.event, d.to);
  return NextResponse.json({ status });
}
