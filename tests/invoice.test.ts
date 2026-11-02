import { beforeEach, describe, expect, it } from "vitest";
import { ALL_JOBS, getWorkspace, invoiceStage, setBillingPlan } from "@/lib/jobsData";
import { customerByName, invoiceReadiness, jobCharges, stageAmount } from "@/lib/serviceData";

const completed = () => ALL_JOBS.find(j => j.status === "Completed")!;
const open = () => ALL_JOBS.find(j => j.status === "On site" || j.status === "Scheduled")!;

describe("invoice readiness", () => {
  it("accepts a completed job whose customer has full billing details", () => {
    expect(invoiceReadiness(completed()).ok).toBe(true);
  });

  it("blocks a job that is not completed", () => {
    const r = invoiceReadiness(open());
    expect(r.ok).toBe(false);
    expect(r.problems[0].text).toMatch(/only completed jobs/);
  });

  it("blocks blank or invalid billing email and a missing address, and says what to fix", () => {
    const job = completed(); const c = customerByName(job.customer)!;
    const saved = { email: c.email, street: c.street };
    try {
      c.email = "not-an-email"; c.street = "";
      const text = invoiceReadiness(job).problems.map(p => p.text).join(" | ");
      expect(text).toMatch(/billing email/);
      expect(text).toMatch(/billing address/);
      expect(invoiceReadiness(job).problems.every(p => p.fixHref)).toBe(true);
    } finally { Object.assign(c, saved); }
    expect(invoiceReadiness(job).ok).toBe(true);
  });
});

describe("progress billing", () => {
  let job = open();
  beforeEach(() => { job = open(); getWorkspace(job.id).stages = undefined; });

  it("splits the job total with no rounding loss", () => {
    setBillingPlan(job.id, "Three stages (30 / 40 / 30)");
    const parts = [0, 1, 2].map(i => stageAmount(job, i));
    expect(parts.reduce((a, b) => a + b, 0)).toBe(jobCharges(job).total);
  });

  it("allows the deposit before the job is done, but not the final stage", () => {
    setBillingPlan(job.id, "Deposit and final (30 / 70)");
    expect(invoiceReadiness(job, 0).ok).toBe(true);
    expect(invoiceReadiness(job, 1).ok).toBe(false);
  });

  it("numbers stage invoices and does not raise one twice", () => {
    setBillingPlan(job.id, "Deposit and final (30 / 70)");
    const first = invoiceStage(job.id, 0)!;
    expect(first.number).toMatch(/-1$/);
    expect(invoiceStage(job.id, 0)!.number).toBe(first.number);
  });

  it("locks the plan once an invoice has been raised", () => {
    setBillingPlan(job.id, "Deposit and final (30 / 70)");
    invoiceStage(job.id, 0);
    setBillingPlan(job.id, "Four equal payments");
    expect(getWorkspace(job.id).stages).toHaveLength(2);
  });
});
