import { NextResponse } from "next/server";
import { read, testIdpEnabled } from "@/lib/testIdp";

export async function GET(req: Request) {
  if (!testIdpEnabled()) return NextResponse.json({ error: "not_available" }, { status: 404 });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const c = read(token, "token");
  if (!c) return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  return NextResponse.json({ sub: `test|${c.email}`, email: c.email, email_verified: true, name: c.name });
}
