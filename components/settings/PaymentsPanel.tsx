"use client";
import { useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import Switch from "@mui/material/Switch";
import { PAYMENT_METHODS, canManageMoney, type PaymentMethod } from "@/lib/ledger";
import { paymentSettings, savePaymentSettings, type PaymentSettings } from "@/lib/serviceData";
import { BILLING_PLANS } from "@/lib/jobsData";

type Notify = (msg: string, href?: string, severity?: "success" | "info") => void;
const inputCls = "h-9 px-3 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-[var(--serviceops-primary)] disabled:opacity-60";
const primary = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] hover:bg-[var(--serviceops-hover)] disabled:opacity-50";
const switchSx = { "& .MuiSwitch-switchBase.Mui-checked": { color: "#F59E0B" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#F59E0B" } };

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[240px_minmax(0,1fr)] gap-2 sm:gap-6 py-4 border-b border-[var(--border-soft)] last:border-b-0 items-center">
      <div><p className="m-0 text-label text-[var(--text-primary)]">{label}</p><p className="m-0 text-caption text-[var(--text-muted)]">{hint}</p></div>
      <div className="min-w-0 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Company-wide payment settings: terms, optional deposit, optional staged billing, allowed methods. Managers only. */
export default function PaymentsPanel({ notify }: { notify: Notify }) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canEdit = canManageMoney(role);
  const [f, setF] = useState<PaymentSettings>(() => paymentSettings());
  const set = (patch: Partial<PaymentSettings>) => setF(v => ({ ...v, ...patch }));
  const toggleMethod = (m: PaymentMethod) => set({ methods: f.methods.includes(m) ? f.methods.filter(x => x !== m) : [...f.methods, m] });
  const save = () => {
    const err = savePaymentSettings(role, f);
    if (err) notify(err, undefined, "info"); else notify("Payment settings saved");
  };

  return (
    <div>
      {!canEdit && <p role="status" className="m-0 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">Only a Service manager or Administrator can change these settings. You can see what is set.</p>}
      <Row label="Payment terms" hint="Used for a customer that has no terms of its own.">
        <select aria-label="Default payment terms" className={inputCls} disabled={!canEdit} value={f.terms} onChange={e => set({ terms: e.target.value as PaymentSettings["terms"] })}>
          {["Net 15", "Net 30", "Net 45"].map(t => <option key={t}>{t}</option>)}
        </select>
      </Row>
      <Row label="Deposit on approval" hint="Off by default: customers pay after the work. When on, estimates ask for this share when approved, and it is deducted on the final invoice.">
        <Switch checked={f.depositOn} disabled={!canEdit} onChange={e => set({ depositOn: e.target.checked })} sx={switchSx} inputProps={{ "aria-label": "Ask for a deposit on approval" }} />
        <span className="text-body text-[var(--text-muted)]">{f.depositOn ? "Default deposit" : "No deposit"}</span>
        {f.depositOn && <><input aria-label="Default deposit percent" type="number" min={0} max={100} className={`${inputCls} w-[84px]`} disabled={!canEdit} value={f.depositPct} onChange={e => set({ depositPct: Number(e.target.value) })} /><span className="text-body text-[var(--text-muted)]">% (an estimate can still set its own)</span></>}
      </Row>
      <Row label="Staged billing" hint="Off by default: one invoice per job. When on, the template below is pre-selected when you set up progress billing on a job.">
        <Switch checked={f.stagedOn} disabled={!canEdit} onChange={e => set({ stagedOn: e.target.checked })} sx={switchSx} inputProps={{ "aria-label": "Use a staged billing template by default" }} />
        <span className="text-body text-[var(--text-muted)]">{f.stagedOn ? "Default template" : "One invoice per job"}</span>
        {f.stagedOn && <select aria-label="Default staged billing template" className={inputCls} disabled={!canEdit} value={f.stagedPlan} onChange={e => set({ stagedPlan: e.target.value })}>
          {Object.keys(BILLING_PLANS).map(k => <option key={k}>{k}</option>)}
        </select>}
      </Row>
      <Row label="Allowed payment methods" hint="What staff can choose when recording a payment.">
        {PAYMENT_METHODS.map(m => (
          <label key={m} className="inline-flex items-center gap-1.5 text-body text-[var(--text-primary)]">
            <input type="checkbox" disabled={!canEdit} checked={f.methods.includes(m)} onChange={() => toggleMethod(m)} />{m}
          </label>
        ))}
      </Row>
      <div className="pt-4"><button type="button" className={primary} disabled={!canEdit} onClick={save}>Save payment settings</button></div>
    </div>
  );
}
