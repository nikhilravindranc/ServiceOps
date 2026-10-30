"use client";
import { use, useEffect, useState } from "react";
import AuthCard, { authButton, authInput } from "@/components/auth/AuthCard";

type Info = { company: string; serviceTypes: string[]; arrivalWindowMins: number };
const DEFAULT_TYPES = ["HVAC", "Mechanical", "Plumbing", "Electrical", "Preventive", "Elevator"];

export default function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [f, setF] = useState({ name: "", email: "", phone: "", address: "", serviceType: "", description: "", preferred: "", website: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [ref, setRef] = useState("");
  useEffect(() => { setRef(new URLSearchParams(window.location.search).get("ref") ?? ""); }, []);

  useEffect(() => {
    fetch(`/api/public/book/${slug}`).then(async r => {
      const d = r.ok ? await r.json() : null;
      setInfo(d);
      if (d) setF(x => ({ ...x, serviceType: (d.serviceTypes[0] ?? DEFAULT_TYPES[0]) }));
    }).catch(() => setInfo(null));
  }, [slug]);

  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    const res = await fetch(`/api/public/book/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, ref }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Could not send your request."); return; }
    setDone(data.number);
  };

  if (info === undefined) return <AuthCard title="Loading"><p className="text-[13px] text-[#8A8A8A]">One moment…</p></AuthCard>;
  if (info === null) return <AuthCard title="Booking not available" subtitle="This booking page does not exist or is turned off." />;
  if (done) return <AuthCard title="Request received" subtitle={`Thank you. ${info.company} has your request (${done}) and will confirm a time. Arrival windows are about ${info.arrivalWindowMins / 60} hours.`} />;

  const types = info.serviceTypes.length ? info.serviceTypes : DEFAULT_TYPES;
  return (
    <AuthCard title={`Book service with ${info.company}`} subtitle="Tell us what you need and we will confirm a time.">
      {error && <p className="mb-3 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</p>}
      <form onSubmit={submit} className="space-y-3">
        <input className={authInput} placeholder="Your name" autoComplete="name" value={f.name} onChange={e => set("name", e.target.value)} required aria-label="Your name" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={authInput} type="email" placeholder="Email" autoComplete="email" value={f.email} onChange={e => set("email", e.target.value)} required aria-label="Email" />
          <input className={authInput} type="tel" placeholder="Phone (optional)" autoComplete="tel" value={f.phone} onChange={e => set("phone", e.target.value)} aria-label="Phone" />
        </div>
        <input className={authInput} placeholder="Service address" autoComplete="street-address" value={f.address} onChange={e => set("address", e.target.value)} required aria-label="Service address" />
        <select className={authInput} value={f.serviceType} onChange={e => set("serviceType", e.target.value)} aria-label="Type of service">{types.map(t => <option key={t}>{t}</option>)}</select>
        <textarea className={authInput} rows={3} placeholder="What needs doing?" value={f.description} onChange={e => set("description", e.target.value)} required aria-label="What needs doing" />
        <input className={authInput} placeholder="Preferred day and time (optional)" value={f.preferred} onChange={e => set("preferred", e.target.value)} aria-label="Preferred time" />
        <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={e => set("website", e.target.value)} aria-hidden />
        <button type="submit" disabled={busy} className={authButton}>{busy ? "Sending…" : "Request service"}</button>
      </form>
    </AuthCard>
  );
}
