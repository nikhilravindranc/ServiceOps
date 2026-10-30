import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SERVICE_PRICING, SERVICE_ZONES } from "../lib/serviceData";

const db = new PrismaClient();

/** Seeds one demo organization, its administrator, a priced catalog and a few open requests. Safe to re-run. */
async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || password.length < 8) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8+ characters) in .env first.");

  let org = await db.organization.findFirst({ where: { name: "ServiceOps Demo" } });
  if (!org) {
    org = await db.organization.create({
      data: {
        name: "ServiceOps Demo", industry: "Facilities & maintenance", taxPct: 18, onboardedAt: new Date(), onboardingStep: 5,
        serviceTypes: JSON.stringify(Object.keys(SERVICE_PRICING)), zones: JSON.stringify([...SERVICE_ZONES]),
      },
    });
  }

  await db.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 12), status: "Active", emailVerifiedAt: new Date() },
    create: { orgId: org.id, name: "Demo Administrator", email, passwordHash: await bcrypt.hash(password, 12), role: "Administrator", emailVerifiedAt: new Date() },
  });

  if ((await db.catalogItem.count({ where: { orgId: org.id } })) === 0) {
    const rows = Object.entries(SERVICE_PRICING).flatMap(([type, p]) => [
      { kind: "service", name: `${type} labour (per visit)`, unit: "visit", price: p.labor, cost: Math.round(p.labor * 0.55), serviceType: type, description: `Standard ${type.toLowerCase()} visit, about ${p.durationHrs} hours.` },
      ...p.parts.map(x => ({ kind: "product", name: x.item, unit: "each", price: x.rate, cost: Math.round(x.rate * 0.6), serviceType: type, description: null as string | null })),
    ]);
    await db.catalogItem.createMany({ data: rows.map(r => ({ ...r, orgId: org!.id })) });
  }

  if ((await db.request.count({ where: { orgId: org.id } })) === 0) {
    const seeds = [
      { customerName: "Harbor Dental", contactName: "Priya Nair", source: "Phone", serviceType: "HVAC", priority: "High", title: "Treatment room 3 not cooling", site: "Harbor Dental, 14 Quay St", status: "New" },
      { customerName: "Cedar Mall", contactName: "Tom Ellis", source: "Email", serviceType: "Electrical", priority: "Medium", title: "Flickering lights in food court", site: "Cedar Mall, Level 2", status: "New" },
      { customerName: "Lakeview Hotel", contactName: "Ana Souza", source: "Online booking", serviceType: "Plumbing", priority: "High", title: "Low water pressure, floors 6 to 8", site: "Lakeview Hotel", status: "Reviewing", campaign: "Spring maintenance" },
      { customerName: "Northgate Gym", contactName: "Marcus Bell", source: "Customer portal", serviceType: "Preventive", priority: "Low", title: "Quarterly service visit", site: "Northgate Gym", status: "New" },
      { customerName: "Pine St. Clinic", contactName: "Dr. Hana Kim", source: "Web form", serviceType: "Elevator", priority: "Medium", title: "Door reopening on floor 3", site: "Pine St. Clinic", status: "New" },
    ];
    for (const [i, s] of seeds.entries()) await db.request.create({ data: { orgId: org.id, number: `REQ-${1001 + i}`, ...s } });
  }
  console.log(`Seeded organization "${org.name}" with administrator ${email}.`);
}

main().finally(() => db.$disconnect());
