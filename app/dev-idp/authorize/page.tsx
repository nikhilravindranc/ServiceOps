"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthCard, { authButton, authInput } from "@/components/auth/AuthCard";

const PEOPLE = [
  { name: "Ada Test", email: "ada@test.example" },
  { name: "Grace Test", email: "grace@test.example" },
  { name: "Tech Evoq", email: "tech@evoq.one" },
];

function Screen() {
  const p = useSearchParams();
  const brand = p.get("client_id") === "test-microsoft" ? "Microsoft" : "Google";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const approve = async (n: string, e: string) => {
    setError(""); setBusy(true);
    const res = await fetch("/api/dev-idp/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redirect_uri: p.get("redirect_uri"), state: p.get("state"), client_id: p.get("client_id"), name: n, email: e }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); setError(d.error ?? "Could not sign in."); return; }
    window.location.href = d.url;
  };

  return (
    <AuthCard title={`Sign in with ${brand} (test)`} subtitle="This is a local test identity provider, not the real one. Pick or type any email to sign in as that person.">
      {error && <p className="mb-3 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</p>}
      <div className="space-y-2 mb-4">
        {PEOPLE.map(x => <button key={x.email} type="button" disabled={busy} onClick={() => approve(x.name, x.email)} className="w-full text-left px-4 py-2.5 rounded-xl border-[1.5px] border-[#E5E5E5] bg-white hover:bg-[#FFFBEB]"><b className="block text-[14px]">{x.name}</b><span className="text-[12.5px] text-[#6B6B6B]">{x.email}</span></button>)}
      </div>
      <form onSubmit={e => { e.preventDefault(); approve(name, email); }} className="space-y-2">
        <input className={authInput} placeholder="Name" value={name} onChange={e => setName(e.target.value)} aria-label="Name" />
        <input className={authInput} type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} required aria-label="Email" />
        <button type="submit" disabled={busy} className={authButton}>Continue</button>
      </form>
    </AuthCard>
  );
}

export default function DevIdpPage() {
  return <Suspense><Screen /></Suspense>;
}
