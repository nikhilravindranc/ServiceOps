"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthCard, { authButton } from "@/components/auth/AuthCard";

function Verify() {
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "ok" | "bad">("working");

  useEffect(() => {
    fetch("/api/account/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: params.get("email"), token: params.get("token") }) })
      .then(r => setState(r.ok ? "ok" : "bad"))
      .catch(() => setState("bad"));
  }, [params]);

  if (state === "working") return <AuthCard title="Verifying your email"><p className="text-[13px] text-[#8A8A8A]">One moment…</p></AuthCard>;
  if (state === "ok") return (
    <AuthCard title="Email verified" subtitle="Your account is ready.">
      <Link href="/login" className={`${authButton} block text-center`}>Sign in</Link>
    </AuthCard>
  );
  return (
    <AuthCard title="Link not valid" subtitle="This verification link is invalid or has expired.">
      <Link href="/login" className={`${authButton} block text-center`}>Back to sign in</Link>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
