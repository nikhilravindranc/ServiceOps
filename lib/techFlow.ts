import {
  ALL_JOBS, getWorkspace, updateJob, logActivity, startJobWork, finishJobWork,
  type JobRecord, type JobWorkspace,
} from "@/lib/jobsData";
import { checklistFor, missingMandatory } from "@/lib/checklists";
import { DAY_MS, JOBS_TODAY_TS } from "@/lib/serviceData";

/** Where a technician is in a visit. Each step has exactly one next action. */
export type TechStep = "go" | "arrive" | "start" | "complete" | "done";

export function techStep(job: JobRecord, ws: JobWorkspace): TechStep {
  if (job.status === "Completed") return "done";
  if (job.status === "On site") return ws.workStartedAt ? "complete" : "start";
  if (job.status === "En route") return "arrive";
  return "go";
}

export const STEP_LABEL: Record<TechStep, string> = {
  go: "On my way", arrive: "I've arrived", start: "Start work", complete: "Complete job", done: "Completed",
};

/** What must be done before a job can be completed. Empty means ready. */
export function completionProblems(job: JobRecord, ws: JobWorkspace): string[] {
  const out: string[] = [];
  const missing = missingMandatory(job.serviceType, ws.checks);
  if (missing.length) out.push(`${missing.length} required checklist step${missing.length === 1 ? "" : "s"} not done`);
  if (!ws.signature) out.push("The customer has not signed");
  return out;
}

/** Performs the next action for a job. Returns a message to show, or null when nothing changed. */
export function advanceJob(job: JobRecord): string | null {
  const ws = getWorkspace(job.id);
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
  const active = today.filter(j => j.status !== "Completed");
  // A visit already under way comes first, otherwise the earliest one still to do.
  const focus = active.find(j => j.status === "On site") ?? active.find(j => j.status === "En route") ?? active[0];
  return {
    focus,
    todo: active.filter(j => j !== focus),
    done: today.filter(j => j.status === "Completed"),
    later: mine.filter(j => j.scheduledAt >= JOBS_TODAY_TS + DAY_MS && j.status !== "Completed").slice(0, 6),
    todayCount: today.length,
  };
}
