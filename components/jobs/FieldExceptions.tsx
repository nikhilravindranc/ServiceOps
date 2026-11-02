"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Warning } from "@phosphor-icons/react";
import { DetailCard } from "@/components/ui/ServiceOpsUI";
import { clearJobUnsafe, getWorkspace, ALL_JOBS, type JobRecord } from "@/lib/jobsData";
import { effectiveSignOff, signOffSummary } from "@/lib/techFlow";
import { FollowUpForm } from "@/components/dispatch/FollowUpList";

const box = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-body text-[var(--text-primary)]";

/**
 * What happened in the field that the office should act on: a stop-work flag, a visit that could not be finished,
 * how the job was signed off, and extra work the technician asked for. Shows nothing when there is nothing to say.
 */
export default function FieldExceptions({ job, onChange }: { job: JobRecord; onChange: (msg?: string, href?: string) => void }) {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const ws = getWorkspace(job.id);
  const [clearNote, setClearNote] = useState("");
  const so = effectiveSignOff(ws);
  const flagged = ws.safety && !ws.safety.clearedAt;
  const unusual = so && so.kind !== "customer";
  const original = ws.followUpOf ? ALL_JOBS.find(j => j.id === ws.followUpOf!.jobId) : undefined;
  if (!ws.safety && !ws.outcome && !unusual && !ws.extraWork?.length && !ws.followUpOf) return null;

  return (
    <DetailCard icon={Warning} title="Field visit">
      <div className="flex flex-col gap-4 text-body text-[var(--text-body)]" data-testid="field-exceptions">
        {ws.safety && (
          <div className={`rounded-xl p-3 ${flagged ? "bg-[rgba(239,68,68,0.10)]" : "bg-[var(--serviceops-tint)]"}`}>
            <p className="m-0 font-bold text-[var(--text-primary)]">{flagged ? "Stop work: unsafe condition" : "Safety flag cleared"}</p>
            <p className="m-0 mt-1">{ws.safety.by} on {ws.safety.at}: {ws.safety.note}</p>
            {ws.safety.clearedAt && <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">Cleared by {ws.safety.clearedBy} on {ws.safety.clearedAt}{ws.safety.clearNote ? `: ${ws.safety.clearNote}` : ""}</p>}
            {flagged && (["Administrator", "Service manager"].includes(role)
              ? (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="m-0 text-caption text-[var(--text-muted)]">The technician cannot complete the job until you clear this.</p>
                  <input aria-label="Safety clearance note" value={clearNote} onChange={e => setClearNote(e.target.value)} placeholder="What was done to make it safe?" className={box} />
                  <button type="button" disabled={clearNote.trim().length < 3} onClick={() => { clearJobUnsafe(job.id, clearNote, session?.user?.name ?? "Manager"); setClearNote(""); onChange("Safety flag cleared"); }}
                    className="h-9 rounded-lg text-button-sm font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] disabled:opacity-50 self-start px-4">Clear safety flag</button>
                </div>)
              : <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">Only a manager can clear this flag.</p>)}
          </div>
        )}

        {ws.outcome && (
          <div>
            <p className="m-0 font-bold text-[var(--text-primary)]">Visit not finished: {ws.outcome.reason}</p>
            <p className="m-0 mt-1">{ws.outcome.by} on {ws.outcome.at}{ws.outcome.note ? `: ${ws.outcome.note}` : ""}</p>
            {ws.outcome.followUp ? (
              <p className="m-0 mt-2">
                Decision: <b>{ws.outcome.followUp.action}</b> by {ws.outcome.followUp.by} on {ws.outcome.followUp.at}{ws.outcome.followUp.note ? `. ${ws.outcome.followUp.note}` : ""}
                {ws.outcome.followUp.fee ? ` Call-out fee: $${ws.outcome.followUp.fee}.` : ""}
                {ws.outcome.followUp.newJobId ? <> Return visit: <Link href={`/jobs/${ws.outcome.followUp.newJobId}`} className="text-blue-600 hover:underline">{ws.outcome.followUp.newJobRef}</Link>.</> : null}
              </p>
            ) : job.status === "Incomplete" && role !== "Technician" ? (
              <div className="mt-3 max-w-md"><FollowUpForm job={job} onDone={(m, href) => onChange(m, href)} /></div>
            ) : <p className="m-0 mt-2 text-caption text-[var(--text-muted)]">Waiting for the office to decide the next step.</p>}
          </div>
        )}

        {ws.followUpOf && <p className="m-0">Return visit for <Link href={`/jobs/${ws.followUpOf.jobId}`} className="text-blue-600 hover:underline">{original?.jobId ?? ws.followUpOf.jobRef}</Link>, which could not be finished.</p>}

        {unusual && <p className="m-0"><b className="text-[var(--text-primary)]">Sign-off:</b> {signOffSummary(ws)}{so?.kind === "refused" || so?.kind === "unattended" ? " (no signature)" : ""}</p>}

        {ws.extraWork?.map(x => (
          <p key={x.number} className="m-0"><b className="text-[var(--text-primary)]">Extra work requested</b> ({x.urgency}) by {x.by}: {x.description} <Link href={`/requests/${x.number}`} className="text-blue-600 hover:underline">{x.number}</Link></p>
        ))}
      </div>
    </DetailCard>
  );
}
