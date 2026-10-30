import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api";

/** Progress for the Home "First steps" list. Counts only what is stored for this organization. */
export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const orgId = r.user.orgId;
  const [org, requests, catalog, people] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { name: true, onboardedAt: true } }),
    db.request.count({ where: { orgId } }),
    db.catalogItem.count({ where: { orgId } }),
    db.user.count({ where: { orgId } }),
  ]);
  return NextResponse.json({
    company: !!org && !org.name.endsWith("'s company"),
    request: requests > 0,
    catalog: catalog > 0,
    team: people > 1,
  });
}
