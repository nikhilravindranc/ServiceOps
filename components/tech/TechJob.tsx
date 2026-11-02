"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MapPin, Phone, Camera, Trash, Plus, Minus, CheckCircle, Circle, ListChecks, Package, NotePencil, CreditCard, FileText, BookOpen, Timer, WarningCircle, Receipt, Printer } from "@phosphor-icons/react";
import {
  getWorkspace, setJobCheck, addJobPhotos, removeJobPhoto, addJobNote, addJobPart, removeJobPart, recordJobPayment,
  generateInvoice, JOB_EXTRAS, STATUS_META, ALL_JOBS,
} from "@/lib/jobsData";
import { PARTS, SERVICE_PRICING, customerByName, invoiceReadiness, jobCharges, money, vanStock, workOrderForJob } from "@/lib/serviceData";
import { checklistFor, SOPS } from "@/lib/checklists";
import { advanceJob, completionProblems, isStopped, NEXT_STEPS_TEXT, openPartRequest, requestPartForJob, STEP_LABEL, techStep, vanCheck } from "@/lib/techFlow";
import { useJobIssues } from "@/lib/jobSync";
import { resizePhoto } from "@/lib/photoResize";
import TechShell from "./TechShell";
import SignOffCard from "./SignOffCard";
import FieldActions from "./FieldActions";
import JobIssueNotice from "./JobIssueNotice";
import LocationShareToggle from "./LocationShareToggle";
import ServiceReportSheet from "./ServiceReportSheet";

const OFFICE_ROLES = ["Administrator", "Service manager", "Dispatcher", "Service coordinator"];
const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

function Card({ icon: Icon, title, badge, children }: { icon: typeof Camera; title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4">
      <header className="flex items-center gap-2.5 mb-3"><Icon size={22} className="text-blue-600" /><h2 className="m-0 flex-1 text-[16px] font-bold text-[var(--text-primary)]">{title}</h2>{badge}</header>
      {children}
    </section>
  );
}
const inputCls = "w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-body text-[var(--text-primary)]";
const btnCls = "h-11 px-4 rounded-xl text-label font-bold border border-[var(--border)] text-[var(--text-primary)] bg-[var(--bg-card)] disabled:opacity-50";

const clock = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const partRate = (type: keyof typeof SERVICE_PRICING, name: string, unitCost: number) => SERVICE_PRICING[type].parts.find(p => p.item === name)?.rate ?? Math.round(unitCost * 1.6);

/** One job, step by step: the next action, checklist, photos, parts, notes, customer sign-off, payment and the service report. */
export default function TechJob({ id }: { id: number }) {
  const { data: session } = useSession();
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const job = ALL_JOBS.find(j => j.id === id);
  const photoInput = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());
  const [openSop, setOpenSop] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [payMethod, setPayMethod] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [problems, setProblems] = useState<string[] | null>(null);
  const issue = useJobIssues().find(i => i.jobId === id); // the office took this job away (see lib/jobSync.ts)

  const ws = job ? getWorkspace(job.id) : null;
  useEffect(() => { if (!ws?.workStartedAt || ws.workEndedAt) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [ws?.workStartedAt, ws?.workEndedAt]);

  if (!job || !ws) return <TechShell title={issue ? "Job removed" : "Job not found"} back="/tech">{issue ? <JobIssueNotice issue={issue} /> : <p className="text-body text-[var(--text-muted)]">This job does not exist.</p>}</TechShell>;
  const role = session?.user?.role ?? "";
  if (session && job.technician !== session.user?.name && !OFFICE_ROLES.includes(role)) {
    return <TechShell title="Job reassigned" back="/tech"><JobIssueNotice issue={issue} fallback={`${job.jobId} is assigned to ${job.technician}, not you.`} /></TechShell>;
  }

  const cust = customerByName(job.customer);
  const wo = workOrderForJob(job.id);
  const address = cust ? `${cust.street}, ${cust.cityLine}` : job.location;
  const step = techStep(job, ws);
  const items = checklistFor(job.serviceType);
  const checks = ws.checks ?? [];
  const doneCount = items.filter((_, i) => checks[i]).length;
  const mandatoryLeft = items.filter((c, i) => c.mandatory && !checks[i]).length;
  const blockers = completionProblems(job, ws);
  const charges = jobCharges(job);
  const description = JOB_EXTRAS[job.id]?.description || wo?.description || job.jobName;
  const completed = step === "done";
  const meta = STATUS_META[job.status];
  const elapsed = ws.workStartedAt ? (ws.workEndedAt ?? now) - ws.workStartedAt : 0;
  const stock = PARTS.map(p => ({ p, van: vanStock(p, job.technician) })).sort((a, b) => Number(b.p.category === job.serviceType) - Number(a.p.category === job.serviceType));

  const stopped = isStopped(ws);
  const closed = step === "incomplete" || step === "cancelled"; // no more work on this visit
  const chosen = PARTS.find(p => p.name === partName);
  const chosenVan = chosen ? vanStock(chosen, job.technician) : 0;
  const van = vanCheck(chosenVan, partQty);
  const asked = chosen ? openPartRequest(job.id, chosen.partNo) : undefined;
  const requestPart = () => { if (!chosen) return; const r = requestPartForJob(job, chosen, Math.max(1, van.short || partQty)); refresh(); say(`${r.id}: the warehouse has been asked for ${chosen.name}`); };
  const retryAlert = async () => {
    const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "unsafe", jobId: job.id, note: ws.safety?.note ?? "" }) }).catch(() => null);
    if (res?.ok && ws.safety) { ws.safety.notified = true; refresh(); say("The office has been alerted"); } else say("Still no connection. Call dispatch.");
  };

  const act = () => {
    if (stopped) { say("Work is stopped until a manager clears the safety flag"); return; }
    if (step === "complete" && blockers.length) { setProblems(blockers); return; }
    const m = advanceJob(job); refresh(); if (m) say(m);
  };
  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const out: { name: string; src: string }[] = [];
    for (const f of Array.from(files)) { try { out.push({ name: f.name, src: await resizePhoto(f) }); } catch { /* skip unreadable file */ } }
    if (out.length) { addJobPhotos(job.id, out); refresh(); say(`${out.length} photo${out.length > 1 ? "s" : ""} added`); }
  };
  const addPart = () => {
    const entry = PARTS.find(p => p.name === partName); if (!entry || !vanCheck(vanStock(entry, job.technician), partQty).ok) return;
    // Taken from the van: van stock is worked out from the parts on jobs, so removing the part puts it back.
    addJobPart(job.id, { item: entry.name, qty: partQty, rate: partRate(job.serviceType, entry.name, entry.unitCost), partNo: entry.partNo, fromVan: partQty });
    setPartName(""); setPartQty(1); refresh();
  };
  const takePayment = () => {
    if (payMethod !== "Cash" && payMethod !== "Pay later" && payRef.trim().length < 3) { say("Add the receipt or cheque reference"); return; }
    recordJobPayment(job.id, { method: payMethod, amount: charges.total, reference: payRef.trim() });
    setPayRef(""); refresh(); say(payMethod === "Pay later" ? "Marked to be invoiced" : "Payment recorded");
  };
  const draftInvoice = () => {
    const r = invoiceReadiness(job);
    if (!r.ok) { setProblems(r.problems.map(p => p.text)); return; }
    const inv = generateInvoice(job.id); refresh(); say(`${inv.number} drafted for the office`);
  };

  const footer = closed ? (
    <Link href="/tech" className="h-14 w-full rounded-xl text-[17px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] flex items-center justify-center">Back to my jobs</Link>
  ) : !completed ? (
    <div className="flex flex-col gap-1.5">
      {step === "complete" && blockers.length > 0 && <p className="m-0 flex items-center gap-1.5 text-caption text-[#B45309]"><WarningCircle size={14} />{blockers.join(" · ")}</p>}
      <button type="button" onClick={act} disabled={stopped} className="h-14 disabled:opacity-50 w-full rounded-xl text-[17px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)]">{STEP_LABEL[step]}</button>
    </div>
  ) : (
    <button type="button" onClick={() => window.print()} className="h-14 w-full rounded-xl text-[17px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] flex items-center justify-center gap-2"><Printer size={20} />Print or save service report</button>
  );

  return (
    <TechShell title={job.customer} subtitle={`${job.jobId} · ${job.status}`} back="/tech" footer={footer}>
      {toast && <div role="status" className="rounded-xl px-4 py-3 text-body font-semibold bg-[#111] text-white">{toast}</div>}
      {(issue || step === "cancelled") && <JobIssueNotice issue={issue} fallback={`${job.jobId} was cancelled by the office.`} />}
      {stopped && ws.safety && (
        <section role="alert" className="rounded-2xl border border-red-300 bg-[rgba(239,68,68,0.10)] p-4 flex flex-col gap-1.5" data-testid="stop-work">
          <p className="m-0 text-[16px] font-bold text-red-700">Work stopped: unsafe condition</p>
          <p className="m-0 text-body text-[var(--text-body)]">{ws.safety.note}</p>
          <p className="m-0 text-body text-[var(--text-body)]">Your timer is stopped. A manager has to clear this before you can continue or complete the job.</p>
          {ws.safety.notified ? <p className="m-0 text-caption text-[var(--text-muted)]">The office has been alerted.</p>
            : <div className="flex items-center gap-2"><p className="m-0 flex-1 text-caption text-red-700">The office has not been alerted yet.</p><button type="button" onClick={retryAlert} className={btnCls}>Try again</button></div>}
        </section>
      )}
      {step === "incomplete" && ws.outcome && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 flex flex-col gap-1.5" data-testid="visit-outcome">
          <p className="m-0 text-[16px] font-bold text-[var(--text-primary)]">Visit not finished: {ws.outcome.reason}</p>
          {ws.outcome.note && <p className="m-0 text-body text-[var(--text-body)]">{ws.outcome.note}</p>}
          <p className="m-0 text-body text-[var(--text-body)]"><b>What happens next:</b> {NEXT_STEPS_TEXT[ws.outcome.reason]}</p>
          <p className="m-0 text-caption text-[var(--text-muted)]">Your timer and location sharing are stopped. You do not need to do anything else for this job.{ws.outcome.followUp ? ` Office decision: ${ws.outcome.followUp.action}.` : ""}</p>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-[18px] font-bold text-[var(--text-primary)]">{job.jobName}</p>
          <span className="text-caption font-bold px-2.5 py-1 rounded-full" style={{ color: meta.light, background: meta.bgLight }}>{job.status}</span>
        </div>
        <p className="m-0 text-body text-[var(--text-body)]">{description}</p>
        <p className="m-0 text-caption text-[var(--text-muted)]">{job.scheduledDate} · {job.scheduledTime} · {job.priority} priority{wo ? ` · ${wo.number}` : ""}</p>
        <div className="grid grid-cols-2 gap-2">
          <a href={mapsUrl(address)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 h-11 rounded-xl border border-[var(--border)] text-label font-semibold text-[var(--text-primary)]"><MapPin size={18} />Directions</a>
          {cust?.phone ? <a href={`tel:${cust.phone}`} className="flex items-center justify-center gap-2 h-11 rounded-xl border border-[var(--border)] text-label font-semibold text-[var(--text-primary)]"><Phone size={18} />Call</a> : <span />}
        </div>
        <p className="m-0 text-caption text-[var(--text-muted)]">{address}{cust?.accessNotes ? ` · Access: ${cust.accessNotes}` : ""}</p>
        {(step === "complete" || completed || closed || stopped) && ws.workStartedAt && (
          <p className="m-0 flex items-center gap-2 text-label font-bold text-[var(--text-primary)]"><Timer size={20} className="text-blue-600" />{clock(elapsed)} on site{completed ? " (finished)" : ws.workEndedAt ? " (stopped)" : ""}</p>
        )}
      </section>

      {!completed && !closed && <FieldActions job={job} name={session?.user?.name ?? job.technician} onChange={m => { refresh(); if (m) say(m); }} />}

      {!completed && <LocationShareToggle jobId={job.id} active={job.status === "En route" || job.status === "On site"} />}

      <Card icon={ListChecks} title="Checklist" badge={<span className="text-caption font-bold text-[var(--text-muted)]">{doneCount}/{items.length}{mandatoryLeft ? ` · ${mandatoryLeft} required left` : ""}</span>}>
        <ul className="m-0 p-0 list-none flex flex-col">
          {items.map((it, i) => (
            <li key={it.label} className="border-b border-[var(--border-soft)] last:border-b-0">
              <div className="flex items-center gap-3 py-2.5">
                <button type="button" aria-pressed={!!checks[i]} aria-label={`${it.label}${it.mandatory ? " (required)" : ""}`} disabled={completed}
                  onClick={() => { setJobCheck(job.id, i, items.length, !checks[i]); refresh(); }} className="flex-shrink-0">
                  {checks[i] ? <CheckCircle size={28} weight="fill" className="text-green-600" /> : <Circle size={28} className="text-[var(--text-muted)]" />}
                </button>
                <span className={`flex-1 text-body ${checks[i] ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>{it.label}{it.mandatory && <span className="text-red-600" title="Required"> *</span>}</span>
                {it.sop && <button type="button" onClick={() => setOpenSop(openSop === `${i}` ? null : `${i}`)} className="text-caption font-semibold text-blue-600 flex items-center gap-1"><BookOpen size={14} />SOP</button>}
              </div>
              {it.sop && openSop === `${i}` && (
                <div className="mb-2.5 ml-10 rounded-xl bg-[var(--serviceops-tint)] p-3">
                  <p className="m-0 mb-1 text-label font-bold text-[var(--text-primary)]">{SOPS[it.sop].title}</p>
                  <ol className="m-0 pl-5 text-body text-[var(--text-body)] flex flex-col gap-1">{SOPS[it.sop].steps.map(s => <li key={s}>{s}</li>)}</ol>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="m-0 mt-2 text-caption text-[var(--text-muted)]">Steps marked * are required before the job can be completed.</p>
      </Card>

      <Card icon={Camera} title="Photos" badge={<span className="text-caption font-bold text-[var(--text-muted)]">{ws.photos.filter(p => p.src).length}</span>}>
        <input ref={photoInput} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => { onPhotos(e.target.files); e.target.value = ""; }} />
        <div className="grid grid-cols-3 gap-2">
          {ws.photos.filter(p => p.src).map(p => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-[var(--serviceops-tint)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.name} className="w-full h-full object-cover" />
              {!completed && <button type="button" aria-label="Remove photo" onClick={() => { removeJobPhoto(job.id, p.id); refresh(); }} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"><Trash size={14} /></button>}
            </div>
          ))}
          {!completed && <button type="button" onClick={() => photoInput.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-1 text-label font-semibold text-blue-600"><Camera size={24} />Add photo</button>}
        </div>
      </Card>

      <Card icon={Package} title="Parts used">
        {charges.parts.length === 0 && <p className="m-0 text-body text-[var(--text-muted)]">No parts recorded yet.</p>}
        <ul className="m-0 p-0 list-none">
          {SERVICE_PRICING[job.serviceType].parts.length > 0 && ws.extraParts.length === 0 && null}
          {charges.parts.map((p, i) => {
            const extraIndex = i - SERVICE_PRICING[job.serviceType].parts.length;
            return (
              <li key={`${p.item}-${i}`} className="flex items-center gap-3 py-2 border-b border-[var(--border-soft)] last:border-b-0">
                <span className="flex-1 text-body text-[var(--text-primary)]">{p.item}{ws.extraParts[extraIndex]?.fromVan ? <span className="block text-caption text-[var(--text-muted)]">From your van</span> : null}</span><span className="text-body text-[var(--text-muted)]">× {p.qty}</span>
                {extraIndex >= 0 && !completed && <button type="button" aria-label={`Remove ${p.item}`} onClick={() => { removeJobPart(job.id, extraIndex); refresh(); }} className="text-[var(--text-muted)]"><Trash size={18} /></button>}
              </li>);
          })}
        </ul>
        {!completed && !closed && (
          <div className="mt-3 flex flex-col gap-2">
            <select aria-label="Part" value={partName} onChange={e => setPartName(e.target.value)} className={inputCls}>
              <option value="">Choose a part…</option>
              {stock.map(({ p, van }) => <option key={p.partNo} value={p.name}>{p.name} ({van} in your van)</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Fewer" onClick={() => setPartQty(q => Math.max(1, q - 1))} className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center justify-center"><Minus size={18} /></button>
              <span className="w-10 text-center text-label font-bold">{partQty}</span>
              <button type="button" aria-label="More" onClick={() => setPartQty(q => q + 1)} className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center justify-center"><Plus size={18} /></button>
              <button type="button" onClick={addPart} disabled={!partName || !van.ok} className={`${btnCls} flex-1`}>Add part</button>
            </div>
            {chosen && !van.ok && (
              <div role="status" className="rounded-xl bg-[rgba(245,158,11,0.12)] p-3 flex flex-col gap-2" data-testid="not-in-van">
                <p className="m-0 text-body font-semibold text-[var(--text-primary)]">{chosenVan === 0 ? "Not in your van" : `Only ${chosenVan} in your van, you need ${partQty}`}</p>
                {asked ? <p className="m-0 text-caption text-[var(--text-muted)]">Already requested ({asked.id}, {asked.status}). The warehouse will bring it.</p>
                  : <button type="button" onClick={requestPart} className={btnCls}>Request this part{van.short > 1 ? ` (${van.short})` : ""}</button>}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card icon={NotePencil} title="Notes">
        {ws.notes.map(n => <p key={n.id} className="m-0 mb-2 text-body text-[var(--text-primary)]">{n.text}<span className="block text-caption text-[var(--text-muted)]">{n.author} · {n.at}</span></p>)}
        {!completed && (
          <div className="flex gap-2">
            <input aria-label="Add a note" value={note} onChange={e => setNote(e.target.value)} placeholder="What did you find or do?" className={inputCls} />
            <button type="button" disabled={note.trim().length < 2} onClick={() => { addJobNote(job.id, note, session?.user?.name ?? "Technician"); setNote(""); refresh(); }} className={btnCls}>Add</button>
          </div>
        )}
      </Card>

      <SignOffCard job={job} ws={ws} locked={completed || closed} by={session?.user?.name ?? job.technician} onChange={refresh} say={say} />

      {completed && (
        <>
          <Card icon={CreditCard} title="Payment" badge={ws.payment ? <span className="text-caption font-bold text-green-700">{ws.payment.method === "Pay later" ? "Invoice later" : "Paid"}</span> : undefined}>
            {ws.payment ? (
              <p className="m-0 text-body text-[var(--text-primary)]">{money(ws.payment.amount)} · {ws.payment.method}{ws.payment.reference ? ` · ref ${ws.payment.reference}` : ""} · {ws.payment.at}</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-body text-[var(--text-body)]">Amount due: <b>{money(charges.total)}</b> (tax included)</p>
                <select aria-label="Payment method" value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls}>
                  {["Cash", "Card on terminal", "Cheque", "Pay later"].map(m => <option key={m}>{m}</option>)}
                </select>
                {(payMethod === "Card on terminal" || payMethod === "Cheque") && <input aria-label="Reference" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={payMethod === "Cheque" ? "Cheque number" : "Receipt number"} className={inputCls} />}
                <button type="button" onClick={takePayment} className={btnCls}>{payMethod === "Pay later" ? "Invoice the customer later" : "Record payment"}</button>
              </div>
            )}
          </Card>

          <Card icon={Receipt} title="Invoice">
            {ws.invoice ? <p className="m-0 text-body text-[var(--text-primary)]">{ws.invoice.number} drafted · the office will send it.</p> : (
              <div className="flex flex-col gap-2"><p className="m-0 text-body text-[var(--text-body)]">Draft the invoice from this job. It is only created when every detail is in place.</p><button type="button" onClick={draftInvoice} className={btnCls}>Draft invoice</button></div>
            )}
          </Card>

          <Card icon={FileText} title="Service report"><p className="m-0 text-body text-[var(--text-body)]">Includes the checklist, parts, notes and the customer&apos;s signature. Use the button below to print it or save it as a PDF.</p></Card>
        </>
      )}

      {problems && (
        <div role="alertdialog" aria-label="Not ready" className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setProblems(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] p-5" onClick={e => e.stopPropagation()}>
            <p className="m-0 mb-2 flex items-center gap-2 text-[17px] font-bold text-[var(--text-primary)]"><WarningCircle size={22} weight="fill" color="#D97706" />Not ready yet</p>
            <ul className="m-0 mb-4 pl-5 text-body text-[var(--text-body)] flex flex-col gap-1">{problems.map(p => <li key={p}>{p}</li>)}</ul>
            <button type="button" onClick={() => setProblems(null)} className="h-12 w-full rounded-xl text-label font-bold text-[#3B1F00] bg-[var(--serviceops-primary)]">OK</button>
          </div>
        </div>
      )}

      <ServiceReportSheet job={job} ws={ws} problem={description} />
    </TechShell>
  );
}
