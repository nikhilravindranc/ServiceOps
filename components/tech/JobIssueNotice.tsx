"use client";
import Link from "next/link";
import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { dismissJobIssue, issueText, readStash, type JobIssue } from "@/lib/jobSync";

/** Tells the technician that the office took a job away (reassigned, cancelled or removed), and what happened to anything they had not saved. */
export default function JobIssueNotice({ issue, fallback }: { issue?: JobIssue; fallback?: string }) {
  const [copied, setCopied] = useState(false);
  const stash = issue?.unsaved ? readStash(issue.jobId) : null;
  const copy = async () => {
    const text = [`${issue!.jobRef}: my notes`, ...(stash?.notes ?? []).map(n => `- ${n.text}`)].join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* clipboard blocked: the notes stay on screen */ }
  };
  return (
    <section role="alert" className="rounded-2xl border border-[#F59E0B] bg-[rgba(245,158,11,0.10)] p-4 flex flex-col gap-2" data-testid="job-issue">
      <p className="m-0 flex items-center gap-2 text-[16px] font-bold text-[var(--text-primary)]"><WarningCircle size={20} weight="fill" color="#D97706" />{issue ? issueText(issue) : (fallback ?? "This job is no longer yours.")}</p>
      <p className="m-0 text-body text-[var(--text-body)]">{issue?.kind === "cancelled" ? "Stop work on it. If you are already on site, call dispatch." : "Stop work on it and check your list for what is next. Call dispatch if you are unsure."}</p>
      {issue?.unsaved && (
        <div className="rounded-xl bg-[var(--bg-card)] p-3">
          <p className="m-0 text-body text-[var(--text-primary)]"><b>Your unsaved work was kept on this phone.</b> It was not sent to the office, because the job is no longer yours.</p>
          {stash && stash.notes.length > 0 && <ul className="m-0 mt-2 pl-5 text-body text-[var(--text-body)]">{stash.notes.map(n => <li key={n.id}>{n.text}</li>)}</ul>}
          {stash && <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">{stash.photos.filter(p => p.src).length} photo(s), {stash.checks?.filter(Boolean).length ?? 0} checklist step(s) ticked. Tell dispatch what you did.</p>}
          {stash && stash.notes.length > 0 && <button type="button" onClick={copy} className="mt-2 h-10 px-3 rounded-lg border border-[var(--border)] text-label font-semibold text-[var(--text-primary)]">{copied ? "Notes copied" : "Copy my notes"}</button>}
        </div>
      )}
      <div className="flex gap-2">
        <Link href="/tech" className="flex-1 h-11 rounded-xl flex items-center justify-center text-label font-bold text-[#3B1F00] bg-[var(--serviceops-primary)]">Back to my jobs</Link>
        {issue && <button type="button" onClick={() => dismissJobIssue(issue.jobId)} className="h-11 px-4 rounded-xl border border-[var(--border)] text-label font-semibold text-[var(--text-primary)]">Dismiss</button>}
      </div>
    </section>
  );
}
