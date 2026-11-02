import { describe, expect, it } from "vitest";
import { ALL_JOBS, getWorkspace, addJobPart, removeJobPart, setJobSignature, setJobNoSignature, clearJobSignOff, recordJobOutcome, flagJobUnsafe, clearJobUnsafe, vanUsed, type JobRecord } from "@/lib/jobsData";
import { PARTS, vanStock } from "@/lib/serviceData";
import { completionProblems, effectiveSignOff, failNoteProblem, isStopped, signOffProblem, signOffSummary, techStep, vanCheck, vanLeft } from "@/lib/techFlow";
import { UNATTENDED_ALLOWED, techCanCreateWork } from "@/lib/fieldPolicy";
import { resolveFollowUp, needsFollowUp } from "@/lib/followUp";

/** A job that is on site with every required checklist step done, so only the sign-off (and flags) decide completion. */
function readyJob(serviceType: JobRecord["serviceType"], id: number) {
  const job = { ...ALL_JOBS[0], id, jobId: `JOB-T${id}`, serviceType, status: "On site", technician: "Michael Thomas" } as JobRecord;
  const ws = getWorkspace(id);
  ws.checks = Array.from({ length: 12 }, () => true);
  return { job, ws };
}

describe("completion gate and sign-off", () => {
  it("needs some sign-off", () => {
    const { job, ws } = readyJob("HVAC", 9001);
    expect(completionProblems(job, ws)).toEqual(["The job has not been signed off"]);
  });
  it("accepts the customer's signature, and an old signature with no sign-off record", () => {
    const { job, ws } = readyJob("HVAC", 9002);
    ws.signature = { name: "Ann", dataUrl: "data:x", at: "now" };
    expect(effectiveSignOff(ws)?.kind).toBe("customer");
    expect(completionProblems(job, ws)).toEqual([]);
  });
  it("accepts another person only with name, role and signature", () => {
    const { job, ws } = readyJob("HVAC", 9003);
    setJobSignature(job.id, "Bo Lee", "data:x", { role: "Site manager" });
    expect(completionProblems(job, ws)).toEqual([]);
    expect(signOffSummary(ws)).toBe("Signed by another person on site: Bo Lee (Site manager)");
    ws.signOff!.role = " ";
    expect(signOffProblem(job, ws)).toMatch(/role/);
  });
  it("accepts a refusal only with a note, and drops the old signature", () => {
    const { job, ws } = readyJob("HVAC", 9004);
    setJobSignature(job.id, "Ann", "data:x");
    setJobNoSignature(job.id, "refused", "", "Michael Thomas");
    expect(ws.signature).toBeUndefined();
    expect(signOffProblem(job, ws)).toMatch(/refused/);
    setJobNoSignature(job.id, "refused", "Said the work was not done", "Michael Thomas");
    expect(completionProblems(job, ws)).toEqual([]);
    expect(signOffSummary(ws)).toContain("Customer refused to sign");
    clearJobSignOff(job.id);
    expect(effectiveSignOff(ws)).toBeNull();
  });
  it("allows unattended work only for job types that allow it", () => {
    expect(UNATTENDED_ALLOWED.HVAC).toBe(true);
    expect(UNATTENDED_ALLOWED.Elevator).toBe(false);
    const ok = readyJob("HVAC", 9005); setJobNoSignature(9005, "unattended", "Roof plant room, no one in", "Michael Thomas");
    expect(completionProblems(ok.job, ok.ws)).toEqual([]);
    const no = readyJob("Elevator", 9006); setJobNoSignature(9006, "unattended", "Nobody in", "Michael Thomas");
    expect(completionProblems(no.job, no.ws)).toEqual(["Elevator work cannot be completed with nobody on site"]);
  });
  it("blocks completion while a stop-work flag is active, until it is cleared", () => {
    const { job, ws } = readyJob("HVAC", 9007);
    setJobSignature(job.id, "Ann", "data:x");
    flagJobUnsafe(job.id, "Gas smell near the unit", "Michael Thomas");
    expect(isStopped(ws)).toBe(true);
    expect(completionProblems(job, ws)).toEqual(["Stop-work flag is active: a manager must clear it first"]);
    clearJobUnsafe(job.id, "Ventilated and checked", "Alex Morgan");
    expect(isStopped(ws)).toBe(false);
    expect(completionProblems(job, ws)).toEqual([]);
  });
});

describe("steps", () => {
  const base = { ...ALL_JOBS[0] } as JobRecord;
  const step = (status: JobRecord["status"], started = false) => techStep({ ...base, status }, { workStartedAt: started ? 1 : undefined } as never);
  it("moves go, arrive, start, complete, done", () => {
    expect(step("Scheduled")).toBe("go");
    expect(step("En route")).toBe("arrive");
    expect(step("On site")).toBe("start");
    expect(step("On site", true)).toBe("complete");
    expect(step("Completed")).toBe("done");
  });
  it("ends the visit with no action when it is incomplete or cancelled", () => {
    expect(step("Incomplete")).toBe("incomplete");
    expect(step("Cancelled")).toBe("cancelled");
  });
});

describe("failed visit", () => {
  it("needs a reason, and a note for Other", () => {
    expect(failNoteProblem("", "")).toBeTruthy();
    expect(failNoteProblem("No access", "")).toBeNull();
    expect(failNoteProblem("Other", "  ")).toBeTruthy();
    expect(failNoteProblem("Other", "Dog in the plant room")).toBeNull();
  });
  it("makes the job Incomplete, stops the timer and records the outcome", () => {
    const job = ALL_JOBS.find(j => j.status === "On site")!;
    const ws = getWorkspace(job.id);
    ws.workStartedAt = Date.now() - 60000; delete ws.workEndedAt;
    recordJobOutcome(job.id, "No access", "Gate locked", "Michael Thomas");
    expect(job.status).toBe("Incomplete");
    expect(ws.workEndedAt).toBeTruthy();
    expect(ws.outcome).toMatchObject({ reason: "No access", note: "Gate locked", by: "Michael Thomas" });
    expect(needsFollowUp().map(j => j.id)).toContain(job.id);
  });
  it("rebooking creates a linked follow-up job and records the decision once", () => {
    const job = ALL_JOBS.find(j => j.status === "Incomplete" && getWorkspace(j.id).outcome && !getWorkspace(j.id).outcome!.followUp)!;
    const created = resolveFollowUp(job, "Rebook with call-out fee", "Customer will leave a key", "2030-01-07T09:00", "Priya Raman")!;
    expect(getWorkspace(created.id).followUpOf?.jobId).toBe(job.id);
    expect(getWorkspace(job.id).outcome!.followUp).toMatchObject({ action: "Rebook with call-out fee", fee: 95, newJobId: created.id });
    expect(resolveFollowUp(job, "Cancel", "again", "", "x")).toBeUndefined();
    expect(needsFollowUp().map(j => j.id)).not.toContain(job.id);
  });
});

describe("van stock", () => {
  it("never goes negative and checks quantities", () => {
    expect(vanLeft(2, 5)).toBe(0);
    expect(vanCheck(3, 2)).toEqual({ ok: true, short: 0 });
    expect(vanCheck(1, 4)).toEqual({ ok: false, short: 3 });
    expect(vanCheck(0, 1).ok).toBe(false);
    expect(vanCheck(5, 0).ok).toBe(false);
  });
  it("takes parts from the technician's van and puts them back when removed", () => {
    const tech = "Michael Thomas";
    const part = PARTS.find(p => (p.techStock[tech] ?? 0) >= 2)!;
    const start = vanStock(part, tech);
    const jobId = ALL_JOBS.find(j => j.technician === tech)!.id;
    const ws = getWorkspace(jobId);
    const before = ws.extraParts.length;
    addJobPart(jobId, { item: part.name, qty: 2, rate: 1, partNo: part.partNo, fromVan: 2 });
    expect(vanStock(part, tech)).toBe(start - 2);
    expect(vanUsed(part.partNo, tech)).toBeGreaterThanOrEqual(2);
    removeJobPart(jobId, before);
    expect(vanStock(part, tech)).toBe(start);
  });
  it("keeps the company switch for technicians creating work off", () => {
    expect(techCanCreateWork).toBe(false);
  });
});
