"use client";
import { use, useEffect, useState } from "react";
import AuthCard, { authButton, authInput } from "@/components/auth/AuthCard";
import TestCardForm, { EMPTY_CARD } from "@/components/pay/TestCardForm";

type Line = { item: string; qty: number; rate: number };
type Option = { key: string; label: string; lines: Line[] };
type Doc = { status: string; ref: string; company: string; customer: string; title: string; taxPct: number; lines: Line[]; options?: Option[]; depositPct?: number; chosenOption?: string | null; signedName?: string | null };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sum = (lines: Line[]) => lines.reduce((s, l) => s + l.qty * l.rate, 0);

export default function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [doc, setDoc] = useState<Doc | null | undefined>(undefined);
  const [option, setOption] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"approved" | "declined" | null>(null);
  const [card, setCard] = useState(EMPTY_CARD);

  useEffect(() => {
    fetch(`/api/public/link/${token}`).then(async r => {
      const d = r.ok ? await r.json() : null;
      setDoc(d && d.kind === "estimate" ? d : null);
      if (d?.options?.length) setOption(d.options[Math.min(1, d.options.length - 1)].key);
    }).catch(() => setDoc(null));
  }, [token]);

  const act = async (action: "approve" | "decline") => {
    setError("");
    if (action === "approve" && (name.trim().length < 2 || !agree)) { setError("Type your full name and tick the box to approve."); return; }
    setBusy(true);
    const res = await fetch(`/api/public/link/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, option, name, card }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    setDone(action === "approve" ? "approved" : "declined");
  };

  if (doc === undefined) return <AuthCard title="Loading estimate"><p className="text-[13px] text-[#8A8A8A]">One moment…</p></AuthCard>;
  if (doc === null) return <AuthCard title="Link not valid" subtitle="This estimate link is invalid or has expired. Contact the company that sent it." />;
  if (done || doc.status !== "open") {
    const state = done ?? (doc.status === "approved" ? "approved" : "declined");
    return (
      <AuthCard title={state === "approved" ? "Estimate approved" : "Estimate declined"}
        subtitle={state === "approved" ? `Thank you${doc.signedName ? `, ${doc.signedName}` : ""}. ${doc.company} will contact you to schedule the work.` : `${doc.company} has been told.`} />
    );
  }

  const chosen = doc.options?.find(o => o.key === option);
  const lines = chosen?.lines ?? doc.lines;
  const sub = sum(lines), tax = sub * (doc.taxPct / 100), total = sub + tax;
  const deposit = doc.depositPct ? total * (doc.depositPct / 100) : 0;

  return (
    <AuthCard wide title={`Estimate ${doc.ref}`} subtitle={`${doc.company} · for ${doc.customer} · ${doc.title}`}>
      {doc.options && doc.options.length > 0 && (
        <fieldset className="m-0 mb-4 p-0 border-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <legend className="sr-only">Choose an option</legend>
          {doc.options.map(o => (
            <label key={o.key} className="cursor-pointer rounded-2xl border-[1.5px] p-3 flex flex-col gap-1" style={{ borderColor: option === o.key ? "#F59E0B" : "#E5E5E5", background: option === o.key ? "#FFFBEB" : "#fff" }}>
              <span className="flex items-center gap-2"><input type="radio" name="option" checked={option === o.key} onChange={() => setOption(o.key)} /><b className="text-[14px]">{o.label}</b></span>
              <span className="text-[18px] font-extrabold">{money(sum(o.lines) * (1 + doc.taxPct / 100))}</span>
              <span className="text-[12px] text-[#6B6B6B]">{o.lines.length} line{o.lines.length === 1 ? "" : "s"}, tax included</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="overflow-x-auto"><table className="w-full text-[13px]">
        <thead><tr className="text-left text-[#8A8A8A]"><th className="py-1.5 font-semibold">Item</th><th className="py-1.5 text-right font-semibold">Qty</th><th className="py-1.5 text-right font-semibold">Rate</th><th className="py-1.5 text-right font-semibold">Amount</th></tr></thead>
        <tbody>{lines.map((l, i) => <tr key={i} className="border-t border-[#EEE]"><td className="py-1.5">{l.item}</td><td className="py-1.5 text-right">{l.qty}</td><td className="py-1.5 text-right">{money(l.rate)}</td><td className="py-1.5 text-right font-semibold">{money(l.qty * l.rate)}</td></tr>)}</tbody>
      </table></div>
      <div className="mt-3 ml-auto max-w-[280px] text-[13px] space-y-1">
        <div className="flex justify-between"><span className="text-[#6B6B6B]">Subtotal</span><span>{money(sub)}</span></div>
        <div className="flex justify-between"><span className="text-[#6B6B6B]">Tax ({doc.taxPct}%)</span><span>{money(tax)}</span></div>
        <div className="flex justify-between border-t border-[#EEE] pt-1.5 text-[16px] font-extrabold"><span>Total</span><span>{money(total)}</span></div>
        {deposit > 0 && <div className="flex justify-between text-[#B45309] font-semibold"><span>Deposit due on approval ({doc.depositPct}%)</span><span>{money(deposit)}</span></div>}
      </div>

      <div className="mt-5 pt-4 border-t border-[#EEE] space-y-3">
        {error && <p className="m-0 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</p>}
        {deposit > 0 && <div><p className="m-0 mb-2 text-[13px] font-semibold">Pay the {money(deposit)} deposit to approve</p><TestCardForm card={card} onChange={setCard} /></div>}
        <input className={authInput} placeholder="Type your full name to sign" autoComplete="name" value={name} onChange={e => setName(e.target.value)} aria-label="Full name" />
        <label className="flex items-start gap-2 text-[13px] text-[#3D3D3D]"><input type="checkbox" className="mt-1" checked={agree} onChange={e => setAgree(e.target.checked)} />I approve this estimate and authorise the work at the price shown.</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={() => act("approve")} disabled={busy} className={authButton}>{busy ? "Processing…" : deposit > 0 ? `Pay ${money(deposit)} and approve` : "Approve and sign"}</button>
          <button type="button" onClick={() => act("decline")} disabled={busy} className="w-full py-3 rounded-xl text-[14px] font-bold border-[1.5px] border-[#E5E5E5] bg-white hover:bg-[#F7F7F7]">Decline</button>
        </div>
      </div>
    </AuthCard>
  );
}
