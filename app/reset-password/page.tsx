"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthCard, { authButton, authInput } from "@/components/auth/AuthCard";

function Reset() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    const res = await fetch("/api/account/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: params.get("email"), token: params.get("token"), password }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Could not reset the password."); return; }
    setDone(true);
  };

  if (done) return (
    <AuthCard title="Password updated" subtitle="You can now sign in with your new password.">
      <Link href="/login" className={`${authButton} block text-center`}>Sign in</Link>
    </AuthCard>
  );
  return (
    <AuthCard title="Choose a new password" subtitle="Use at least 8 characters.">
      {error && <p className="mb-3 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</p>}
      <form onSubmit={submit} className="space-y-3">
        <input type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} className={authInput} required />
        <button type="submit" disabled={busy} className={authButton}>{busy ? "Saving…" : "Update password"}</button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><Reset /></Suspense>;
}
