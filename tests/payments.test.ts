import { afterEach, describe, expect, it } from "vitest";
import { ALL_JOBS, getWorkspace, recordJobPayment, setBillingPlan, generateInvoice, addJobPart, type JobRecord } from "@/lib/jobsData";
import {
  INVOICE_LEDGER, PAYMENT_SETTINGS, ESTIMATES, allInvoices, invoicesForJob, invoiceByNumber, invoiceReadiness, invoiceSummary, billingStateForJob,
  raiseInvoice, recordPayment, addInvoiceCredit, voidInvoice, reissueInvoice, reissueDraft, stageAmountFor, jobCharges, estimateForWO, workOrderForJob,
  savePaymentSettings, paymentSettings, customerByName, HISTORIC_INVOICE_STORE, effectiveDepositPct, applyLinkPayment, type Estimate,
} from "@/lib/serviceData";
import { balanceOf, stageAmounts, reissueNumber, nextCreditNumber, checkPayment } from "@/lib/ledger";

/** A completed job that has not been invoiced and can be (customer details complete). Each test takes the next one. */
const used = new Set<number>();
const take = (): JobRecord => {
  const j = ALL_JOBS.find(x => !used.has(x.id) && x.status === "Completed" && x.id % 3 === 0 && !getWorkspace(x.id).invoice && !getWorkspace(x.id).stages && invoiceReadiness(x).ok)!;
  used.add(j.id);
  return j;
};
const MANAGER = "Service manager";

afterEach(() => {
  for (const k of Object.keys(INVOICE_LEDGER)) delete INVOICE_LEDGER[k];
  delete PAYMENT_SETTINGS.company;
  for (const id of used) { const ws = getWorkspace(id); ws.invoice = null; delete ws.stages; delete ws.payment; delete ws.paidOn; ws.extraParts = []; }
  used.clear();
});

describe("payment ledger", () => {
  it("takes a partial payment, then the rest", () => {
    const job = take();
    const raised = raiseInvoice(job);
    let inv = invoiceByNumber(raised.number)!;
    expect(inv.balance).toBe(inv.amount);
    expect(inv.status).toBe("Sent");
    expect(recordPayment(inv, { amount: 100, method: "Cash", reference: "" }, "Priya")).toBeNull();
    inv = invoiceByNumber(raised.number)!;
    expect(inv.paid).toBe(100);
    expect(inv.balance).toBe(inv.amount - 100);
    expect(inv.status).toBe("Partially paid");
    expect(billingStateForJob(job.id)).toBe("Invoiced");
    expect(recordPayment(inv, { amount: inv.balance, method: "Bank transfer", reference: "TX-1" }, "Priya")).toBeNull();
    inv = invoiceByNumber(raised.number)!;
    expect(inv.balance).toBe(0);
    expect(inv.status).toBe("Paid");
    expect(inv.payments).toHaveLength(2);
    expect(billingStateForJob(job.id)).toBe("Paid");
  });

  it("refuses an overpayment, a zero amount, and a missing reference for non-cash", () => {
    const inv = invoiceByNumber(raiseInvoice(take()).number)!;
    expect(recordPayment(inv, { amount: inv.amount + 1, method: "Cash", reference: "" }, "Priya")).toMatch(/more than the balance/);
    expect(recordPayment(inv, { amount: 0, method: "Cash", reference: "" }, "Priya")).toMatch(/greater than zero/);
    expect(recordPayment(inv, { amount: 10, method: "Cheque", reference: " " }, "Priya")).toMatch(/reference/);
    expect(invoiceByNumber(inv.number)!.paid).toBe(0);
  });

  it("only takes methods the company allows", () => {
    expect(savePaymentSettings("Dispatcher", { methods: ["Cash"] })).toMatch(/Only a Service manager/);
    expect(savePaymentSettings(MANAGER, { methods: ["Cash"] })).toBeNull();
    const inv = invoiceByNumber(raiseInvoice(take()).number)!;
    expect(recordPayment(inv, { amount: 10, method: "Cheque", reference: "1" }, "Priya")).toMatch(/not an allowed/);
    expect(paymentSettings().methods).toEqual(["Cash"]);
  });

  it("applies a payment the technician took on site before the invoice existed", () => {
    const job = take();
    const total = jobCharges(job).total;
    recordJobPayment(job.id, { method: "Cheque", amount: 200, reference: "CH-9" });
    generateInvoice(job.id); // the technician screen's own call, no helper needed
    const inv = invoicesForJob(job.id)[0];
    expect(inv.paid).toBe(200);
    expect(inv.balance).toBe(total - 200);
    expect(inv.payments[0].method).toBe("Cheque");
    // Raising it through the helper saves the same payment once.
    raiseInvoice(job);
    expect(invoicesForJob(job.id)[0].paid).toBe(200);
    expect(INVOICE_LEDGER[inv.number].payments).toHaveLength(1);
  });

  it("applies a customer's pay-link payment once and never above the balance", () => {
    const inv = invoiceByNumber(raiseInvoice(take()).number)!;
    expect(applyLinkPayment(inv.number, "abc", inv.balance, "Visa ending 4242", Date.now())).toBe(true);
    expect(applyLinkPayment(inv.number, "abc", inv.balance, "Visa ending 4242", Date.now())).toBe(false);
    expect(invoiceByNumber(inv.number)!.status).toBe("Paid");
  });
});

describe("deposits", () => {
  it("shows the deposit as a payment already received and deducts it from the balance", () => {
    const job = take();
    const wo = workOrderForJob(job.id)!;
    const est = estimateForWO(wo.id) ?? (() => { const e = { id: `est-test-${wo.id}`, number: "EST-T-1", woId: wo.id, customer: wo.customer, issuedOn: 0, validUntil: 0, status: "Approved", lines: [] } as Estimate; ESTIMATES.push(e); return e; })();
    const before = est.depositPaid;
    est.depositPaid = 150;
    try {
      const inv = invoiceByNumber(raiseInvoice(job).number)!;
      expect(inv.deposit).toBe(150);
      expect(inv.payments[0]).toMatchObject({ amount: 150, kind: "deposit" });
      expect(inv.balance).toBe(inv.amount - 150);
      // Saved once: raising again or changing the invoice does not apply it twice.
      expect(recordPayment(inv, { amount: 50, method: "Cash", reference: "" }, "Priya")).toBeNull();
      const again = invoiceByNumber(inv.number)!;
      expect(again.deposit).toBe(150);
      expect(again.balance).toBe(inv.amount - 200);
    } finally { est.depositPaid = before; if (est.id.startsWith("est-test-")) ESTIMATES.splice(ESTIMATES.indexOf(est), 1); }
  });

  it("uses the company default deposit only when switched on, and an estimate's own value first", () => {
    expect(effectiveDepositPct({})).toBe(0);
    savePaymentSettings(MANAGER, { depositOn: true, depositPct: 25 });
    expect(effectiveDepositPct({})).toBe(25);
    expect(effectiveDepositPct({ depositPct: 10 })).toBe(10);
    expect(effectiveDepositPct({ depositPct: 0 })).toBe(0);
  });
});

describe("credit notes", () => {
  it("must have a reason and cannot be more than the remaining balance", () => {
    const inv = invoiceByNumber(raiseInvoice(take()).number)!;
    expect(addInvoiceCredit(inv, { amount: 50, reason: "" }, "Grace")).toMatchObject({ error: expect.stringMatching(/reason/) });
    expect(addInvoiceCredit(inv, { amount: inv.amount + 1, reason: "Too much" }, "Grace")).toMatchObject({ error: expect.stringMatching(/remaining balance/) });
    const ok = addInvoiceCredit(inv, { amount: 50, reason: "Part not fitted" }, "Grace");
    expect(ok).toMatchObject({ number: expect.stringMatching(/^CN-\d{5}$/) });
    const after = invoiceByNumber(inv.number)!;
    expect(after.balance).toBe(inv.amount - 50);
    // The next credit note cannot take more than what is left, and numbers go up.
    expect(addInvoiceCredit(after, { amount: after.balance + 1, reason: "Too much" }, "Grace")).toMatchObject({ error: expect.any(String) });
    const second = addInvoiceCredit(after, { amount: after.balance, reason: "Goodwill" }, "Grace") as { number: string };
    expect(second.number).toBe("CN-00002");
    expect(invoiceByNumber(inv.number)!.balance).toBe(0);
  });
});

describe("void and reissue", () => {
  it("needs a manager role and a reason; keeps the invoice, who, when and why", () => {
    const inv = invoiceByNumber(raiseInvoice(take()).number)!;
    expect(voidInvoice(inv, { reason: "Wrong parts", role: "Dispatcher" }, "Priya")).toMatch(/Only a Service manager/);
    expect(voidInvoice(inv, { reason: " ", role: MANAGER }, "Alex")).toMatch(/reason/);
    expect(voidInvoice(inv, { reason: "Wrong parts", role: MANAGER }, "Alex")).toBeNull();
    const v = invoiceByNumber(inv.number)!;
    expect(v.status).toBe("Void");
    expect(v.void).toMatchObject({ by: "Alex", reason: "Wrong parts" });
    expect(v.balance).toBe(0);
    expect(voidInvoice(v, { reason: "Again", role: MANAGER }, "Alex")).toMatch(/already void/);
    expect(billingStateForJob(inv.jobId)).toBe("Voided");
  });

  it("keeps money received as customer credit, or refunds it with a recorded entry", () => {
    const a = invoiceByNumber(raiseInvoice(take()).number)!;
    recordPayment(a, { amount: 80, method: "Cash", reference: "" }, "Priya");
    expect(voidInvoice(invoiceByNumber(a.number)!, { reason: "Wrong", role: MANAGER }, "Alex")).toMatch(/money already received/);
    expect(voidInvoice(invoiceByNumber(a.number)!, { reason: "Wrong", role: MANAGER, outcome: "credit" }, "Alex")).toBeNull();
    expect(invoiceByNumber(a.number)!.heldCredit).toBe(80);

    const b = invoiceByNumber(raiseInvoice(take()).number)!;
    recordPayment(b, { amount: 60, method: "Cash", reference: "" }, "Priya");
    expect(voidInvoice(invoiceByNumber(b.number)!, { reason: "Wrong", role: MANAGER, outcome: "refund" }, "Alex")).toBeNull();
    const rb = invoiceByNumber(b.number)!;
    expect(rb.heldCredit).toBe(0);
    expect(rb.payments.map(p => p.amount)).toEqual([60, -60]);
    expect(rb.payments[1].kind).toBe("refund");
  });

  it("reissues under a linked number with corrected items, moving held credit across", () => {
    const original = invoiceByNumber(raiseInvoice(take()).number)!;
    recordPayment(original, { amount: 80, method: "Cash", reference: "" }, "Priya");
    voidInvoice(invoiceByNumber(original.number)!, { reason: "Wrong rate", role: MANAGER, outcome: "credit" }, "Alex");
    const voided = invoiceByNumber(original.number)!;
    const draft = reissueDraft(voided);
    expect(reissueInvoice(voided, draft, "Dispatcher", "Priya")).toMatchObject({ error: expect.stringMatching(/Only a Service manager/) });
    expect(reissueInvoice(voided, { ...draft, lines: [{ item: " ", qty: 1, rate: 10 }] }, MANAGER, "Alex")).toMatchObject({ error: expect.stringMatching(/name/) });
    const r = reissueInvoice(voided, { ...draft, lines: draft.lines.map((l, i) => i === 0 ? { ...l, rate: l.rate + 100 } : l) }, MANAGER, "Alex") as { invoice: ReturnType<typeof invoiceByNumber> & object };
    expect(r.invoice.number).toBe(`${original.number}-R1`);
    expect(r.invoice.reissueOf).toBe(original.number);
    expect(invoiceByNumber(original.number)!.reissuedAs).toBe(r.invoice.number);
    expect(r.invoice.paid).toBe(80);
    expect(invoiceByNumber(original.number)!.heldCredit).toBe(0);
    expect(invoiceByNumber(r.invoice.number)!.balance).toBe(r.invoice.amount - 80);
    expect(allInvoices().filter(i => i.jobId === original.jobId).map(i => i.number)).toContain(r.invoice.number);
    expect(reissueInvoice(invoiceByNumber(original.number)!, draft, MANAGER, "Alex")).toMatchObject({ error: expect.stringMatching(/Already reissued/) });
  });

  it("will not reissue an invoice whose customer has a blank billing email", () => {
    const original = invoiceByNumber(raiseInvoice(take()).number)!;
    voidInvoice(original, { reason: "Wrong", role: MANAGER }, "Alex");
    const cust = (allInvoices().find(i => i.number === original.number)!).customer;
    const c = customerByName(cust)!;
    const saved = c.email; c.email = "";
    try { expect(reissueInvoice(invoiceByNumber(original.number)!, reissueDraft(original), MANAGER, "Alex")).toMatchObject({ error: expect.stringMatching(/email/) }); } finally { c.email = saved; }
  });
});

describe("invoice numbers", () => {
  it("shows a sample-history invoice once when its job is invoiced under the same number", () => {
    const job = take();
    const number = `INV-${job.jobId.replace(/\D/g, "")}`;
    const sample = { number, customer: job.customer, jobRef: job.jobId, issuedOn: 1, dueOn: 2, amount: 500, paid: 0, status: "Overdue" as const };
    HISTORIC_INVOICE_STORE.push(sample);
    try {
      expect(allInvoices().filter(i => i.number === number)).toHaveLength(1); // the sample one, until the job is invoiced
      raiseInvoice(job);
      const rows = allInvoices().filter(i => i.number === number);
      expect(rows).toHaveLength(1);
      expect(rows[0].jobId).toBe(job.id);
    } finally { HISTORIC_INVOICE_STORE.splice(HISTORIC_INVOICE_STORE.indexOf(sample), 1); }
  });
});

describe("totals", () => {
  it("Outstanding and Overdue are balances; void invoices are left out", () => {
    const before = invoiceSummary();
    const inv = invoiceByNumber(raiseInvoice(take()).number)!;
    expect(invoiceSummary().outstanding).toBeCloseTo(before.outstanding + inv.amount, 2);
    recordPayment(inv, { amount: 25, method: "Cash", reference: "" }, "Priya");
    expect(invoiceSummary().outstanding).toBeCloseTo(before.outstanding + inv.amount - 25, 2);
    expect(invoiceSummary().collected).toBeCloseTo(before.collected + 25, 2);
    voidInvoice(invoiceByNumber(inv.number)!, { reason: "Wrong", role: MANAGER, outcome: "refund" }, "Alex");
    expect(invoiceSummary().outstanding).toBeCloseTo(before.outstanding, 2);
    expect(invoiceSummary().collected).toBeCloseTo(before.collected, 2);
  });
});

describe("progress billing reconciliation", () => {
  it("keeps an invoiced stage as it was and puts the difference on the next stage", () => {
    const job = ALL_JOBS.find(j => !used.has(j.id) && j.status === "Completed" && !getWorkspace(j.id).invoice && !getWorkspace(j.id).stages && invoiceReadiness(j).ok)!;
    used.add(job.id);
    setBillingPlan(job.id, "Three stages (30 / 40 / 30)");
    const total0 = jobCharges(job).total;
    raiseInvoice(job); // stage 1
    const first = invoicesForJob(job.id)[0];
    expect(first.amount).toBe(Math.round(total0 * 0.3));
    // Charges change after stage 1 was invoiced.
    addJobPart(job.id, { item: "Extra valve", qty: 1, rate: 1000 });
    const total1 = jobCharges(job).total;
    expect(total1).toBeGreaterThan(total0);
    expect(invoicesForJob(job.id)[0].amount).toBe(first.amount); // not silently changed
    const s2 = stageAmountFor(job, 1);
    const plain = Math.round(total1 * 0.4);
    expect(s2.adjustment).toBe(Math.round(total1 * 0.3) - first.amount);
    expect(s2.adjustment).not.toBe(0);
    expect(s2.amount).toBe(plain + s2.adjustment);
    raiseInvoice(job); raiseInvoice(job);
    const all = invoicesForJob(job.id);
    expect(all.map(i => i.amount).reduce((a, b) => a + b, 0)).toBe(total1);
    expect(all[1].stage?.adjustment).toBe(s2.adjustment);
  });

  it("splits with no rounding loss (pure)", () => {
    const parts = stageAmounts(1001, [30, 40, 30], []);
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(1001);
    const after = stageAmounts(1201, [30, 40, 30], [{ amount: 300 }, undefined, undefined]);
    expect(after[0].amount).toBe(300);
    expect(after.reduce((s, p) => s + p.amount, 0)).toBe(1201);
  });
});

describe("pure helpers", () => {
  it("numbers reissues and credit notes", () => {
    expect(reissueNumber("INV-10481", [])).toBe("INV-10481-R1");
    expect(reissueNumber("INV-10481-R1", ["INV-10481-R1"])).toBe("INV-10481-R2");
    expect(nextCreditNumber(["CN-00007", "INV-1"])).toBe("CN-00008");
  });
  it("a void invoice has no balance", () => {
    expect(balanceOf({ amount: 100, payments: [], credits: [], void: { by: "a", role: "r", at: 1, reason: "x", outcome: "none" } })).toBe(0);
    expect(checkPayment({ amount: 100, payments: [], credits: [] }, { amount: 100, method: "Cash", reference: "" })).toBeNull();
  });
});
