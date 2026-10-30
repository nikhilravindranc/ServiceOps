"use client";
import { use, useEffect, useState } from "react";
import { Star } from "@phosphor-icons/react";
import AuthCard, { authButton, authInput } from "@/components/auth/AuthCard";

type Doc = { kind: string; status: string; company: string; title: string };

export default function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [doc, setDoc] = useState<Doc | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/link/${token}`).then(async r => { const d = r.ok ? await r.json() : null; setDoc(d && d.kind === "review" ? d : null); }).catch(() => setDoc(null));
  }, [token]);

  const submit = async () => {
    if (!rating) { setError("Choose a rating from 1 to 5 stars."); return; }
    setError(""); setBusy(true);
    const res = await fetch(`/api/public/link/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", rating, comment }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Something went wrong."); return; }
    setDone(true);
  };

  if (doc === undefined) return <AuthCard title="Loading"><p className="text-[13px] text-[#8A8A8A]">One moment…</p></AuthCard>;
  if (doc === null) return <AuthCard title="Link not valid" subtitle="This review link is invalid or has expired." />;
  if (done || doc.status !== "open") return <AuthCard title="Thank you" subtitle={`Your feedback has been shared with ${doc.company}.`} />;

  return (
    <AuthCard title="How did we do?" subtitle={`${doc.company} · ${doc.title}`}>
      <div role="radiogroup" aria-label="Rating" className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)} className="p-1">
            <Star size={34} weight={n <= rating ? "fill" : "regular"} color={n <= rating ? "#F59E0B" : "#C9C9C9"} />
          </button>
        ))}
      </div>
      <textarea className={authInput} rows={3} placeholder="Anything we should know? (optional)" value={comment} onChange={e => setComment(e.target.value)} aria-label="Comment" />
      {error && <p className="mt-2 mb-0 text-[12.5px] text-red-600">{error}</p>}
      <button type="button" onClick={submit} disabled={busy} className={`${authButton} mt-4`}>{busy ? "Sending…" : "Send feedback"}</button>
    </AuthCard>
  );
}
