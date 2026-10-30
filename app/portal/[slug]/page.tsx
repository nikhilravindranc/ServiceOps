"use client";
import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import AuthCard, { authButton, authInput } from "@/components/auth/AuthCard";

type Data = {
  company: string; slug: string | null; bookingEnabled: boolean; customer: { name: string };
  workOrders: { number: string; title: string; status: string }[];
  estimates: { number: string; status: string; total: number }[];
  invoices: { number: string; amount: number; due: number; status: string }[];
  reviewsGiven: number;
};
const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const TYPES = ["HVAC", "Mechanical", "Plumbing", "Electrical", "Preventive", "Elevator"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-5"><h2 className="m-0 mb-2 text-[14px] font-extrabold uppercase tracking-wide text-[#8A8A8A]">{title}</h2>{children}</section>;
}
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function PortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState({ title: "", description: "", serviceType: "HVAC", site: "" });
  const [reqDone, setReqDone] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/portal/data");
    setData(r.ok ? await r.json() : null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    const r = await post("/api/portal/login", { slug, email });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error ?? "Could not send a code."); return; }
    setSent(true);
    setNotice(d.devCode ? `Email is not configured on this server. Development code: ${d.devCode}` : "If this email belongs to a customer, we sent a 6-digit code. It works for 10 minutes.");
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    const r = await post("/api/portal/verify", { slug, email, code });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "That code is wrong."); return; }
    await load();
  };
  const go = async (action: "estimate-link" | "invoice-link", ref: string) => {
    const r = await post("/api/portal/action", { action, ref });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? "Could not open this."); return; }
    window.location.href = d.url;
  };
  const sendRequest = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    const r = await post("/api/portal/action", { action: "request", ...req });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error ?? "Could not send the request."); return; }
    setReqDone(d.number); setReq({ title: "", description: "", serviceType: "HVAC", site: "" });
  };
  const signOut = async () => { await post("/api/portal/logout", {}); setData(null); setSent(false); setCode(""); };

  if (data === undefined) return <AuthCard title="Loading"><p className="text-[13px] text-[#8A8A8A]">One moment…</p></AuthCard>;

  if (data === null) {
    return (
      <AuthCard title="Customer sign-in" subtitle="Enter the email address we have for you.">
        {error && <p className="mb-3 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</p>}
        {notice && <p className="mb-3 px-3 py-2 rounded-xl text-[12.5px] font-medium text-amber-800" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>{notice}</p>}
        {!sent ? (
          <form onSubmit={sendCode} className="space-y-3">
            <input className={authInput} type="email" placeholder="you@company.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required aria-label="Email" />
            <button type="submit" disabled={busy} className={authButton}>{busy ? "Sending…" : "Email me a code"}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <input className={authInput} inputMode="numeric" maxLength={6} placeholder="6-digit code" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required aria-label="Code" />
            <button type="submit" disabled={busy} className={authButton}>{busy ? "Checking…" : "Sign in"}</button>
          </form>
        )}
      </AuthCard>
    );
  }

  const waiting = data.estimates.filter(e => e.status === "Sent");
  const due = data.invoices.filter(i => i.due > 0);
  return (
    <AuthCard wide title={`Welcome, ${data.customer.name}`} subtitle={data.company}>
      {error && <p className="mb-3 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</p>}

      {waiting.length > 0 && <Section title="Estimates waiting for you">
        {waiting.map(e => <div key={e.number} className="flex items-center justify-between gap-3 py-2 border-b border-[#EEE] text-[13px]"><span><b>{e.number}</b> · {money(e.total)}</span><button type="button" className="font-bold text-[#B45309]" onClick={() => go("estimate-link", e.number)}>Review and approve</button></div>)}
      </Section>}

      {due.length > 0 && <Section title="Invoices to pay">
        {due.map(i => <div key={i.number} className="flex items-center justify-between gap-3 py-2 border-b border-[#EEE] text-[13px]"><span><b>{i.number}</b> · {money(i.due)} due {i.status === "Overdue" && <span className="text-red-600 font-semibold">(overdue)</span>}</span><button type="button" className="font-bold text-[#B45309]" onClick={() => go("invoice-link", i.number)}>Pay</button></div>)}
      </Section>}

      <Section title="Your service requests">
        {data.workOrders.length ? <ul className="m-0 p-0 list-none text-[13px]">{data.workOrders.map(w => <li key={w.number} className="flex justify-between gap-3 py-2 border-b border-[#EEE]"><span><b>{w.number}</b> · {w.title}</span><span className="font-semibold text-[#6B6B6B] whitespace-nowrap">{w.status}</span></li>)}</ul> : <p className="m-0 text-[13px] text-[#8A8A8A]">No service requests yet.</p>}
      </Section>

      <Section title="Request service">
        {reqDone ? <p className="m-0 text-[13px] text-emerald-700 font-semibold">Thank you. {data.company} has your request ({reqDone}) and will be in touch.</p> : (
          <form onSubmit={sendRequest} className="space-y-3">
            <input className={authInput} placeholder="What do you need?" value={req.title} onChange={e => setReq({ ...req, title: e.target.value })} required aria-label="What do you need" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select className={authInput} value={req.serviceType} onChange={e => setReq({ ...req, serviceType: e.target.value })} aria-label="Type of service">{TYPES.map(t => <option key={t}>{t}</option>)}</select>
              <input className={authInput} placeholder="Site or address (optional)" value={req.site} onChange={e => setReq({ ...req, site: e.target.value })} aria-label="Site" />
            </div>
            <textarea className={authInput} rows={2} placeholder="Details (optional)" value={req.description} onChange={e => setReq({ ...req, description: e.target.value })} aria-label="Details" />
            <button type="submit" disabled={busy} className={authButton}>{busy ? "Sending…" : "Send request"}</button>
          </form>
        )}
      </Section>

      {data.slug && data.bookingEnabled && <Section title="Refer a friend">
        <p className="m-0 text-[13px] text-[#6B6B6B]">Share this link. Requests that come through it are tagged as your referral.</p>
        <input readOnly aria-label="Referral link" className={`${authInput} mt-2`} onFocus={e => e.currentTarget.select()} value={`${typeof window !== "undefined" ? window.location.origin : ""}/book/${data.slug}?ref=${encodeURIComponent(data.customer.name)}`} />
      </Section>}

      <button type="button" onClick={signOut} className="mt-6 text-[13px] font-bold text-[#6B6B6B] underline">Sign out</button>
    </AuthCard>
  );
}
