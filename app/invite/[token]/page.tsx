"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import AuthCard, { authButton, authInput } from "@/components/auth/AuthCard";

type Invite = { email: string; role: string; company: string };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/account/invite-accept?token=${encodeURIComponent(token)}`).then(async r => setInvite(r.ok ? await r.json() : null)).catch(() => setInvite(null));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const res = await fetch("/api/account/invite-accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, password }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Could not accept the invitation."); return; }
    setDone(true);
  };

  if (invite === undefined) return <AuthCard title="Loading invitation"><p className="text-[13px] text-[#8A8A8A]">One moment…</p></AuthCard>;
  if (invite === null) return (
    <AuthCard title="Invitation not valid" subtitle="This invitation is invalid or has expired. Ask your administrator to send a new one.">
      <Link href="/login" className={`${authButton} block text-center`}>Back to sign in</Link>
    </AuthCard>
  );
  if (done) return (
    <AuthCard title="You're in" subtitle={`Your account for ${invite.company} is ready.`}>
      <Link href="/login" className={`${authButton} block text-center`}>Sign in</Link>
    </AuthCard>
  );
  return (
    <AuthCard title={`Join ${invite.company}`} subtitle={`You were invited as ${invite.role}. Set up your account for ${invite.email}.`}>
      {error && <p className="mb-3 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</p>}
      <form onSubmit={submit} className="space-y-3">
        <input placeholder="Full name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={authInput} required />
        <input type="password" autoComplete="new-password" placeholder="Password (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} className={authInput} required />
        <button type="submit" disabled={busy} className={authButton}>{busy ? "Saving…" : "Create my account"}</button>
      </form>
    </AuthCard>
  );
}
