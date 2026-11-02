import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useScratchDb } from "./helpers/db";

// The route handlers read the signed-in person from Auth.js; here the "session" is whatever the test sets.
let session: { user: { id: string; orgId: string; role: string; name: string; email: string } } | null = null;
vi.mock("@/auth", () => ({ auth: async () => session, signIn: vi.fn() }));

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let cleanup: () => void;
let GET: typeof import("@/app/api/workspace/route")["GET"];
let PUT: typeof import("@/app/api/workspace/route")["PUT"];
let AUDIT: typeof import("@/app/api/audit/route")["GET"];
let requireUser: typeof import("@/lib/api")["requireUser"];

const ids = { orgA: "", orgB: "", manager: "", dispatcher: "", techA: "", techB: "", managerB: "" };

const as = (userId: string, role: string, orgId: string, name: string) => { session = { user: { id: userId, orgId, role, name, email: `${userId}@t.test` } }; };
const put = (body: unknown) => PUT(new Request("http://t/api/workspace", { method: "PUT", body: JSON.stringify(body) }));
const get = async () => (await GET()).json() as Promise<{ rows: [string, string, number, string][]; canWrite: boolean }>;
const job = (id: number, technician: string, status = "Scheduled") => JSON.stringify({ id, jobId: `JOB-${id}`, technician, status, customer: "Acme" });

beforeAll(async () => {
  cleanup = useScratchDb("workspace");
  ({ db } = await import("@/lib/db"));
  ({ GET, PUT } = await import("@/app/api/workspace/route"));
  ({ GET: AUDIT } = await import("@/app/api/audit/route"));
  ({ requireUser } = await import("@/lib/api"));

  const a = await db.organization.create({ data: { name: "Company A" } });
  const b = await db.organization.create({ data: { name: "Company B" } });
  const mk = (orgId: string, name: string, role: string) => db.user.create({ data: { orgId, name, email: `${name.replace(/\s/g, "").toLowerCase()}@${orgId}.test`, role, passwordHash: "x", emailVerifiedAt: new Date() } });
  Object.assign(ids, {
    orgA: a.id, orgB: b.id,
    manager: (await mk(a.id, "Mia Manager", "Service manager")).id,
    dispatcher: (await mk(a.id, "Dan Dispatcher", "Dispatcher")).id,
    techA: (await mk(a.id, "Tia Tech", "Technician")).id,
    techB: (await mk(a.id, "Tom Other", "Technician")).id,
    managerB: (await mk(b.id, "Bea Manager", "Service manager")).id,
  });

  // Company A's data: a customer, an estimate, and two jobs (one per technician).
  as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
  const r = await put({ changes: [
    ["customers", "acme", 0, JSON.stringify({ id: "acme", name: "Acme", email: "a@acme.test" })],
    ["estimates", "EST-1", 0, JSON.stringify({ number: "EST-1", status: "Draft", amount: 100 })],
    ["jobs", "1", 0, job(1, "Tia Tech")],
    ["jobs", "2", 0, job(2, "Tom Other")],
    ["workspaces", "1", 0, JSON.stringify({ photos: [], notes: [] })],
  ], deletes: [] });
  expect(r.status).toBe(200);
});

afterAll(async () => { await db?.$disconnect(); cleanup?.(); });

describe("company separation", () => {
  it("shows a company only its own records", async () => {
    as(ids.managerB, "Service manager", ids.orgB, "Bea Manager");
    expect((await get()).rows).toHaveLength(0);
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    expect((await get()).rows.length).toBeGreaterThanOrEqual(5);
  });

  it("never lets one company overwrite another's record, even with the same id", async () => {
    as(ids.managerB, "Service manager", ids.orgB, "Bea Manager");
    const res = await put({ changes: [["customers", "acme", 0, JSON.stringify({ id: "acme", name: "B's Acme" })]], deletes: [] });
    expect(res.status).toBe(200);
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    const a = (await get()).rows.find(r => r[0] === "customers" && r[1] === "acme")!;
    expect(JSON.parse(a[3]).name).toBe("Acme");
  });

  it("keeps the audit trail per company", async () => {
    as(ids.managerB, "Service manager", ids.orgB, "Bea Manager");
    const rows = await (await AUDIT(new Request("http://t/api/audit?limit=200"))).json() as { entityId: string; by: string }[];
    expect(rows.every(r => r.by === null || r.by === "Bea Manager")).toBe(true);
  });
});

describe("saving and conflicts", () => {
  it("refuses a stale edit and hands back the other person's copy", async () => {
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    const row = (await get()).rows.find(r => r[0] === "estimates")!;
    const first = await (await put({ changes: [["estimates", "EST-1", row[2], JSON.stringify({ number: "EST-1", status: "Sent", amount: 100 })]], deletes: [] })).json();
    expect(first.conflicts).toHaveLength(0);
    const stale = await (await put({ changes: [["estimates", "EST-1", row[2], JSON.stringify({ number: "EST-1", status: "Declined", amount: 100 })]], deletes: [] })).json();
    expect(stale.versions).toHaveLength(0);
    expect(stale.conflicts).toHaveLength(1);
    expect(JSON.parse(stale.conflicts[0][3]).status).toBe("Sent");
  });

  it("saves different records of the same company independently", async () => {
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    const rows = (await get()).rows;
    const cust = rows.find(r => r[0] === "customers")!;
    const est = rows.find(r => r[0] === "estimates")!;
    const a = await (await put({ changes: [["customers", "acme", cust[2], JSON.stringify({ id: "acme", name: "Acme Ltd", email: "a@acme.test" })]], deletes: [] })).json();
    const b = await (await put({ changes: [["estimates", "EST-1", est[2], JSON.stringify({ number: "EST-1", status: "Approved", amount: 100 })]], deletes: [] })).json();
    expect(a.conflicts).toHaveLength(0);
    expect(b.conflicts).toHaveLength(0);
  });

  it("rejects malformed saves", async () => {
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    expect((await PUT(new Request("http://t", { method: "PUT", body: "{nope" }))).status).toBe(400);
    expect((await put({ changes: [["estimates", 5, "x"]] })).status).toBe(400);
  });
});

describe("limits and backup", () => {
  it("refuses a single record over 2 MB", async () => {
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    const res = await put({ changes: [["customers", "huge", 0, JSON.stringify({ id: "huge", blob: "x".repeat(2_100_000) })]], deletes: [] });
    expect(res.status).toBe(413);
  });

  it("gives administrators a full export and nobody else", async () => {
    const { GET: EXPORT } = await import("@/app/api/workspace/export/route");
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    expect((await EXPORT()).status).toBe(403);
    const admin = await db.user.create({ data: { orgId: ids.orgA, name: "Ada Admin", email: "ada@a.test", role: "Administrator", passwordHash: "x", emailVerifiedAt: new Date() } });
    as(admin.id, "Administrator", ids.orgA, "Ada Admin");
    const res = await EXPORT();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/serviceops-backup-/);
    const body = await res.json();
    expect(body.records.length).toBeGreaterThan(3);
    expect(JSON.stringify(body.users)).not.toMatch(/passwordHash/);
    expect(body.records.every((x: { kind: string }) => typeof x.kind === "string")).toBe(true);
  });
});

describe("roles", () => {
  it("lets dispatchers save office records but not technicians save customers", async () => {
    as(ids.dispatcher, "Dispatcher", ids.orgA, "Dan Dispatcher");
    expect((await get()).canWrite).toBe(true);
    as(ids.techA, "Technician", ids.orgA, "Tia Tech");
    const cust = (await get()).rows.find(r => r[0] === "customers")!;
    expect((await put({ changes: [["customers", "acme", cust[2], JSON.stringify({ id: "acme", name: "Hacked" })]], deletes: [] })).status).toBe(403);
  });

  it("lets a technician save their own job and its workspace", async () => {
    as(ids.techA, "Technician", ids.orgA, "Tia Tech");
    const rows = (await get()).rows;
    const j = rows.find(r => r[0] === "jobs" && r[1] === "1")!;
    const w = rows.find(r => r[0] === "workspaces" && r[1] === "1")!;
    const res = await put({ changes: [["jobs", "1", j[2], job(1, "Tia Tech", "On site")], ["workspaces", "1", w[2], JSON.stringify({ photos: [], notes: [{ id: "n", text: "hi" }] })]], deletes: [] });
    expect(res.status).toBe(200);
    expect((await res.json()).conflicts).toHaveLength(0);
  });

  it("refuses a technician saving another technician's job, or deleting a job", async () => {
    as(ids.techA, "Technician", ids.orgA, "Tia Tech");
    const rows = (await get()).rows;
    const other = rows.find(r => r[0] === "jobs" && r[1] === "2")!;
    expect((await put({ changes: [["jobs", "2", other[2], job(2, "Tia Tech")]], deletes: [] })).status).toBe(403);
    const mine = rows.find(r => r[0] === "jobs" && r[1] === "1")!;
    expect((await put({ changes: [], deletes: [["jobs", "1", mine[2]]] })).status).toBe(403);
  });

  it("refuses a technician reassigning a job to someone else's name through the technician field", async () => {
    // The check is on the stored job: a job already assigned to Tom cannot be taken over by writing it as Tia's.
    as(ids.techA, "Technician", ids.orgA, "Tia Tech");
    const other = (await get()).rows.find(r => r[0] === "jobs" && r[1] === "2")!;
    expect((await put({ changes: [["jobs", "2", other[2], job(2, "Tia Tech", "Completed")]], deletes: [] })).status).toBe(403);
  });
});

describe("audit trail", () => {
  it("records who changed what, with before and after", async () => {
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    const rows = await (await AUDIT(new Request("http://t/api/audit?entity=estimates&entityId=EST-1&action=record.update"))).json() as { by: string; role: string; meta: { changed: string[]; before: Record<string, unknown>; after: Record<string, unknown> } }[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const sent = rows.find(r => r.meta.after.status === "Sent")!;
    expect(sent.by).toBe("Mia Manager");
    expect(sent.meta.changed).toEqual(["status"]);
    expect(sent.meta.before.status).toBe("Draft");
  });

  it("logs a first full save once, not record by record", async () => {
    const big = Array.from({ length: 40 }, (_, i) => ["customers", `c${i}`, 0, JSON.stringify({ id: `c${i}`, name: `C${i}` })]);
    as(ids.managerB, "Service manager", ids.orgB, "Bea Manager");
    expect((await put({ changes: big, deletes: [] })).status).toBe(200);
    const rows = await (await AUDIT(new Request("http://t/api/audit?limit=200"))).json() as { action: string }[];
    expect(rows.filter(r => r.action === "workspace.initial_save")).toHaveLength(1);
    expect(rows.filter(r => r.action === "record.create").length).toBeLessThan(5);
  });

  it("is closed to everyone except managers and administrators", async () => {
    for (const [id, role, name] of [[ids.dispatcher, "Dispatcher", "Dan Dispatcher"], [ids.techA, "Technician", "Tia Tech"]]) {
      as(id, role, ids.orgA, name);
      expect((await AUDIT(new Request("http://t/api/audit"))).status).toBe(403);
    }
  });
});

describe("signed-in checks use the database, not the sign-in token", () => {
  it("applies a changed role immediately", async () => {
    // The token still says Service manager, but the person has been made a Technician.
    await db.user.update({ where: { id: ids.dispatcher }, data: { role: "Technician" } });
    as(ids.dispatcher, "Service manager", ids.orgA, "Dan Dispatcher");
    const r = await requireUser(["Service manager", "Administrator"]);
    expect("error" in r && r.error.status).toBe(403);
    await db.user.update({ where: { id: ids.dispatcher }, data: { role: "Dispatcher" } });
  });

  it("rejects a deactivated person even with a valid token", async () => {
    await db.user.update({ where: { id: ids.techB }, data: { status: "Deactivated" } });
    as(ids.techB, "Technician", ids.orgA, "Tom Other");
    const r = await requireUser();
    expect("error" in r && r.error.status).toBe(401);
    expect((await GET()).status).toBe(401);
  });

  it("rejects a request with no session", async () => {
    session = null;
    expect((await GET()).status).toBe(401);
  });
});

describe("money rules on the server", () => {
  const ledger = (extra: object = {}) => JSON.stringify({ number: "INV-9", amount: 100, payments: [], credits: [], ...extra });

  it("lets only managers change payment settings", async () => {
    as(ids.dispatcher, "Dispatcher", ids.orgA, "Dan Dispatcher");
    expect((await put({ changes: [["paymentSettings", "default", 0, JSON.stringify({ depositPct: 30 })]], deletes: [] })).status).toBe(403);
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    expect((await put({ changes: [["paymentSettings", "default", 0, JSON.stringify({ depositPct: 30 })]], deletes: [] })).status).toBe(200);
  });

  it("lets any office role record a payment but only managers void an invoice", async () => {
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    expect((await put({ changes: [["invoiceLedger", "INV-9", 0, ledger()]], deletes: [] })).status).toBe(200);
    as(ids.dispatcher, "Dispatcher", ids.orgA, "Dan Dispatcher");
    const row = (await get()).rows.find(r => r[0] === "invoiceLedger" && r[1] === "INV-9")!;
    const paid = ledger({ payments: [{ id: "p1", amount: 40, method: "Cash" }] });
    expect((await put({ changes: [["invoiceLedger", "INV-9", row[2], paid]], deletes: [] })).status).toBe(200);
    const row2 = (await get()).rows.find(r => r[0] === "invoiceLedger" && r[1] === "INV-9")!;
    const voided = ledger({ payments: [{ id: "p1", amount: 40, method: "Cash" }], void: { by: "Dan", role: "Service manager", at: 1, reason: "typo", outcome: "credit" } });
    const denied = await put({ changes: [["invoiceLedger", "INV-9", row2[2], voided]], deletes: [] });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toMatch(/void/);
    as(ids.manager, "Service manager", ids.orgA, "Mia Manager");
    expect((await put({ changes: [["invoiceLedger", "INV-9", row2[2], voided]], deletes: [] })).status).toBe(200);
  });
});
