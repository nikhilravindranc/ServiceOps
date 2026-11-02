/**
 * Invoice ledger: payments, credit notes and voids, as plain functions on plain data (no React, no server code),
 * so the browser, the customer pay page's API and the tests all use the same arithmetic.
 *
 * balance = amount - payments received - credit notes. A void invoice owes nothing; money already received on it stays
 * on the ledger as customer credit, or is paid back by a recorded refund entry (a negative payment).
 */
export const PAYMENT_METHODS = ["Cash", "Card on terminal", "Cheque", "Bank transfer", "Card (test)", "Other"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export interface Payment {
  id: string;
  /** Negative for a refund or for credit moved to another invoice. */
  amount: number;
  method: PaymentMethod;
  reference: string;
  at: number;
  recordedBy: string;
  kind?: "deposit" | "refund" | "transfer";
}
export interface CreditNote { number: string; amount: number; reason: string; at: number; by: string }
export interface VoidInfo { by: string; role: string; at: number; reason: string; outcome: "none" | "credit" | "refund" }
export interface InvoiceLine { item: string; qty: number; rate: number }

/** What is saved for one invoice (keyed by invoice number). */
export interface LedgerEntry {
  number: string;
  amount: number;
  payments: Payment[];
  credits: CreditNote[];
  void?: VoidInfo;
  reissueOf?: string;
  reissuedAs?: string;
  customer?: string; jobRef?: string; jobId?: number; woNumber?: string; issuedOn?: number; dueOn?: number;
  /** Items of a reissued invoice (a job's own invoice reads them from the job). */
  lines?: InvoiceLine[]; taxPct?: number; discount?: number;
  stage?: { index: number; label: string; pct: number };
  /** A draft has not been sent: it can still be edited and cannot be voided. */
  draft?: boolean;
}
export type Ledgerish = Pick<LedgerEntry, "amount" | "payments" | "credits" | "void">;

export type InvoiceStatus = "Draft" | "Sent" | "Partially paid" | "Paid" | "Overdue" | "Void";

export const MANAGEMENT_ROLES: readonly string[] = ["Administrator", "Service manager"];
export const canManageMoney = (role: string | undefined) => !!role && MANAGEMENT_ROLES.includes(role);

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const sumPayments = (e: Pick<Ledgerish, "payments">) => round2(e.payments.reduce((s, p) => s + p.amount, 0));
export const sumCredits = (e: Pick<Ledgerish, "credits">) => round2(e.credits.reduce((s, c) => s + c.amount, 0));

/** What the customer still owes. A void invoice owes nothing. */
export const balanceOf = (e: Ledgerish) => (e.void ? 0 : Math.max(0, round2(e.amount - sumPayments(e) - sumCredits(e))));
/** Money received on a void invoice that has not been refunded or moved: held as customer credit. */
export const heldCredit = (e: Ledgerish) => (e.void ? Math.max(0, sumPayments(e)) : 0);

export function statusOf(e: Ledgerish, dueOn: number, now: number, draft = false): InvoiceStatus {
  if (e.void) return "Void";
  if (draft) return "Draft";
  const balance = balanceOf(e);
  if (balance <= 0 && e.amount > 0) return "Paid";
  if (balance > 0 && dueOn < now) return "Overdue";
  return sumPayments(e) > 0 ? "Partially paid" : "Sent";
}

export const needsReference = (method: string) => method !== "Cash";

export interface PaymentInput { amount: number; method: string; reference: string; at: number; by: string }

/** Why this payment cannot be recorded, or null. */
export function checkPayment(e: Ledgerish, input: Pick<PaymentInput, "amount" | "method" | "reference">, allowed: readonly string[] = PAYMENT_METHODS): string | null {
  if (e.void) return "This invoice is void; it cannot take payments.";
  const balance = balanceOf(e);
  if (balance <= 0) return "This invoice has no balance left to pay.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Enter an amount greater than zero.";
  if (round2(input.amount) > balance) return `The amount is more than the balance of ${usd(balance)}.`;
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) return "Choose how the payment was made.";
  if (!allowed.includes(input.method)) return `${input.method} is not an allowed payment method (see Settings, Payments).`;
  if (needsReference(input.method) && !input.reference.trim()) return "Enter a reference (cheque number, transfer reference or card receipt).";
  return null;
}

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** Adds the payment to the ledger, or returns why not. */
export function addPayment(e: LedgerEntry, input: PaymentInput, allowed: readonly string[] = PAYMENT_METHODS, id?: string): string | null {
  const err = checkPayment(e, input, allowed);
  if (err) return err;
  e.payments.push({ id: id ?? newId("pay"), amount: round2(input.amount), method: input.method as PaymentMethod, reference: input.reference.trim(), at: input.at, recordedBy: input.by });
  return null;
}

export function nextCreditNumber(existing: Iterable<string>): string {
  let max = 0;
  for (const n of existing) { const m = /^CN-(\d+)$/.exec(n); if (m) max = Math.max(max, Number(m[1])); }
  return `CN-${String(max + 1).padStart(5, "0")}`;
}

export function checkCredit(e: Ledgerish, input: { amount: number; reason: string }): string | null {
  if (e.void) return "This invoice is void; issue a credit note on the replacement invoice instead.";
  const balance = balanceOf(e);
  if (balance <= 0) return "This invoice has no balance left to credit.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Enter an amount greater than zero.";
  if (round2(input.amount) > balance) return `A credit note cannot be more than the remaining balance of ${usd(balance)}.`;
  if (input.reason.trim().length < 3) return "Give a reason for the credit note.";
  return null;
}

export function addCreditNote(e: LedgerEntry, input: { amount: number; reason: string; by: string; at: number }, number: string): string | null {
  const err = checkCredit(e, input);
  if (err) return err;
  e.credits.push({ number, amount: round2(input.amount), reason: input.reason.trim(), at: input.at, by: input.by });
  return null;
}

/** Only a Service manager or Administrator may void, and always with a reason. A sent invoice is never edited. */
export function checkVoid(e: Ledgerish, input: { reason: string; role: string; outcome?: "credit" | "refund" }, draft = false): string | null {
  if (!canManageMoney(input.role)) return "Only a Service manager or Administrator can void an invoice.";
  if (e.void) return "This invoice is already void.";
  if (draft) return "A draft has not been sent; edit it instead of voiding it.";
  if (input.reason.trim().length < 3) return "Give a reason for voiding the invoice.";
  if (sumPayments(e) > 0 && !input.outcome) return "Say what happens to the money already received: keep it as customer credit, or refund it.";
  return null;
}

/** Voids the invoice. Payments stay on the ledger as customer credit, or a refund entry pays them back. */
export function voidEntry(e: LedgerEntry, input: { reason: string; role: string; by: string; at: number; outcome?: "credit" | "refund" }, draft = false): string | null {
  const err = checkVoid(e, input, draft);
  if (err) return err;
  const received = sumPayments(e);
  let outcome: VoidInfo["outcome"] = "none";
  if (received > 0) {
    outcome = input.outcome!;
    if (outcome === "refund") {
      const last = [...e.payments].reverse().find(p => p.amount > 0);
      e.payments.push({ id: newId("refund"), amount: -received, method: last?.method ?? "Other", reference: `Refund: ${input.reason.trim()}`, at: input.at, recordedBy: input.by, kind: "refund" });
    }
  }
  e.void = { by: input.by, role: input.role, at: input.at, reason: input.reason.trim(), outcome };
  return null;
}

/** INV-10481 -> INV-10481-R1, then -R2 (a reissue of a reissue keeps the same root). */
export function reissueNumber(original: string, taken: Iterable<string>): string {
  const root = original.replace(/-R\d+$/, "");
  const used = new Set(taken);
  let n = 1;
  while (used.has(`${root}-R${n}`)) n++;
  return `${root}-R${n}`;
}

export const lineTotal = (lines: InvoiceLine[], taxPct: number, discount: number) =>
  round2(lines.reduce((s, l) => s + l.qty * l.rate, 0) * (1 + taxPct / 100) - discount);

/** What is wrong with the items of an invoice about to go to a customer (nothing blank, nothing wrong). */
export function checkLines(lines: InvoiceLine[], taxPct: number, discount: number): string[] {
  const out: string[] = [];
  if (!lines.length) out.push("Add at least one item.");
  if (lines.some(l => !l.item.trim())) out.push("Every item needs a name.");
  if (lines.some(l => !(l.qty > 0))) out.push("Every item needs a quantity above zero.");
  if (lines.some(l => !(l.rate >= 0) || !Number.isFinite(l.rate))) out.push("Every item needs a price.");
  if (!(taxPct >= 0 && taxPct <= 100)) out.push("Tax must be between 0 and 100%.");
  if (!(discount >= 0)) out.push("The discount cannot be negative.");
  if (!out.length && !(lineTotal(lines, taxPct, discount) > 0)) out.push("The invoice total must be more than zero.");
  return out;
}

/** The totals every screen shows, from the same helper: Outstanding, Overdue and Paid all use balances. */
export function invoiceTotals<T extends Ledgerish & { status: InvoiceStatus }>(list: T[]) {
  const live = list.filter(i => i.status !== "Void" && i.status !== "Draft");
  const open = live.filter(i => balanceOf(i) > 0);
  const overdue = open.filter(i => i.status === "Overdue");
  return {
    billed: round2(live.reduce((s, i) => s + i.amount, 0)),
    /** Money received on live invoices (refunds already taken off). */
    collected: round2(live.reduce((s, i) => s + sumPayments(i), 0)),
    outstanding: round2(open.reduce((s, i) => s + balanceOf(i), 0)),
    overdue: round2(overdue.reduce((s, i) => s + balanceOf(i), 0)),
    openCount: open.length, overdueCount: overdue.length,
    open, overdueList: overdue,
  };
}

export interface StageAmount { amount: number; /** The stage's own share of the job total. */ base: number; /** What earlier stages missed or over-billed, carried onto this stage. */ adjustment: number; frozen: boolean }

/**
 * Amounts of a progress-billed job. An invoiced stage keeps the amount it was invoiced with (a sent invoice is never
 * edited). If the job total has changed since, the next stage that has not been invoiced yet takes the difference, and
 * the sum of all stages always equals the current job total. The last stage takes any rounding difference.
 */
export function stageAmounts(total: number, pcts: number[], invoiced: ({ amount: number; adjustment?: number } | undefined)[]): StageAmount[] {
  const out: StageAmount[] = [];
  let cumBase = 0, billed = 0;
  pcts.forEach((pct, i) => {
    const last = i === pcts.length - 1;
    const share = last ? total - cumBase : Math.round(total * pct / 100);
    cumBase += share;
    const f = invoiced[i];
    if (f) { out.push({ amount: f.amount, base: round2(f.amount - (f.adjustment ?? 0)), adjustment: f.adjustment ?? 0, frozen: true }); billed += f.amount; return; }
    const amount = round2(cumBase - billed);
    out.push({ amount, base: share, adjustment: round2(amount - share), frozen: false });
    billed += amount;
  });
  return out;
}

/** "$1,234.50" — cents shown, for amounts that can be partial. */
export const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
