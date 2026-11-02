"use client";
import { useState, type ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import { PAYMENT_METHODS, needsReference, lineTotal, checkLines, usd, type InvoiceLine } from "@/lib/ledger";
import {
  recordPayment, addInvoiceCredit, voidInvoice, reissueInvoice, reissueDraft, reissueReadiness, paymentSettings, fmtDate, type Invoice,
} from "@/lib/serviceData";

const field = "h-9 w-full px-3 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-[var(--serviceops-primary)]";
const area = "w-full px-3 py-2 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-[var(--serviceops-primary)]";
const todayInput = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function Shell({ title, onClose, onSubmit, submit, danger, children, wide }: { title: string; onClose: () => void; onSubmit: () => void; submit: string; danger?: boolean; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth={wide ? "md" : "xs"}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>{title}</DialogTitle>
      <DialogContent><div className="flex flex-col gap-3 pt-1">{children}</div></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 600 }}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} sx={{ textTransform: "none", fontWeight: 700, ...(danger ? { bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" } } : {}) }}>{submit}</Button>
      </DialogActions>
    </Dialog>
  );
}
const Label = ({ id, children }: { id: string; children: ReactNode }) => <label htmlFor={id} className="text-caption font-semibold text-[var(--text-muted)]">{children}</label>;
const Err = ({ text }: { text: string }) => (text ? <p role="alert" className="m-0 text-[12.5px] text-red-600">{text}</p> : null);
const Summary = ({ inv }: { inv: Invoice }) => (
  <p className="m-0 text-body text-[var(--text-body)]">{inv.number} · {inv.customer}<br />Total {usd(inv.amount)} · Received {usd(inv.paid)}{inv.credited > 0 && ` · Credited ${usd(inv.credited)}`} · <strong className="text-[var(--text-primary)]">Balance {usd(inv.balance)}</strong></p>
);

/** Record a payment against the balance. Amount defaults to the balance; reference is required unless it is cash. */
export function PaymentDialog({ inv, by, onClose, onDone }: { inv: Invoice; by: string; onClose: () => void; onDone: (msg: string) => void }) {
  const allowed = PAYMENT_METHODS.filter(m => paymentSettings().methods.includes(m));
  const [amount, setAmount] = useState(String(inv.balance));
  const [method, setMethod] = useState<string>(allowed[0] ?? "Cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(todayInput());
  const [error, setError] = useState("");
  const submit = () => {
    const at = Date.parse(`${date}T12:00:00`);
    if (Number.isNaN(at) || date > todayInput()) { setError("Choose the date the payment was received (not in the future)."); return; }
    const err = recordPayment(inv, { amount: Number(amount), method, reference, at }, by);
    if (err) { setError(err); return; }
    onDone(`${usd(Number(amount))} recorded on ${inv.number}`);
  };
  return (
    <Shell title="Record payment" onClose={onClose} onSubmit={submit} submit="Record payment">
      <Summary inv={inv} />
      <div><Label id="pay-amount">Amount</Label><input id="pay-amount" type="number" min={0} step="0.01" className={field} value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <div><Label id="pay-method">Method</Label>
        <select id="pay-method" className={field} value={method} onChange={e => setMethod(e.target.value)}>{allowed.map(m => <option key={m}>{m}</option>)}</select></div>
      <div><Label id="pay-ref">Reference{needsReference(method) ? " (required)" : " (optional)"}</Label>
        <input id="pay-ref" className={field} value={reference} onChange={e => setReference(e.target.value)} placeholder={method === "Cheque" ? "Cheque number" : method === "Bank transfer" ? "Transfer reference" : "Receipt or reference"} /></div>
      <div><Label id="pay-date">Date received</Label><input id="pay-date" type="date" max={todayInput()} className={field} value={date} onChange={e => setDate(e.target.value)} /></div>
      <Err text={error} />
    </Shell>
  );
}

/** A credit note against the remaining balance. */
export function CreditNoteDialog({ inv, by, onClose, onDone }: { inv: Invoice; by: string; onClose: () => void; onDone: (msg: string, creditNumber: string) => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const r = addInvoiceCredit(inv, { amount: Number(amount), reason }, by);
    if ("error" in r) { setError(r.error); return; }
    onDone(`${r.number} issued against ${inv.number}`, r.number);
  };
  return (
    <Shell title="Issue a credit note" onClose={onClose} onSubmit={submit} submit="Issue credit note">
      <Summary inv={inv} />
      <div><Label id="cn-amount">Amount (up to {usd(inv.balance)})</Label><input id="cn-amount" type="number" min={0} step="0.01" max={inv.balance} className={field} value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <div><Label id="cn-reason">Reason (required)</Label><textarea id="cn-reason" rows={3} className={area} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is the customer being credited?" /></div>
      <Err text={error} />
    </Shell>
  );
}

/** Void with a reason (managers only). A sent invoice is never edited: it is voided, then reissued if needed. */
export function VoidDialog({ inv, role, by, onClose, onDone }: { inv: Invoice; role: string; by: string; onClose: () => void; onDone: (msg: string, reissue: boolean) => void }) {
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<"credit" | "refund" | "">(inv.paid > 0 ? "credit" : "");
  const [reissue, setReissue] = useState(true);
  const [error, setError] = useState("");
  const submit = () => {
    const err = voidInvoice(inv, { reason, role, outcome: outcome || undefined }, by);
    if (err) { setError(err); return; }
    onDone(`${inv.number} voided`, reissue);
  };
  return (
    <Shell title={`Void ${inv.number}`} onClose={onClose} onSubmit={submit} submit="Void invoice" danger>
      <p className="m-0 text-body text-[var(--text-body)]">The invoice stays in the list as Void with who, when and why. The customer no longer owes it.</p>
      <div><Label id="void-reason">Reason (required)</Label><textarea id="void-reason" rows={3} className={area} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: wrong parts billed" /></div>
      {inv.paid > 0 && (
        <fieldset className="m-0 border-0 p-0 flex flex-col gap-1.5">
          <legend className="text-caption font-semibold text-[var(--text-muted)] mb-1">{usd(inv.paid)} was already received. What happens to it?</legend>
          <label className="flex items-start gap-2 text-body"><input type="radio" name="outcome" checked={outcome === "credit"} onChange={() => setOutcome("credit")} />Keep it as customer credit (it moves to the corrected invoice if you reissue)</label>
          <label className="flex items-start gap-2 text-body"><input type="radio" name="outcome" checked={outcome === "refund"} onChange={() => setOutcome("refund")} />Refund it (a refund entry is recorded on the ledger)</label>
        </fieldset>
      )}
      <label className="flex items-center gap-2 text-body"><input type="checkbox" checked={reissue} onChange={e => setReissue(e.target.checked)} />Reissue a corrected invoice next</label>
      <Err text={error} />
    </Shell>
  );
}

/** Corrected items for the replacement invoice (INV-xxxxx-R1). Same readiness checks as raising any invoice. */
export function ReissueDialog({ inv, role, by, onClose, onDone }: { inv: Invoice; role: string; by: string; onClose: () => void; onDone: (msg: string) => void }) {
  const start = reissueDraft(inv);
  const [lines, setLines] = useState<InvoiceLine[]>(start.lines);
  const [taxPct, setTaxPct] = useState(String(start.taxPct));
  const [discount, setDiscount] = useState(String(start.discount));
  const [error, setError] = useState("");
  const problems = reissueReadiness(inv);
  const set = (i: number, patch: Partial<InvoiceLine>) => setLines(ls => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const total = lineTotal(lines, Number(taxPct) || 0, Number(discount) || 0);
  const submit = () => {
    const r = reissueInvoice(inv, { lines, taxPct: Number(taxPct), discount: Number(discount) || 0 }, role, by);
    if ("error" in r) { setError(r.error); return; }
    onDone(`${r.invoice.number} issued to replace ${inv.number}`);
  };
  return (
    <Shell title={`Reissue ${inv.number}`} onClose={onClose} onSubmit={submit} submit="Issue corrected invoice" wide>
      {problems.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12.5px] text-amber-900">
          This invoice goes to the customer, so these must be fixed first:
          <ul className="m-0 mt-1 pl-5">{problems.map((p, i) => <li key={i}>{p.text}</li>)}</ul>
        </div>
      )}
      <p className="m-0 text-body text-[var(--text-body)]">The new invoice is numbered from the original and linked to it. {inv.heldCredit > 0 && `${usd(inv.heldCredit)} held as customer credit moves across.`}</p>
      <div className="flex flex-col gap-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_100px_32px] gap-2 items-center">
            <input aria-label={`Item ${i + 1}`} className={field} value={l.item} onChange={e => set(i, { item: e.target.value })} placeholder="Item" />
            <input aria-label={`Quantity ${i + 1}`} type="number" min={0} className={field} value={l.qty} onChange={e => set(i, { qty: Number(e.target.value) })} />
            <input aria-label={`Price ${i + 1}`} type="number" min={0} step="0.01" className={field} value={l.rate} onChange={e => set(i, { rate: Number(e.target.value) })} />
            <button type="button" aria-label={`Remove item ${i + 1}`} className="text-[var(--text-muted)] hover:text-red-600" onClick={() => setLines(ls => ls.filter((_, k) => k !== i))}>×</button>
          </div>
        ))}
        <div><Button size="small" onClick={() => setLines(ls => [...ls, { item: "", qty: 1, rate: 0 }])} sx={{ textTransform: "none" }}>Add item</Button></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label id="ri-tax">Tax %</Label><input id="ri-tax" type="number" min={0} max={100} className={field} value={taxPct} onChange={e => setTaxPct(e.target.value)} /></div>
        <div><Label id="ri-disc">Discount ($)</Label><input id="ri-disc" type="number" min={0} className={field} value={discount} onChange={e => setDiscount(e.target.value)} /></div>
      </div>
      <p className="m-0 text-label font-bold text-[var(--text-primary)]">New total {usd(total)}</p>
      <p className="m-0 text-caption text-[var(--text-muted)]">Void {fmtDate(inv.void?.at ?? Date.now())}: {inv.void?.reason}</p>
      <Err text={error} />
    </Shell>
  );
}
