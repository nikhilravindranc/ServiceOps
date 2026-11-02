import {
  ALL_JOBS, getWorkspace, updateJob, logActivity, startJobWork, finishJobWork,
  type JobRecord, type JobWorkspace,
} from "@/lib/jobsData";
import { checklistFor, missingMandatory } from "@/lib/checklists";
import { DAY_MS, JOBS_TODAY_TS, PART_REQUESTS, datasetNow, workOrderForJob, type Part, type PartRequest } from "@/lib/serviceData";
import { UNATTENDED_ALLOWED, SIGN_OFF_LABEL, type FailReason, type SignOffKind } from "@/lib/fieldPolicy";

/** Where a technician is in a visit. Each step has exactly one next action. "incomplete" and "cancelled" end the visit with no action. */
export type TechStep = "go" | "arrive" | "start" | "complete" | "done" | "incomplete" | "cancelled";

export function techStep(job: JobRecord, ws: JobWorkspace): TechStep {
  if (job.status === "Completed") return "done";
  if (job.status === "Cancelled") return "cancelled";
  if (job.status === "Incomplete") return "incomplete";
  if (job.status === "On site") return ws.workStartedAt ? "complete" : "start";
  if (job.status === "En route") return "arrive";
  return "go";
}

export const STEP_LABEL: Record<TechStep, string> = {
  go: "On my way", arrive: "I've arrived", start: "Start work", complete: "Complete job", done: "Completed", incomplete: "Visit not finished", cancelled: "Job cancelled",
};

/** True while a "stop work, unsafe" flag is waiting for a manager to clear it. */
export const isStopped = (ws: JobWorkspace) => !!ws.safety && !ws.safety.clearedAt;

/** The sign-off on a job. Jobs signed before sign-off types existed only have a signature, which counts as the customer's. */
export function effectiveSignOff(ws: JobWorkspace): { kind: SignOffKind; name?: string; role?: string; note?: string } | null {
  if (ws.signOff) return ws.signOff;
  return ws.signature ? { kind: "customer", name: ws.signature.name } : null;
}

/** What is missing from the sign-off, or null when it is acceptable. */
export function signOffProblem(job: Pick<JobRecord, "serviceType">, ws: JobWorkspace): string | null {
  const s = effectiveSignOff(ws);
  if (!s) return "The job has not been signed off";
  const note = (s.note ?? "").trim();
  switch (s.kind) {
    case "customer": return ws.signature ? null : "The customer has not signed";
    case "other": return ws.signature && (s.name ?? "").trim() && (s.role ?? "").trim() ? null : "Name, role and signature of the person signing are needed";
    case "refused": return note.length >= 3 ? null : "Say why the customer refused to sign";
    case "unattended":
      if (!UNATTENDED_ALLOWED[job.serviceType]) return `${job.serviceType} work cannot be completed with nobody on site`;
      return note.length >= 3 ? null : "Say why nobody was on site";
  }
}

/** One plain sentence on how the job was signed off, for the report and the office. */
export function signOffSummary(ws: JobWorkspace): string {
  const s = effectiveSignOff(ws);
  if (!s) return "Not signed off";
  const label = SIGN_OFF_LABEL[s.kind];
  if (s.kind === "customer") return `${label}${s.name ? `: ${s.name}` : ""}`;
  if (s.kind === "other") return `${label}: ${s.name ?? ""} (${s.role ?? ""})`;
  return `${label}. Reason: ${s.note ?? ""}`;
}

/** "Other" needs a note; a reason is always needed. Returns what is missing, or null. */
export function failNoteProblem(reason: FailReason | "", note: string): string | null {
  if (!reason) return "Choose a reason.";
  if (reason === "Other" && note.trim().length < 3) return "Tell the office what happened.";
  return null;
}

/** What the technician is told happens after a visit is marked not finished. */
export const NEXT_STEPS_TEXT: Record<FailReason, string> = {
  "No access": "The office will try to reach the customer and rebook. A call-out fee may apply.",
  "Customer absent": "The office will contact the customer and rebook. A call-out fee may apply.",
  "Part missing": "The office will order the part and book a return visit. No charge to the customer.",
  "Unsafe to continue": "The office will review the site and rebook once it is safe.",
  "Equipment needs more work": "The office will plan the extra work with the customer and book a return visit.",
  Other: "The office will read your note and decide the next step.",
};

/** Units in a van after what the technician's jobs have used. Never negative. */
export const vanLeft = (start: number, used: number) => Math.max(0, start - used);
/** Whether `qty` can be taken from a van holding `left`, and how many are missing if not. */
export const vanCheck = (left: number, qty: number) => ({ ok: qty >= 1 && qty <= left, short: Math.max(0, qty - left) });

/** What must be done before a job can be completed. Empty means ready. */
export function completionProblems(job: Pick<JobRecord, "serviceType">, ws: JobWorkspace): string[] {
  const out: string[] = [];
  const missing = missingMandatory(job.serviceType, ws.checks);
  if (missing.length) out.push(`${missing.length} required checklist step${missing.length === 1 ? "" : "s"} not done`);
  if (isStopped(ws)) out.push("Stop-work flag is active: a manager must clear it first");
  const so = signOffProblem(job, ws);
  if (so) out.push(so);
  return out;
}

/** Performs the next action for a job. Returns a message to show, or null when nothing changed. */
export function advanceJob(job: JobRecord): string | null {
  const ws = getWorkspace(job.id);
  if (isStopped(ws)) return null; // work is stopped until a manager clears the flag
  switch (techStep(job, ws)) {
    case "go": updateJob(job.id, { status: "En route" }); logActivity(job.id, "Technician on the way"); return "Customer can now see you are on the way";
    case "arrive": updateJob(job.id, { status: "On site" }); logActivity(job.id, "Technician reached site"); return "Marked as arrived";
    case "start": startJobWork(job.id); return "Work timer started";
    case "complete": {
      if (completionProblems(job, ws).length) return null;
      finishJobWork(job.id);
      updateJob(job.id, { status: "Completed" });
      const done = ws.checks?.filter(Boolean).length ?? 0;
      logActivity(job.id, `Job completed (checklist ${done}/${checklistFor(job.serviceType).length})`);
      return "Job completed";
    }
    default: return null;
  }
}

const sameDay = (t: number, dayStart: number) => t >= dayStart && t < dayStart + DAY_MS;

/** A technician's jobs split into what matters today and what comes later. */
export function techJobs(name: string) {
  const mine = ALL_JOBS.filter(j => j.technician === name && j.status !== "Cancelled").sort((a, b) => a.scheduledAt - b.scheduledAt);
  const today = mine.filter(j => sameDay(j.scheduledAt, JOBS_TODAY_TS));
  const incomplete = today.filter(j => j.status === "Incomplete");
  const active = today.filter(j => j.status !== "Completed" && j.status !== "Incomplete");
  // A visit already under way comes first, otherwise the earliest one still to do.
  const focus = active.find(j => j.status === "On site") ?? active.find(j => j.status === "En route") ?? active[0];
  return {
    focus,
    todo: active.filter(j => j !== focus),
    done: today.filter(j => j.status === "Completed"),
    incomplete,
    later: mine.filter(j => j.scheduledAt >= JOBS_TODAY_TS + DAY_MS && j.status !== "Completed" && j.status !== "Incomplete").slice(0, 6),
    todayCount: today.length,
  };
}

/** The open request for a part on a job, if the technician already asked for it. */
export const openPartRequest = (jobId: number, partNo: string): PartRequest | undefined =>
  PART_REQUESTS.find(r => r.jobId === jobId && r.partNo === partNo && r.status !== "Delivered");

/** Asks the warehouse for a part the van does not have. A second ask for the same part on the same job returns the first. */
export function requestPartForJob(job: JobRecord, part: Part, qty: number): PartRequest {
  const open = openPartRequest(job.id, part.partNo);
  if (open) return open;
  let n = 500 + PART_REQUESTS.length;
  while (PART_REQUESTS.some(r => r.id === `PR-${String(n).padStart(4, "0")}`)) n++;
  const req: PartRequest = {
    id: `PR-${String(n).padStart(4, "0")}`, partNo: part.partNo, qty: Math.max(1, qty), technician: job.technician, jobId: job.id,
    woId: workOrderForJob(job.id)?.id ?? null, neededBy: job.scheduledAt, status: "Requested", raisedAt: datasetNow(),
  };
  PART_REQUESTS.unshift(req);
  logActivity(job.id, `Part requested from the warehouse: ${part.name} × ${req.qty} (${req.id})`);
  return req;
}
