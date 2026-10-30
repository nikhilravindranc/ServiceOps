import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ADMIN, audit, requireUser } from "@/lib/api";
import { isHex, BRAND_THEMES } from "@/lib/brandTheme";

/** A saved colour theme: a ready-made id, or "custom" with one hex colour. */
const validBrand = (raw: string) => { try { const o = JSON.parse(raw); return o?.theme === "custom" ? isHex(o?.custom?.primary) : BRAND_THEMES.some(t => t.id === o?.theme); } catch { return false; } };

const patch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  industry: z.string().trim().max(80).optional(),
  timezone: z.string().trim().max(60).optional(),
  currency: z.string().trim().length(3).optional(),
  taxPct: z.number().min(0).max(100).optional(),
  hoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  serviceTypes: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  zones: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  homeBanner: z.string().regex(/^[a-z0-9-]{2,20}$/).optional(),
  homeBannerImage: z.string().max(1_500_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).nullable().optional(),
  brandTheme: z.string().max(200).refine(validBrand).optional(),
  revenueGoal: z.number().min(0).max(1e10).optional(),
  geoLat: z.number().min(-90).max(90).nullable().optional(),
  geoLng: z.number().min(-180).max(180).nullable().optional(),
  geoRadiusM: z.number().int().min(50).max(50000).nullable().optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,40}$/).optional(),
  bookingEnabled: z.boolean().optional(),
  arrivalWindowMins: z.number().int().min(30).max(480).optional(),
  onboardingStep: z.number().int().min(0).max(10).optional(),
  complete: z.boolean().optional(),
});

const shape = (o: NonNullable<Awaited<ReturnType<typeof db.organization.findUnique>>>) => ({
  ...o, serviceTypes: JSON.parse(o.serviceTypes) as string[], zones: JSON.parse(o.zones) as string[],
});

export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const org = await db.organization.findUnique({ where: { id: r.user.orgId } });
  return org ? NextResponse.json(shape(org)) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request) {
  const r = await requireUser(ADMIN);
  if ("error" in r) return r.error;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid details." }, { status: 400 });
  const { serviceTypes, zones, complete, ...rest } = parsed.data;
  if (rest.slug && (await db.organization.findFirst({ where: { slug: rest.slug, NOT: { id: r.user.orgId } } }))) return NextResponse.json({ error: "That address is taken. Try another." }, { status: 409 });
  const org = await db.organization.update({
    where: { id: r.user.orgId },
    data: {
      ...rest,
      ...(serviceTypes ? { serviceTypes: JSON.stringify(serviceTypes) } : {}),
      ...(zones ? { zones: JSON.stringify(zones) } : {}),
      ...(complete ? { onboardedAt: new Date() } : {}),
    },
  });
  await audit(r.user, complete ? "org.onboarding.complete" : "org.update", "organization", org.id);
  return NextResponse.json(shape(org));
}
