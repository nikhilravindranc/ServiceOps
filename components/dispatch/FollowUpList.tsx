"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { WarningCircle } from "@phosphor-icons/react";
import { getWorkspace, type JobRecord } from "@/lib/jobsData";
import { FOLLOW_UP_ACTIONS, CALL_OUT_FEE, followUpRebooks, followUpCharges, type FollowUpAction } from "@/lib/fieldPolicy";
import { defaultRebookTime, needsFollowUp, resolveFollowUp, suggestedFollowUp } from "@/lib/followUp";
import { money } from "@/lib/serviceData";

const field = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-body text-[var(--text-primary)]";

/** The choice the office makes for one unfinished visit: rebook free, rebook with a call-out fee, charge the fee only, or cancel. */
export function FollowUpForm({ job, onDone }: { job: JobRecord; onDone: (msg: string, href?: string) => void }) {
  const { data: session } = useSession();
  const [action, setAction] = useState<FollowUpAction>(suggestedFollowUp(job));
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(defaultRebookTime());
  const [err, setErr] = useState("");
  const apply = () => {
    if (followUpRebooks(action) && !when) { setErr("Pick a date and time for the return visit."); return; }
    if (action === "Cancel" && note.trim().length < 3) { setErr("Add a note saying why the job is cancelled."); return; }
    const created = resolveFollowUp(job, action, note, when, session?.user?.name ?? "Office");
    onDone(created ? `${created.jobId} booked as a return visit for ${job.jobId}` : `${job.jobId}: ${action}`, created ? `/jobs/${created.id}` : undefined);
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="text-caption font-semibold text-[var(--text-muted)]">Next step
        <select aria-label="Next step" value={action} onChange={e => { setAction(e.target.value as FollowUpAction); setErr(""); }} className={`${field} mt-1`}>
          {FOLLOW_UP_ACTIONS.map(a => <option key={a} value={a}>{a}{followUpCharges(a) ? ` (${money(CALL_OUT_FEE)})` : ""}</option>)}
        </select>
      </label>
      {followUpRebooks(action) && (
        <label className="text-caption font-semibold text-[var(--text-muted)]">Return visit
          <input aria-label="Return visit" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={`${field} mt-1`} />
        </label>
      )}
      <label className="text-caption font-semibold text-[var(--text-muted)]">Note{action === "Cancel" ? " (required)" : ""}
        <textarea aria-label="Follow-up note" value={note} onChange={e => { setNote(e.target.value); setErr(""); }} rows={2} className={`${field} mt-1`} placeholder="Anything the next visit needs to know" />
      </label>
      {err && <p role="alert" className="m-0 text-caption text-red-600">{err}</p>}
      <button type="button" onClick={apply} className="h-9 rounded-lg text-button-sm font-bold text-[#3B1F00] bg-[var(--serviceops-primary)]">Confirm</button>
    </div>
  );
}

/** Dispatch: visits the technician could not finish, waiting for the office to decide. */
export default function FollowUpList({ onChanged, notify }: { onChanged: () => void; notify: (msg: string, href?: string) => void }) {
  const jobs = needsFollowUp();
  const [open, setOpen] = useState<number | null>(null);
  if (jobs.length === 0) return <div className="py-10 text-center text-body text-[var(--text-muted)]">No visits are waiting for a decision.</div>;
  return (
    <>
      {jobs.map(j => {
        const o = getWorkspace(j.id).outcome!;
        return (
          <div key={j.id} className="rounded-xl border border-[var(--border)] px-3 py-2.5 flex flex-col gap-1.5" data-testid="follow-up-card">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/jobs/${j.id}`} className="text-caption font-semibold text-blue-600 hover:underline">{j.jobId}</Link>
              <span className="text-caption text-[var(--text-muted)]">{j.technician}</span>
            </div>
            <p className="m-0 text-label text-[var(--text-primary)]">{j.jobName} · {j.customer}</p>
            <p className="m-0 inline-flex items-start gap-1.5 text-caption font-medium text-[#D97706]"><WarningCircle size={14} weight="fill" className="mt-0.5 flex-shrink-0" />{o.reason}{o.note ? `: ${o.note}` : ""}</p>
            {open === j.id
              ? <FollowUpForm job={j} onDone={(m, href) => { setOpen(null); onChanged(); notify(m, href); }} />
              : <button type="button" onClick={() => setOpen(j.id)} className="h-8 rounded-lg border border-[var(--border)] text-button-sm font-semibold text-[var(--text-primary)]">Decide next step</button>}
          </div>
        );
      })}
    </>
  );
}
