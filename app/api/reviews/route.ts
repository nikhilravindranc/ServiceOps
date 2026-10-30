import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OFFICE, requireUser } from "@/lib/api";

/** Customer reviews and referral counts for Insights. */
export async function GET() {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const [recent, agg, referrals] = await Promise.all([
    db.review.findMany({ where: { orgId: r.user.orgId }, orderBy: { at: "desc" }, take: 5 }),
    db.review.aggregate({ where: { orgId: r.user.orgId }, _avg: { rating: true }, _count: true }),
    db.request.count({ where: { orgId: r.user.orgId, campaign: { startsWith: "Referral:" } } }),
  ]);
  return NextResponse.json({ count: agg._count, average: agg._avg.rating, referrals, recent });
}
