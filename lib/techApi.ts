import { z } from "zod";
import { db } from "@/lib/db";
import { OFFICE, audit, type SessionUser } from "@/lib/api";
import { notify } from "@/lib/notify";
import { URGENCIES } from "@/lib/fieldPolicy";

/**
 * The few things a technician may do outside the job records, each strictly limited to a job assigned to them.
 * The job is read from the saved copy on the server, never from what the browser says about it.
 */

type SavedJob = { id: number; jobId: string; jobName: string; customer: string; serviceType: string; technician: string; priority: string; location: string; status: string };

/** The saved job, only when it is assigned to this technician. */
export async function assignedJob(user: SessionUser, jobId: number): Promise<SavedJob | null> {
  const row = await db.workspaceEntity.findUnique({ where: { orgId_kind_key: { orgId: user.orgId, kind: "jobs", key: String(jobId) } }, select: { json: true } });
  if (!row) return null;
  try {
    const job = JSON.parse(row.json) as SavedJob;
    return job.technician === (user.name ?? "").trim() && job.status !== "Cancelled" ? job : null;
  } catch { return null; }
}

/** The work order a job belongs to, from the saved copy. */
async function workOrderNumberFor(orgId: string, jobId: number): Promise<string | null> {
  const rows = await db.workspaceEntity.findMany({ where: { orgId, kind: "workOrders" }, select: { json: true } });
  for (const r of rows) { try { const w = JSON.parse(r.json) as { number: string; jobIds: number[] }; if (w.jobIds?.includes(jobId)) return w.number; } catch { /* skip unreadable record */ } }
  return null;
}

/** Exactly what the "Request extra work" form has. Anything else in the body is rejected. */
export const extraWorkBody = z.object({
  jobId: z.number().int().positive(),
  source: z.literal("Technician"),
  description: z.string().trim().min(5, "Describe the extra work.").max(1000),
  photoRef: z.string().trim().max(200).optional().default(""),
  urgency: z.enum(URGENCIES),
}).strict();

export async function createExtraWorkRequest(user: SessionUser, body: unknown): Promise<{ status: number; json: unknown }> {
  const parsed = extraWorkBody.safeParse(body);
  if (!parsed.success) return { status: 400, json: { error: parsed.error.issues[0]?.message ?? "Describe the extra work." } };
  const job = await assignedJob(user, parsed.data.jobId);
  if (!job) return { status: 403, json: { error: "You can only ask for extra work on jobs assigned to you." } };

  const { description, photoRef, urgency } = parsed.data;
  const woNumber = await workOrderNumberFor(user.orgId, job.id);
  const contact = await db.workspaceEntity.findUnique({ where: { orgId_kind_key: { orgId: user.orgId, kind: "customerDirectory", key: job.customer } }, select: { json: true } });
  let phone = "", email = "";
  try { const c = JSON.parse(contact?.json ?? "{}"); phone = String(c.phone ?? "").slice(0, 40); email = String(c.email ?? "").slice(0, 120); } catch { /* no contact on file */ }

  const last = await db.request.findFirst({ where: { orgId: user.orgId }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last ? Number(last.number.replace(/\D/g, "")) + 1 : 1001;
  const row = await db.request.create({
    data: {
      orgId: user.orgId, number: `REQ-${n}`, createdById: user.id, source: "Technician", status: "New",
      customerName: job.customer, contactName: `${user.name ?? "Technician"} (technician)`, phone: phone || null, email: email || null,
      serviceType: job.serviceType, workType: "Service", priority: urgency === "Urgent" ? "High" : urgency === "Low" ? "Low" : "Medium",
      title: `Extra work at ${job.jobId}: ${description.slice(0, 80)}`.slice(0, 160),
      description: `${description}\n\nRaised on site by ${user.name} from ${job.jobId}${woNumber ? ` (${woNumber})` : ""}. Urgency: ${urgency}.${photoRef ? ` Photo: ${photoRef}.` : ""}`,
      site: job.location || job.customer,
      details: JSON.stringify({ jobNumber: job.jobId, workOrder: woNumber ?? "", urgency, photoRef, equipment: "See description", serviceRequested: "Other" }),
    },
  });
  await audit(user, "request.create", "request", row.id, { source: "Technician", job: job.jobId });
  return { status: 201, json: row };
}

/** Stop work, unsafe: the office is told through the delivery log and by email to the people who can clear it. */
export const unsafeBody = z.object({
  event: z.literal("unsafe"),
  jobId: z.number().int().positive(),
  note: z.string().trim().min(3, "Say what is unsafe.").max(500),
}).strict();

export async function raiseUnsafe(user: SessionUser, body: unknown): Promise<{ status: number; json: unknown }> {
  const parsed = unsafeBody.safeParse(body);
  if (!parsed.success) return { status: 400, json: { error: parsed.error.issues[0]?.message ?? "Say what is unsafe." } };
  const job = await assignedJob(user, parsed.data.jobId);
  if (!job) return { status: 403, json: { error: "You can only raise this on jobs assigned to you." } };
  const people = await db.user.findMany({ where: { orgId: user.orgId, status: "Active", role: { in: OFFICE.filter(r => r !== "Service coordinator") } }, select: { email: true }, take: 10 });
  const subject = `STOP WORK: unsafe condition at ${job.jobId} (${job.customer})`;
  const text = `${user.name} stopped work on ${job.jobId}, ${job.customer}.\n\nReason: ${parsed.data.note}\n\nThe job is flagged and cannot be completed until a manager clears the flag on the job page.`;
  for (const p of people.length ? people : [{ email: "" }]) await notify(user.orgId, "email", "unsafe-condition", p.email, subject, text);
  await audit(user, "job.stop-work", "job", String(job.id), { job: job.jobId });
  return { status: 201, json: { ok: true, notified: people.length } };
}
