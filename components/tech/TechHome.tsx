"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MapPin, Phone, CaretRight, CheckCircle, Clock, WarningCircle, ArrowRight, SquaresFour } from "@phosphor-icons/react";
import { STATUS_META, getWorkspace, type JobRecord } from "@/lib/jobsData";
import { customerByName, fmtDate, fmtDay, JOBS_TODAY_TS } from "@/lib/serviceData";
import { advanceJob, completionProblems, STEP_LABEL, techJobs, techStep } from "@/lib/techFlow";
import TechShell from "./TechShell";

const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const addressOf = (job: JobRecord) => { const c = customerByName(job.customer); return c ? `${c.street}, ${c.cityLine}` : job.location; };

function StatusDot({ job }: { job: JobRecord }) {
  const m = STATUS_META[job.status];
  return <span className="inline-flex items-center gap-1.5 text-caption font-semibold" style={{ color: m.light }}><span className="w-2 h-2 rounded-full" style={{ background: m.light }} />{job.status}</span>;
}

function Row({ job }: { job: JobRecord }) {
  return (
    <Link href={`/tech/${job.id}`} className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] active:bg-[var(--serviceops-tint)]">
      <div className="w-14 flex-shrink-0 text-center"><p className="m-0 text-label font-bold text-[var(--text-primary)]">{job.scheduledTime}</p><p className="m-0 text-caption text-[var(--text-muted)]">{fmtDay(job.scheduledAt)}</p></div>
      <div className="flex-1 min-w-0"><p className="m-0 text-label font-semibold text-[var(--text-primary)] truncate">{job.customer}</p><p className="m-0 text-caption text-[var(--text-muted)] truncate">{job.jobName}</p></div>
      <StatusDot job={job} /><CaretRight size={16} className="text-[var(--text-muted)] flex-shrink-0" />
    </Link>
  );
}

/** The technician's home: today's visits with one clear next action. */
export default function TechHome() {
  const { data: session } = useSession();
  const [, setTick] = useState(0);
  const [msg, setMsg] = useState("");
  const name = session?.user?.name ?? "";
  const { focus, todo, done, later, todayCount } = techJobs(name);

  const act = (job: JobRecord) => { const m = advanceJob(job); setTick(t => t + 1); if (m) { setMsg(m); setTimeout(() => setMsg(""), 3500); } };

  return (
    <TechShell title="Today" subtitle={`${fmtDate(JOBS_TODAY_TS)} · ${done.length} of ${todayCount} done`}>
      {msg && <div role="status" className="rounded-xl px-4 py-3 text-body font-semibold bg-[#111] text-white">{msg}</div>}

      {focus ? (() => {
        const ws = getWorkspace(focus.id); const step = techStep(focus, ws); const cust = customerByName(focus.customer);
        const blocked = step === "complete" ? completionProblems(focus, ws) : [];
        return (
          <section aria-label="Next job" className="rounded-2xl border-2 border-[var(--serviceops-primary)] bg-[var(--bg-card)] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between"><span className="text-caption font-bold uppercase tracking-wide text-[#C2410C]">{step === "go" ? "Up next" : "In progress"}</span><StatusDot job={focus} /></div>
            <div>
              <p className="m-0 text-[22px] leading-7 font-bold text-[var(--text-primary)]">{focus.customer}</p>
              <p className="m-0 text-body text-[var(--text-body)]">{focus.jobName}</p>
              <p className="m-0 mt-1 flex items-center gap-1.5 text-body text-[var(--text-muted)]"><Clock size={16} />{focus.scheduledTime} · {focus.jobId}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href={mapsUrl(addressOf(focus))} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 h-12 rounded-xl border border-[var(--border)] text-label font-semibold text-[var(--text-primary)]"><MapPin size={18} />Directions</a>
              {cust?.phone ? <a href={`tel:${cust.phone}`} className="flex items-center justify-center gap-2 h-12 rounded-xl border border-[var(--border)] text-label font-semibold text-[var(--text-primary)]"><Phone size={18} />Call</a> : <span />}
            </div>
            <p className="m-0 text-caption text-[var(--text-muted)]">{addressOf(focus)}</p>
            <button type="button" onClick={() => (step === "complete" ? undefined : act(focus))} disabled={step === "complete"}
              className="h-14 rounded-xl text-[17px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] disabled:opacity-100">
              {step === "complete" ? <Link href={`/tech/${focus.id}`} className="flex items-center justify-center gap-2 h-full text-[#3B1F00]">Finish and sign off <ArrowRight size={18} weight="bold" /></Link> : STEP_LABEL[step]}
            </button>
            {blocked.length > 0 && <p className="m-0 flex items-center gap-1.5 text-caption text-[#B45309]"><WarningCircle size={14} />Before completing: {blocked.join(", ").toLowerCase()}.</p>}
            <Link href={`/tech/${focus.id}`} className="text-center text-label font-semibold text-blue-600">Open job details</Link>
          </section>
        );
      })() : (
        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 text-center">
          <CheckCircle size={36} weight="fill" className="mx-auto text-green-600" />
          <p className="m-0 mt-2 text-h2 font-bold text-[var(--text-primary)]">{todayCount ? "All done for today" : "Nothing scheduled today"}</p>
          <p className="m-0 text-body text-[var(--text-muted)]">{later.length ? "Your next visits are listed below." : "New jobs appear here when dispatch assigns them."}</p>
        </section>
      )}

      {todo.length > 0 && <section className="flex flex-col gap-2"><h2 className="m-0 text-label font-bold text-[var(--text-muted)] uppercase tracking-wide">Later today</h2>{todo.map(j => <Row key={j.id} job={j} />)}</section>}
      {later.length > 0 && <section className="flex flex-col gap-2"><h2 className="m-0 text-label font-bold text-[var(--text-muted)] uppercase tracking-wide">Coming up</h2>{later.map(j => <Row key={j.id} job={j} />)}</section>}
      {done.length > 0 && <section className="flex flex-col gap-2"><h2 className="m-0 text-label font-bold text-[var(--text-muted)] uppercase tracking-wide">Completed today</h2>{done.map(j => <Row key={j.id} job={j} />)}</section>}

      <Link href="/jobs" className="flex items-center justify-center gap-2 h-11 text-label font-semibold text-[var(--text-muted)]"><SquaresFour size={16} />Open the full app</Link>
    </TechShell>
  );
}
