import { NextResponse } from "next/server";
import { endPortalSession } from "@/lib/portalAuth";

export async function POST() {
  await endPortalSession();
  return NextResponse.json({ ok: true });
}
