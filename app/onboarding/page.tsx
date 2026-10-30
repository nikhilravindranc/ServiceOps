"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, CheckCircle, Plus, X } from "@phosphor-icons/react";
import AuthCard, { authButton, authInput } from "@/components/auth/AuthCard";
import { SERVICE_PRICING, SERVICE_ZONES } from "@/lib/serviceData";

const ALL_TYPES = Object.keys(SERVICE_PRICING);
const ROLES = ["Dispatcher", "Service coordinator", "Service manager", "Technician", "Administrator"];
const STEPS = ["Company", "Services and zones", "Team", "Review"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"];

type Invite = { email: string; role: string; sent?: boolean; link?: string; error?: string };

export default function OnboardingPage() {
  const { update } = useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState(TIMEZONES[0]);
  const [hoursStart, setHoursStart] = useState("08:00");
  const [hoursEnd, setHoursEnd] = useState("17:00");
  const [types, setTypes] = useState<string[]>(["HVAC", "Plumbing", "Electrical"]);
  const [zones, setZones] = useState<string[]>([...SERVICE_ZONES]);
  const [zoneInput, setZoneInput] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("Technician");

  useEffect(() => {
    fetch("/api/org").then(r => r.json()).then(o => {
      if (o.name) setName(o.name.endsWith("'s company") ? "" : o.name);
      setIndustry(o.industry ?? ""); setTimezone(o.timezone ?? TIMEZONES[0]);
      setHoursStart(o.hoursStart ?? "08:00"); setHoursEnd(o.hoursEnd ?? "17:00");
    }).catch(() => {});
  }, []);

  const save = async (body: object) => {
    const res = await fetch("/api/org", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save.");
  };

  const next = async () => {
    setError(""); setBusy(true);
    try {
      if (step === 0) {
        if (name.trim().length < 2) throw new Error("Enter your company name.");
        await save({ name: name.trim(), industry: industry.trim(), timezone, hoursStart, hoursEnd, onboardingStep: 1 });
      } else if (step === 1) {
        if (!types.length) throw new Error("Choose at least one service type.");
        if (!zones.length) throw new Error("Add at least one service zone.");
        await save({ serviceTypes: types, zones, onboardingStep: 2 });
      }
      setStep(s => s + 1);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const addInvite = async () => {
    setError("");
    const email = invEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    setBusy(true);
    const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: invRole }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Could not send the invitation."); return; }
    setInvites(v => [...v, { email, role: invRole, sent: true, link: data.devLink }]);
    setInvEmail("");
  };

  const finish = async () => {
    setError(""); setBusy(true);
    try {
      await save({ complete: true, onboardingStep: 4 });
      await update({ onboarded: true });
      window.location.href = "/";
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  const addZone = () => {
    const z = zoneInput.trim();
    if (z && !zones.includes(z)) setZones(v => [...v, z]);
    setZoneInput("");
  };
  const toggle = (t: string) => setTypes(v => v.includes(t) ? v.filter(x => x !== t) : [...v, t]);

  return (
    <AuthCard title="Set up your workspace" subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
      <div className="flex gap-1.5 mb-5" aria-hidden>
        {STEPS.map((s, i) => <div key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? "#F59E0B" : "#EEEEEE" }} />)}
      </div>
      {error && <p className="mb-3 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</p>}

      {step === 0 && (
        <div className="space-y-3">
          <label className="block text-[12px] font-semibold text-[#6B6B6B]">Company name
            <input className={`${authInput} mt-1`} value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
          <label className="block text-[12px] font-semibold text-[#6B6B6B]">Industry (optional)
            <input className={`${authInput} mt-1`} value={industry} onChange={e => setIndustry(e.target.value)} placeholder="HVAC, facilities, plumbing…" /></label>
          <label className="block text-[12px] font-semibold text-[#6B6B6B]">Time zone
            <select className={`${authInput} mt-1`} value={timezone} onChange={e => setTimezone(e.target.value)}>
              {TIMEZONES.map(t => <option key={t}>{t}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-semibold text-[#6B6B6B]">Opens
              <input type="time" className={`${authInput} mt-1`} value={hoursStart} onChange={e => setHoursStart(e.target.value)} /></label>
            <label className="block text-[12px] font-semibold text-[#6B6B6B]">Closes
              <input type="time" className={`${authInput} mt-1`} value={hoursEnd} onChange={e => setHoursEnd(e.target.value)} /></label>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <p className="m-0 mb-2 text-[12px] font-semibold text-[#6B6B6B]">Service types you offer</p>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map(t => (
                <button type="button" key={t} onClick={() => toggle(t)} aria-pressed={types.includes(t)}
                  className="px-3 py-1.5 rounded-full text-[13px] font-semibold border-[1.5px] transition-colors"
                  style={{ borderColor: types.includes(t) ? "#F59E0B" : "#E5E5E5", background: types.includes(t) ? "#FFFBEB" : "white", color: "#3D3D3D" }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="m-0 mb-2 text-[12px] font-semibold text-[#6B6B6B]">Service zones</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {zones.map(z => (
                <span key={z} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full text-[13px] font-semibold bg-[#F7F7F7] border border-[#E5E5E5]">
                  {z}<button type="button" aria-label={`Remove ${z}`} onClick={() => setZones(v => v.filter(x => x !== z))} className="p-0.5 rounded-full hover:bg-[#E5E5E5]"><X size={12} weight="bold" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={authInput} placeholder="Add a zone" value={zoneInput} onChange={e => setZoneInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addZone(); } }} />
              <button type="button" onClick={addZone} className="px-3 rounded-xl border-[1.5px] border-[#E5E5E5] bg-white" aria-label="Add zone"><Plus size={16} weight="bold" /></button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="m-0 text-[13px] text-[#6B6B6B]">Invite the people who will use ServiceOps. You can skip this and do it later from Users.</p>
          <div className="flex gap-2">
            <input type="email" className={authInput} placeholder="name@company.com" value={invEmail} onChange={e => setInvEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }} />
            <select className={`${authInput} !w-[150px]`} value={invRole} onChange={e => setInvRole(e.target.value)} aria-label="Role">{ROLES.map(r => <option key={r}>{r}</option>)}</select>
          </div>
          <button type="button" onClick={addInvite} disabled={busy} className="text-[13px] font-bold text-[#B45309]">+ Send invitation</button>
          {invites.map(i => (
            <div key={i.email} className="px-3 py-2 rounded-xl bg-[#F7F7F7] text-[13px]">
              <div className="flex justify-between"><span className="font-semibold">{i.email}</span><span className="text-[#8A8A8A]">{i.role}</span></div>
              {i.link && <a href={i.link} className="text-[12px] font-bold text-[#B45309] underline">Email is not configured here. Open the invite link.</a>}
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2 text-[13.5px]">
          <div className="flex items-center gap-2 font-bold text-[#1F1F1F]"><CheckCircle size={20} weight="fill" color="#10B981" /> Ready to go</div>
          <p className="m-0 text-[#6B6B6B]"><b>{name}</b> · {timezone} · {hoursStart}–{hoursEnd}</p>
          <p className="m-0 text-[#6B6B6B]">{types.length} service types · {zones.length} zones · {invites.length} invitation{invites.length === 1 ? "" : "s"} sent</p>
          <p className="m-0 text-[#8A8A8A]">Your Home page has a First Steps list to add customers, create a request and schedule your first job.</p>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        {step > 0 && <button type="button" onClick={() => setStep(s => s - 1)} disabled={busy} className="px-4 py-3 rounded-xl border-[1.5px] border-[#E5E5E5] bg-white text-[14px] font-bold flex items-center gap-1.5"><ArrowLeft size={14} weight="bold" />Back</button>}
        {step < 3
          ? <button type="button" onClick={next} disabled={busy} className={`${authButton} flex items-center justify-center gap-2`}>{step === 2 && !invites.length ? "Skip for now" : "Continue"}<ArrowRight size={15} weight="bold" /></button>
          : <button type="button" onClick={finish} disabled={busy} className={authButton}>{busy ? "Finishing…" : "Open my workspace"}</button>}
      </div>
    </AuthCard>
  );
}
