import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { geocodeAddress } from "@/lib/geocode";
import { rateLimit } from "@/lib/rateLimit";

const body = z.object({ query: z.string().trim().min(5).max(240) });

/** Geocode one address. Signed-in users only; 40 lookups a minute per user. Returns { found: false } when the address cannot be placed. */
export async function POST(req: Request) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  if (!rateLimit(`geocode:${r.user.id}`, 40, 60_000)) return NextResponse.json({ error: "Too many lookups. Try again in a minute." }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter an address to look up." }, { status: 400 });
  const hit = await geocodeAddress(parsed.data.query);
  return NextResponse.json(hit ? { found: true, lat: hit.lat, lng: hit.lng, cached: hit.cached } : { found: false });
}
