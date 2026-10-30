"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeSlash, ArrowRight, LockSimple, EnvelopeSimple } from "@phosphor-icons/react";

export default function LoginPage() {
  const router = useRouter();

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [emailFocus,  setEmailFocus]  = useState(false);
  const [passFocus,   setPassFocus]   = useState(false);
  const [otpMode,     setOtpMode]     = useState(false);
  const [otpSent,     setOtpSent]     = useState(false);
  const [code,        setCode]        = useState("");
  const [notice,      setNotice]      = useState("");
  const [providers,   setProviders]   = useState<Record<string, unknown>>({});

  useEffect(() => { fetch("/api/auth/providers").then(r => r.json()).then(setProviders).catch(() => {}); }, []);

  const finish = (res: { error?: string | null } | undefined, failure: string) => {
    if (res?.error) { setError(failure); setLoading(false); return; }
    // Full navigation so the middleware sees the new session cookie.
    window.location.href = "/";
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setNotice("");
    setLoading(true);
    if (otpMode) {
      if (!otpSent) {
        const r = await fetch("/api/account/otp-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        const data = await r.json().catch(() => ({}));
        setLoading(false);
        if (!r.ok) { setError(data.error ?? "Could not send a code. Try again."); return; }
        setOtpSent(true);
        setNotice(data.devCode ? `Email is not configured on this server. Development code: ${data.devCode}` : "If that email has an account, we sent a 6-digit code. It works for 10 minutes.");
        return;
      }
      finish(await signIn("otp", { email, code, redirect: false }), "That code is wrong or has expired.");
      return;
    }
    finish(
      await signIn("credentials", { email, password, redirect: false }),
      "Invalid email or password, or the email is not verified yet. Accounts lock for 15 minutes after 5 failed attempts.",
    );
  };

  const social = (id: "google" | "microsoft-entra-id") => {
    if (!providers[id]) { setError("This sign-in method is not set up on this server yet."); return; }
    signIn(id, { callbackUrl: "/" });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #FFFDF7 0%, #FFF7E6 50%, #FEF3C7 100%)" }}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #FDE68A 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #FCD34D 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }} />
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-[460px] rounded-3xl shadow-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "0 25px 60px rgba(245,158,11,0.14), 0 8px 24px rgba(0,0,0,0.06)",
        }}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #D97706 0%, #F59E0B 50%, #FBBF24 100%)" }} />

        <div className="px-10 py-7">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <img src="/logo.png" alt="ServiceOps" style={{ height: "28px", width: "auto" }} />
          </div>

          {/* Heading */}
          <div className="mb-5">
            <h1 className="m-0 text-[22px] font-extrabold text-[#111111] tracking-tight leading-tight">
              Welcome back
            </h1>
            <p className="text-[#8A8A8A] text-[13px] mt-0.5 font-medium">
              Sign in to your ServiceOps workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-[13px] font-medium text-red-700 flex items-center gap-2"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <LockSimple size={14} weight="fill" className="flex-shrink-0 text-red-500" />
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-5 px-4 py-3 rounded-xl text-[13px] font-medium text-amber-800"
              style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>{notice}</div>
          )}

          <form onSubmit={handleSignIn} className="space-y-3">
            {/* Email */}
            <div className="relative">
              <label
                className="absolute left-4 transition-all duration-200 pointer-events-none font-medium z-10"
                style={{
                  top: emailFocus || email ? "8px" : "50%",
                  transform: emailFocus || email ? "translateY(0) scale(0.8)" : "translateY(-50%)",
                  transformOrigin: "left",
                  color: emailFocus ? "#B45309" : "#8A8A8A",
                  fontSize: emailFocus || email ? "10px" : "14px",
                }}
              >
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
                required
                className="w-full pt-5 pb-2 px-4 rounded-xl text-[14px] font-medium text-[#1F1F1F] outline-none transition-all"
                style={{
                  background: emailFocus ? "#FFFCF5" : "#F7F7F7",
                  border: `1.5px solid ${emailFocus ? "#F59E0B" : "#E5E5E5"}`,
                  boxShadow: emailFocus ? "0 0 0 3px rgba(245,158,11,0.15)" : "none",
                }}
              />
            </div>

            {/* Password, or the emailed code */}
            {otpMode ? (otpSent && (
              <div className="relative">
                <input
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required
                  className="w-full py-3 px-4 rounded-xl text-[16px] tracking-[0.4em] font-semibold text-[#1F1F1F] outline-none"
                  style={{ background: "#F7F7F7", border: "1.5px solid #E5E5E5" }}
                />
              </div>
            )) : (
            <div className="relative">
              <label
                className="absolute left-4 transition-all duration-200 pointer-events-none font-medium z-10"
                style={{
                  top: passFocus || password ? "8px" : "50%",
                  transform: passFocus || password ? "translateY(0) scale(0.8)" : "translateY(-50%)",
                  transformOrigin: "left",
                  color: passFocus ? "#B45309" : "#8A8A8A",
                  fontSize: passFocus || password ? "10px" : "14px",
                }}
              >
                Password
              </label>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setPassFocus(true)}
                onBlur={() => setPassFocus(false)}
                required
                className="w-full pt-5 pb-2 px-4 pr-12 rounded-xl text-[14px] font-medium text-[#1F1F1F] outline-none transition-all"
                style={{
                  background: passFocus ? "#FFFCF5" : "#F7F7F7",
                  border: `1.5px solid ${passFocus ? "#F59E0B" : "#E5E5E5"}`,
                  boxShadow: passFocus ? "0 0 0 3px rgba(245,158,11,0.15)" : "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D] transition-colors p-1 rounded-lg hover:bg-[#F7F7F7]"
              >
                {showPass ? <EyeSlash size={17} weight="duotone" /> : <Eye size={17} weight="duotone" />}
              </button>
            </div>
            )}

            {/* Forgot */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[12px] font-medium text-[#8A8A8A]">Stays signed in for 7 days</span>
              <button
                type="button"
                onClick={() => router.push("/forgot-password")}
                className="text-[13px] font-semibold transition-colors"
                style={{ color: "#B45309" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#92400E")}
                onMouseLeave={e => (e.currentTarget.style.color = "#B45309")}
              >
                Forgot password?
              </button>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-[14px] font-bold text-[#111111] transition-all flex items-center justify-center gap-2 mt-1"
              style={{
                background: loading ? "#FDE68A" : "#F59E0B",
                boxShadow: loading ? "none" : "0 4px 16px rgba(245,158,11,0.35)",
                transform: loading ? "scale(0.99)" : "scale(1)",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#F7B13C"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#F59E0B"; }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#111111" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#111111" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  {otpMode && !otpSent ? "Sending…" : "Signing in…"}
                </>
              ) : (
                <>
                  {otpMode && !otpSent ? "Email me a code" : "Sign in"}
                  <ArrowRight size={15} weight="bold" />
                </>
              )}
            </button>
          </form>

          {/* Create account */}
          <p className="text-center text-[13px] text-[#6B6B6B] mt-3 font-medium">
            Don&apos;t have an account?{" "}
            <button
              className="font-bold transition-colors"
              style={{ color: "#B45309" }}
              onClick={() => router.push("/register")}
              onMouseEnter={e => (e.currentTarget.style.color = "#92400E")}
              onMouseLeave={e => (e.currentTarget.style.color = "#B45309")}
            >
              Create your account
            </button>
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px" style={{ background: "#EEEEEE" }} />
            <span className="text-[12px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Or</span>
            <div className="flex-1 h-px" style={{ background: "#EEEEEE" }} />
          </div>

          {/* OTP */}
          <button
            type="button"
            onClick={() => { setOtpMode(m => !m); setOtpSent(false); setCode(""); setError(""); setNotice(""); }}
            className="w-full py-2.5 rounded-xl text-[13.5px] font-bold transition-all flex items-center justify-center gap-2 mb-3"
            style={{
              color: "#B45309",
              background: "#FFFBEB",
              border: "1.5px solid #FDE68A",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#FEF3C7"; e.currentTarget.style.borderColor = "#F59E0B"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#FFFBEB"; e.currentTarget.style.borderColor = "#FDE68A"; }}
          >
            <EnvelopeSimple size={15} weight="duotone" />
            {otpMode ? "Use password instead" : "Email me a sign-in code"}
          </button>

          {/* Social login */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px" style={{ background: "#EEEEEE" }} />
            <span className="text-[12px] font-semibold text-[#8A8A8A] uppercase tracking-wider whitespace-nowrap">Or, login with</span>
            <div className="flex-1 h-px" style={{ background: "#EEEEEE" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Google */}
            <button
              type="button"
              onClick={() => social("google")}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
              style={{ color: "#374151", background: "white", border: "1.5px solid #E5E5E5" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#FCD34D"; e.currentTarget.style.background = "#FFFCF5"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E5E5"; e.currentTarget.style.background = "white"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>

            {/* Microsoft */}
            <button
              type="button"
              onClick={() => social("microsoft-entra-id")}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
              style={{ color: "#374151", background: "white", border: "1.5px solid #E5E5E5" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#FCD34D"; e.currentTarget.style.background = "#FFFCF5"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E5E5"; e.currentTarget.style.background = "white"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
                <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
                <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
                <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
              </svg>
              Microsoft
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 border-t text-center" style={{ borderColor: "#EEEEEE", background: "#FAFAFA" }}>
          <p className="text-[11.5px] text-[#8A8A8A] font-medium">
            © 2026 Social DNA Labs · <span className="text-[#B45309] cursor-pointer hover:underline">Privacy</span> · <span className="text-[#B45309] cursor-pointer hover:underline">Terms</span>
          </p>
        </div>
      </div>
    </div>
  );
}
