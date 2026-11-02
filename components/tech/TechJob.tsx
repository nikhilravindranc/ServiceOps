"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { MapPin, Phone, Camera, Trash, Plus, Minus, CheckCircle, Circle, ListChecks, Package, NotePencil, Signature, CreditCard, FileText, BookOpen, Timer, WarningCircle, Receipt, Printer } from "@phosphor-icons/react";
import {
  getWorkspace, setJobCheck, setJobSignature, addJobPhotos, removeJobPhoto, addJobNote, addJobPart, removeJobPart, recordJobPayment,
  generateInvoice, JOB_EXTRAS, STATUS_META, ALL_JOBS,
} from "@/lib/jobsData";
import { PARTS, SERVICE_PRICING, customerByName, invoiceReadiness, jobCharges, money, workOrderForJob } from "@/lib/serviceData";
import { checklistFor, SOPS } from "@/lib/checklists";
import { advanceJob, completionProblems, STEP_LABEL, techStep } from "@/lib/techFlow";
import { resizePhoto } from "@/lib/photoResize";
import TechShell from "./TechShell";
import SignaturePad from "./SignaturePad";
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
  const [sigName, setSigName] = useState("");
  const [sigData, setSigData] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [payMethod, setPayMethod] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [problems, setProblems] = useState<string[] | null>(null);

  const ws = job ? getWorkspace(job.id) : null;
  useEffect(() => { if (!ws?.workStartedAt || ws.workEndedAt) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [ws?.workStartedAt, ws?.workEndedAt]);

  if (!job || !ws) return <TechShell title="Job not found" back="/tech"><p className="text-body text-[var(--text-muted)]">This job does not exist.</p></TechShell>;
  const role = session?.user?.role ?? "";
  if (session && job.technician !== session.user?.name && !OFFICE_ROLES.includes(role)) {
    return <TechShell title="Not your job" back="/tech"><p className="text-body text-[var(--text-muted)]">{job.jobId} is assigned to {job.technician}.</p></TechShell>;
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
  const stock = PARTS.map(p => ({ p, van: p.techStock[job.technician] ?? 0 })).sort((a, b) => Number(b.p.category === job.serviceType) - Number(a.p.category === job.serviceType));

  const act = () => {
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
    const entry = PARTS.find(p => p.name === partName); if (!entry || partQty < 1) return;
    addJobPart(job.id, { item: entry.name, qty: partQty, rate: partRate(job.serviceType, entry.name, entry.unitCost) });
    setPartName(""); setPartQty(1); refresh();
  };
  const saveSignature = () => {
    if (!sigData || sigName.trim().length < 2) { say("Enter the customer's name and sign"); return; }
    setJobSignature(job.id, sigName, sigData); setSigData(null); refresh();
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

  const footer = !completed ? (
    <div className="flex flex-col gap-1.5">
      {step === "complete" && blockers.length > 0 && <p className="m-0 flex items-center gap-1.5 text-caption text-[#B45309]"><WarningCircle size={14} />{blockers.join(" · ")}</p>}
      <button type="button" onClick={act} className="h-14 w-full rounded-xl text-[17px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)]">{STEP_LABEL[step]}</button>
    </div>
  ) : (
    <button type="button" onClick={() => window.print()} className="h-14 w-full rounded-xl text-[17px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] flex items-center justify-center gap-2"><Printer size={20} />Print or save service report</button>
  );

  return (
    <TechShell title={job.customer} subtitle={`${job.jobId} · ${job.status}`} back="/tech" footer={footer}>
      {toast && <div role="status" className="rounded-xl px-4 py-3 text-body font-semibold bg-[#111] text-white">{toast}</div>}

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
        {(step === "complete" || completed) && ws.workStartedAt && (
          <p className="m-0 flex items-center gap-2 text-label font-bold text-[var(--text-primary)]"><Timer size={20} className="text-blue-600" />{clock(elapsed)} on site{completed ? " (finished)" : ""}</p>
        )}
      </section>

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
                <span className="flex-1 text-body text-[var(--text-primary)]">{p.item}</span><span className="text-body text-[var(--text-muted)]">× {p.qty}</span>
                {extraIndex >= 0 && !completed && <button type="button" aria-label={`Remove ${p.item}`} onClick={() => { removeJobPart(job.id, extraIndex); refresh(); }} className="text-[var(--text-muted)]"><Trash size={18} /></button>}
              </li>);
          })}
        </ul>
        {!completed && (
          <div className="mt-3 flex flex-col gap-2">
            <select aria-label="Part" value={partName} onChange={e => setPartName(e.target.value)} className={inputCls}>
              <option value="">Choose a part…</option>
              {stock.map(({ p, van }) => <option key={p.partNo} value={p.name}>{p.name} ({van} in your van)</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Fewer" onClick={() => setPartQty(q => Math.max(1, q - 1))} className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center justify-center"><Minus size={18} /></button>
              <span className="w-10 text-center text-label font-bold">{partQty}</span>
              <button type="button" aria-label="More" onClick={() => setPartQty(q => q + 1)} className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center justify-center"><Plus size={18} /></button>
              <button type="button" onClick={addPart} disabled={!partName} className={`${btnCls} flex-1`}>Add part</button>
            </div>
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

      <Card icon={Signature} title="Customer sign-off" badge={ws.signature ? <span className="text-caption font-bold text-green-700">Signed</span> : undefined}>
        {ws.signature ? (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ws.signature.dataUrl} alt="Customer signature" className="h-24 object-contain self-start rounded-lg border border-[var(--border-soft)] bg-white" />
            <p className="m-0 text-body text-[var(--text-primary)]">{ws.signature.name} · {ws.signature.at}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <input aria-label="Customer name" value={sigName} onChange={e => setSigName(e.target.value)} placeholder="Customer's full name" className={inputCls} />
            <SignaturePad onChange={setSigData} />
            <button type="button" onClick={saveSignature} disabled={!sigData || sigName.trim().length < 2} className={btnCls}>Save signature</button>
          </div>
        )}
      </Card>

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
