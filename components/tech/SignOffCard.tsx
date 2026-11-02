"use client";
import { useState } from "react";
import { Signature } from "@phosphor-icons/react";
import { clearJobSignOff, setJobNoSignature, setJobSignature, type JobRecord, type JobWorkspace } from "@/lib/jobsData";
import { SIGN_OFF_KINDS, SIGN_OFF_LABEL, UNATTENDED_ALLOWED, type SignOffKind } from "@/lib/fieldPolicy";
import { effectiveSignOff, signOffProblem, signOffSummary } from "@/lib/techFlow";
import SignaturePad from "./SignaturePad";

const inputCls = "w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-body text-[var(--text-primary)]";
const btnCls = "h-11 px-4 rounded-xl text-label font-bold border border-[var(--border)] text-[var(--text-primary)] bg-[var(--bg-card)] disabled:opacity-50";

/** How the job is signed off: the customer, another person on site, a refusal, or nobody there. Each is recorded with its reason. */
export default function SignOffCard({ job, ws, locked, by, onChange, say }: { job: JobRecord; ws: JobWorkspace; locked: boolean; by: string; onChange: () => void; say: (m: string) => void }) {
  const [kind, setKind] = useState<SignOffKind>("customer");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const current = effectiveSignOff(ws);
  const ok = current && !signOffProblem(job, ws);
  const kinds = SIGN_OFF_KINDS.filter(k => k !== "unattended" || UNATTENDED_ALLOWED[job.serviceType]);
  const needsSig = kind === "customer" || kind === "other";

  const save = () => {
    if (needsSig) {
      if (!sig || name.trim().length < 2) return say(kind === "customer" ? "Enter the customer's name and sign" : "Enter the name of the person signing, and sign");
      if (kind === "other" && role.trim().length < 2) return say("Enter their role, for example site manager or tenant");
      setJobSignature(job.id, name, sig, kind === "other" ? { role } : undefined);
    } else {
      if (note.trim().length < 3) return say(kind === "refused" ? "Say why the customer refused" : "Say why nobody was on site");
      setJobNoSignature(job.id, kind, note, by);
    }
    setSig(null); setNote(""); onChange();
  };

  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4">
      <header className="flex items-center gap-2.5 mb-3"><Signature size={22} className="text-blue-600" /><h2 className="m-0 flex-1 text-[16px] font-bold text-[var(--text-primary)]">Customer sign-off</h2>{ok && <span className="text-caption font-bold text-green-700">Done</span>}</header>
      {current ? (
        <div className="flex flex-col gap-2">
          {ws.signature && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={ws.signature.dataUrl} alt="Signature" className="h-24 object-contain self-start rounded-lg border border-[var(--border-soft)] bg-white" />)}
          <p className="m-0 text-body text-[var(--text-primary)]" data-testid="signoff-summary">{signOffSummary(ws)}{ws.signature ? ` · ${ws.signature.at}` : ""}</p>
          {!ok && <p className="m-0 text-caption text-[#B45309]">{signOffProblem(job, ws)}</p>}
          {!locked && <button type="button" onClick={() => { clearJobSignOff(job.id); onChange(); }} className="text-label font-semibold text-blue-600 self-start">Change sign-off</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <select aria-label="Who is signing off" value={kind} onChange={e => setKind(e.target.value as SignOffKind)} className={inputCls}>
            {kinds.map(k => <option key={k} value={k}>{SIGN_OFF_LABEL[k]}</option>)}
          </select>
          {needsSig && <input aria-label={kind === "customer" ? "Customer name" : "Name of the person signing"} value={name} onChange={e => setName(e.target.value)} placeholder={kind === "customer" ? "Customer's full name" : "Full name of the person signing"} className={inputCls} />}
          {kind === "other" && <input aria-label="Their role" value={role} onChange={e => setRole(e.target.value)} placeholder="Their role (for example site manager, tenant)" className={inputCls} />}
          {needsSig && <SignaturePad onChange={setSig} />}
          {!needsSig && <textarea aria-label={kind === "refused" ? "Why the customer refused" : "Why nobody was on site"} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={kind === "refused" ? "Why did the customer refuse? (required)" : "Why was nobody on site? (required)"} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-body text-[var(--text-primary)]" />}
          {!needsSig && <p className="m-0 text-caption text-[var(--text-muted)]">This is recorded on the service report. Take photos of the finished work first.</p>}
          <button type="button" onClick={save} className={btnCls}>{needsSig ? "Save signature" : "Save sign-off"}</button>
        </div>
      )}
    </section>
  );
}
