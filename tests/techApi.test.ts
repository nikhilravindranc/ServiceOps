import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useScratchDb } from "./helpers/db";

// What a technician may do outside the job records: ask for extra work and raise "stop work, unsafe", on their own jobs only.
let session: { user: { id: string; orgId: string; role: string; name: string; email: string } } | null = null;
vi.mock("@/auth", () => ({ auth: async () => session, signIn: vi.fn() }));

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let cleanup: () => void;
let POST_REQ: typeof import("@/app/api/requests/route")["POST"];
let GET_REQ: typeof import("@/app/api/requests/route")["GET"];
let POST_NOTIFY: typeof import("@/app/api/notifications/route")["POST"];
let ids = { org: "", tech: "", manager: "" };

const as = (id: string, role: string, name: string) => { session = { user: { id, orgId: ids.org, role, name, email: `${id}@t.test` } }; };
const req = (body: unknown) => POST_REQ(new Request("http://t/api/requests", { method: "POST", body: JSON.stringify(body) }));
const notify = (body: unknown) => POST_NOTIFY(new Request("http://t/api/notifications", { method: "POST", body: JSON.stringify(body) }));
const good = { jobId: 1, source: "Technician", description: "Second condenser fan is also failing", photoRef: "", urgency: "Urgent" };

beforeAll(async () => {
  cleanup = useScratchDb("techApi");
  ({ db } = await import("@/lib/db"));
  ({ POST: POST_REQ, GET: GET_REQ } = await import("@/app/api/requests/route"));
  ({ POST: POST_NOTIFY } = await import("@/app/api/notifications/route"));
  const org = await db.organization.create({ data: { name: "Co" } });
  const mk = (name: string, role: string) => db.user.create({ data: { orgId: org.id, name, email: `${name.replace(/\s/g, "").toLowerCase()}@x.test`, role, passwordHash: "x", emailVerifiedAt: new Date() } });
  ids = { org: org.id, tech: (await mk("Tia Tech", "Technician")).id, manager: (await mk("Mia Manager", "Service manager")).id };
  await mk("Dan Dispatcher", "Dispatcher");
  const row = (kind: string, key: string, json: object) => db.workspaceEntity.create({ data: { orgId: org.id, kind, key, json: JSON.stringify(json) } });
  await row("jobs", "1", { id: 1, jobId: "JOB-1", customer: "Acme", serviceType: "HVAC", technician: "Tia Tech", status: "On site", location: "New York, NY" });
  await row("jobs", "2", { id: 2, jobId: "JOB-2", customer: "Acme", serviceType: "HVAC", technician: "Someone Else", status: "On site", location: "New York, NY" });
  await row("workOrders", "7", { id: 7, number: "WO-2026-0007", jobIds: [1] });
});
afterAll(async () => { await db?.$disconnect(); cleanup?.(); });

describe("technician requests extra work", () => {
  it("creates a New request with source Technician, linked to the job and work order", async () => {
    as(ids.tech, "Technician", "Tia Tech");
    const res = await req(good);
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row).toMatchObject({ source: "Technician", status: "New", customerName: "Acme", priority: "High" });
    expect(row.description).toContain("JOB-1");
    expect(row.description).toContain("WO-2026-0007");
    as(ids.manager, "Service manager", "Mia Manager");
    expect((await (await GET_REQ(new Request("http://t/api/requests?status=New"))).json()).map((r: { number: string }) => r.number)).toContain(row.number);
  });
  it("refuses a job that is not theirs, and any extra or wrong field", async () => {
    as(ids.tech, "Technician", "Tia Tech");
    expect((await req({ ...good, jobId: 2 })).status).toBe(403);
    expect((await req({ ...good, jobId: 99 })).status).toBe(403);
    expect((await req({ ...good, source: "Phone" })).status).toBe(400);
    expect((await req({ ...good, status: "Converted" })).status).toBe(400);
    expect((await req({ ...good, customerName: "Other Co" })).status).toBe(400);
    expect((await req({ ...good, urgency: "Whenever" })).status).toBe(400);
    expect((await req({ ...good, description: "x" })).status).toBe(400);
  });
});

describe("technician raises stop work", () => {
  it("records a delivery-log entry for the office", async () => {
    as(ids.tech, "Technician", "Tia Tech");
    const res = await notify({ event: "unsafe", jobId: 1, note: "Gas smell near the unit" });
    expect(res.status).toBe(201);
    const log = await db.notificationLog.findMany({ where: { orgId: ids.org, event: "unsafe-condition" } });
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].subject).toContain("JOB-1");
  });
  it("only for their own job, with strict fields, and not for other roles", async () => {
    as(ids.tech, "Technician", "Tia Tech");
    expect((await notify({ event: "unsafe", jobId: 2, note: "Gas smell" })).status).toBe(403);
    expect((await notify({ event: "unsafe", jobId: 1, note: "Gas smell", to: "x@y.z" })).status).toBe(400);
    expect((await notify({ event: "unsafe", jobId: 1, note: "" })).status).toBe(400);
    as(ids.manager, "Service manager", "Mia Manager");
    expect((await notify({ event: "unsafe", jobId: 1, note: "Gas smell" })).status).toBe(403);
  });
});
