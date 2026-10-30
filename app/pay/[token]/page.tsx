"use client";
import { use, useEffect, useState } from "react";
import AuthCard, { authButton } from "@/components/auth/AuthCard";
import TestCardForm, { EMPTY_CARD } from "@/components/pay/TestCardForm";

type Doc = { kind: string; status: string; ref: string; company: string; customer: string; title: string; amount?: number };
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [doc, setDoc] = useState<Doc | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [card, setCard] = useState(EMPTY_CARD);

  useEffect(() => {
    fetch(`/api/public/link/${token}`).then(async r => { const d = r.ok ? await r.json() : null; setDoc(d && d.kind === "invoice" ? d : null); }).catch(() => setDoc(null));
  }, [token]);

  const pay = async () => {
    setError(""); setBusy(true);
    const res = await fetch(`/api/public/link/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pay", card }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Payment failed."); return; }
    setPaid(true);
  };

  if (doc === undefined) return <AuthCard title="Loading invoice"><p className="text-[13px] text-[#8A8A8A]">One moment…</p></AuthCard>;
  if (doc === null) return <AuthCard title="Link not valid" subtitle="This payment link is invalid or has expired. Contact the company that sent it." />;
  if (paid || doc.status === "paid") return <AuthCard title="Payment received" subtitle={`Thank you. ${doc.company} has been notified of your payment on invoice ${doc.ref}.`} />;

  return (
    <AuthCard title={`Invoice ${doc.ref}`} subtitle={`${doc.company} · ${doc.customer}`}>
      <p className="m-0 text-[32px] font-extrabold">{money(doc.amount ?? 0)}</p>
      <p className="mt-1 mb-4 text-[12.5px] text-[#8A8A8A]">{doc.title}</p>
      <div className="mb-4"><TestCardForm card={card} onChange={setCard} /></div>
      {error && <p className="m-0 mb-3 text-[12.5px] text-red-600">{error}</p>}
      <button type="button" onClick={pay} disabled={busy} className={authButton}>{busy ? "Processing…" : "Pay now (test mode)"}</button>
    </AuthCard>
  );
}
