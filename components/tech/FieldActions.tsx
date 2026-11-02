"use client";
import { useState, type ReactNode } from "react";
import { Prohibit, ShieldWarning, PlusCircle, X } from "@phosphor-icons/react";
import { addExtraWorkAsk, flagJobUnsafe, getWorkspace, recordJobOutcome, type JobRecord } from "@/lib/jobsData";
import { FAIL_REASONS, URGENCIES, type FailReason, type Urgency } from "@/lib/fieldPolicy";
import { failNoteProblem, NEXT_STEPS_TEXT } from "@/lib/techFlow";

const inputCls = "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-body text-[var(--text-primary)]";
const btnCls = "h-11 px-4 rounded-xl text-label font-bold border border-[var(--border)] text-[var(--text-primary)] bg-[var(--bg-card)] disabled:opacity-50";
const primary = "h-12 w-full rounded-xl text-label font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] disabled:opacity-50";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-label={title} className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--bg-card)] p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2"><p className="m-0 text-[17px] font-bold text-[var(--text-primary)]">{title}</p><button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)]"><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

type Which = "fail" | "unsafe" | "extra" | null;

/**
 * The three ways out when a visit does not go to plan: "I can't finish this visit", "Stop work, unsafe" and "Request extra work".
 * Each one tells the technician what happens next, so nobody is left stuck.
 */
export default function FieldActions({ job, name, onChange, canAsk = true }: { job: JobRecord; name: string; onChange: (message?: string) => void; canAsk?: boolean }) {
  const [open, setOpen] = useState<Which>(null);
  const [reason, setReason] = useState<FailReason | "">("");
  const [note, setNote] = useState("");
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("Normal");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ws = getWorkspace(job.id);
  const close = () => { setOpen(null); setErr(""); setNote(""); setReason(""); setDesc(""); setPhoto(""); setUrgency("Normal"); };

  const fail = () => {
    const p = failNoteProblem(reason, note);
    if (p) { setErr(p); return; }
    recordJobOutcome(job.id, reason as FailReason, note, name);
    close(); onChange(`Visit recorded as not finished. ${NEXT_STEPS_TEXT[reason as FailReason]}`);
  };

  const raiseUnsafe = async (text: string) => {
    const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "unsafe", jobId: job.id, note: text }) }).catch(() => null);
    return !!res?.ok;
  };
  const unsafe = async () => {
    if (note.trim().length < 3) { setErr("Say what is unsafe."); return; }
    setBusy(true);
    flagJobUnsafe(job.id, note, name);
    const sent = await raiseUnsafe(note.trim());
    if (sent) getWorkspace(job.id).safety!.notified = true;
    setBusy(false); close();
    onChange(sent ? "Work stopped. The office has been alerted and a manager must clear this before you can continue." : "Work stopped and saved on your phone, but the office could not be alerted yet. Call dispatch now.");
  };

  const extra = async () => {
    if (desc.trim().length < 5) { setErr("Describe the extra work."); return; }
    setBusy(true); setErr("");
    const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id, source: "Technician", description: desc.trim(), photoRef: photo, urgency }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) { setErr(data?.error ?? "Could not send this right now. Check your connection and try again."); return; }
    addExtraWorkAsk(job.id, { number: data.number, description: desc.trim(), photoRef: photo, urgency, by: name });
    close(); onChange(`Request ${data.number} sent to the office. They will review it; you do not need to do anything else.`);
  };

  return (
    <>
      <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex flex-col gap-2" aria-label="Problems on site">
        <h2 className="m-0 text-[16px] font-bold text-[var(--text-primary)]">Something wrong?</h2>
        <button type="button" onClick={() => setOpen("fail")} className={`${btnCls} flex items-center gap-2 justify-center`}><Prohibit size={18} />I can&apos;t finish this visit</button>
        <button type="button" onClick={() => setOpen("unsafe")} className={`${btnCls} flex items-center gap-2 justify-center !text-red-700 !border-red-300`}><ShieldWarning size={18} />Stop work, unsafe</button>
        {canAsk && <button type="button" onClick={() => setOpen("extra")} className={`${btnCls} flex items-center gap-2 justify-center`}><PlusCircle size={18} />Request extra work</button>}
      </section>

      {open === "fail" && (
        <Sheet title="I can't finish this visit" onClose={close}>
          <p className="m-0 text-body text-[var(--text-body)]">This stops your work timer and location sharing, and tells the office so they can rebook or contact the customer.</p>
          <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-1.5">
            {FAIL_REASONS.map(r => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => { setReason(r); setErr(""); }}
                className={`text-left h-11 px-3 rounded-xl border text-body ${reason === r ? "border-[var(--serviceops-primary)] bg-[var(--serviceops-tint)] font-bold" : "border-[var(--border)]"} text-[var(--text-primary)]`}>{r}</button>))}
          </div>
          <textarea aria-label="What happened" rows={3} value={note} onChange={e => { setNote(e.target.value); setErr(""); }} placeholder={reason === "Other" ? "What happened? (required)" : "What happened? (optional)"} className={inputCls} />
          {reason && <p className="m-0 text-caption text-[var(--text-muted)]">What happens next: {NEXT_STEPS_TEXT[reason]}</p>}
          {err && <p role="alert" className="m-0 text-caption text-red-600">{err}</p>}
          <button type="button" onClick={fail} disabled={!reason} className={primary}>Mark visit as not finished</button>
        </Sheet>
      )}

      {open === "unsafe" && (
        <Sheet title="Stop work, unsafe" onClose={close}>
          <p className="m-0 text-body text-[var(--text-body)]">Stop and make yourself safe. This stops your timer, flags the job and alerts the office. You cannot complete the job until a manager clears it.</p>
          <textarea aria-label="What is unsafe" rows={3} value={note} onChange={e => { setNote(e.target.value); setErr(""); }} placeholder="What is unsafe?" className={inputCls} />
          {err && <p role="alert" className="m-0 text-caption text-red-600">{err}</p>}
          <button type="button" onClick={unsafe} disabled={busy} className="h-12 w-full rounded-xl text-label font-bold text-white bg-red-600 disabled:opacity-50">Stop work and alert the office</button>
        </Sheet>
      )}

      {open === "extra" && (
        <Sheet title="Request extra work" onClose={close}>
          <p className="m-0 text-body text-[var(--text-body)]">The office reviews this and creates the work order. You do not need to quote or invoice it.</p>
          <textarea aria-label="Extra work needed" rows={3} value={desc} onChange={e => { setDesc(e.target.value); setErr(""); }} placeholder="What else needs doing?" className={inputCls} />
          <select aria-label="Photo" value={photo} onChange={e => setPhoto(e.target.value)} className={inputCls}>
            <option value="">No photo</option>
            {ws.photos.filter(p => p.src).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <div role="radiogroup" aria-label="Urgency" className="grid grid-cols-3 gap-2">
            {URGENCIES.map(u => <button key={u} type="button" role="radio" aria-checked={urgency === u} onClick={() => setUrgency(u)} className={`h-11 rounded-xl border text-label ${urgency === u ? "border-[var(--serviceops-primary)] bg-[var(--serviceops-tint)] font-bold" : "border-[var(--border)]"} text-[var(--text-primary)]`}>{u}</button>)}
          </div>
          {err && <p role="alert" className="m-0 text-caption text-red-600">{err}</p>}
          <button type="button" onClick={extra} disabled={busy} className={primary}>Send to the office</button>
        </Sheet>
      )}
    </>
  );
}
