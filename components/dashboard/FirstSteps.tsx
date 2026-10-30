"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Circle, X } from "@phosphor-icons/react";

type Progress = { company: boolean; request: boolean; catalog: boolean; team: boolean };
const KEY = "first-steps-dismissed";

const STEPS: { key: keyof Progress | "schedule"; title: string; hint: string; href: string; cta: string }[] = [
  { key: "company", title: "Set up your company", hint: "Name, hours, service types and zones", href: "/onboarding", cta: "Open setup" },
  { key: "catalog", title: "Add your services and parts", hint: "Prices used on estimates and invoices", href: "/catalog?new=1", cta: "Add item" },
  { key: "request", title: "Log your first request", hint: "A call or email from a customer", href: "/requests?new=1", cta: "New request" },
  { key: "schedule", title: "Schedule it in Dispatch", hint: "Assign a technician and a time", href: "/dispatch", cta: "Open Dispatch" },
  { key: "team", title: "Invite a teammate", hint: "Dispatchers and technicians get their own sign-in", href: "/users", cta: "Open Users" },
];

/** Setup checklist on Home. Hidden once dismissed, or when every trackable step is done. */
export default function FirstSteps() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try { setHidden(localStorage.getItem(KEY) === "1"); } catch { setHidden(false); }
    fetch("/api/first-steps").then(r => (r.ok ? r.json() : null)).then(setProgress).catch(() => {});
  }, []);

  if (hidden || !progress) return null;
  const done = (k: string) => k !== "schedule" && progress[k as keyof Progress];
  const complete = STEPS.filter(s => done(s.key)).length;
  if (complete === STEPS.filter(s => s.key !== "schedule").length) return null;

  return (
    <section aria-label="First steps" className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-[var(--text-primary)]">First steps</h2>
          <p className="m-0 text-caption text-[var(--text-muted)]">{complete} of {STEPS.length} done</p>
        </div>
        <button type="button" aria-label="Hide first steps" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setHidden(true); }}
          className="p-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--serviceops-tint)]"><X size={16} /></button>
      </div>
      <ul className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {STEPS.map(s => {
          const ok = done(s.key);
          return (
            <li key={s.key} className="rounded-xl border border-[var(--border-soft)] p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {ok ? <CheckCircle size={18} weight="fill" color="#10B981" /> : <Circle size={18} className="text-[var(--text-muted)]" />}
                <span className={`text-label ${ok ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>{s.title}</span>
              </div>
              <p className="m-0 text-caption text-[var(--text-muted)]">{s.hint}</p>
              {!ok && <Link href={s.href} className="text-[13px] font-semibold text-blue-600 mt-auto">{s.cta}</Link>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
