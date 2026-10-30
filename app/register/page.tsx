"use client";
import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeSlash, ArrowRight, CheckCircle } from "@phosphor-icons/react";

type Field = { value: string; focus: boolean };
const field = (): Field => ({ value: "", focus: false });

export default function RegisterPage() {
  const router = useRouter();

  const [fullName,  setFullName]  = useState(field());
  const [email,     setEmail]     = useState(field());
  const [password,  setPassword]  = useState(field());
  const [agree,     setAgree]     = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [verifyLink, setVerifyLink] = useState<string | undefined>();
  const [providers, setProviders] = useState<Record<string, unknown>>({});
  useEffect(() => { fetch("/api/auth/providers").then(r => r.json()).then(setProviders).catch(() => {}); }, []);
  const social = (id: "google" | "microsoft-entra-id") => {
    if (!providers[id]) { setError("This sign-up method is not set up on this server yet. Use email."); return; }
    signIn(id, { callbackUrl: "/" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.value.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!agree)                    { setError("Please accept the Terms and Privacy Policy to continue."); return; }
    setLoading(true);
    const res = await fetch("/api/account/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fullName.value, email: email.value, password: password.value }) });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Could not create the account. Try again."); return; }
    setVerifyLink(data.devLink);
    setSuccess(true);
  };

  // Floating label helpers
  const active = (f: Field) => f.focus || f.value.length > 0;
  const labelStyle = (f: Field, color = "#B45309"): React.CSSProperties => ({
    position: "absolute", left: 14, pointerEvents: "none", fontWeight: 500,
    top: active(f) ? 6 : "50%",
    transform: active(f) ? "translateY(0) scale(0.78)" : "translateY(-50%)",
    transformOrigin: "left",
    color: f.focus ? color : "#8A8A8A",
    fontSize: active(f) ? "10px" : "13.5px",
    transition: "all 0.18s ease",
    zIndex: 10,
  });
  const inputStyle = (f: Field): React.CSSProperties => ({
    width: "100%", paddingTop: 20, paddingBottom: 6, paddingLeft: 14, paddingRight: 14,
    borderRadius: 12, fontSize: 13.5, fontWeight: 500, color: "#1F1F1F", outline: "none",
    background: f.focus ? "#FFFCF5" : "#F7F7F7",
    border: `1.5px solid ${f.focus ? "#F59E0B" : "#E5E5E5"}`,
    boxShadow: f.focus ? "0 0 0 3px rgba(245,158,11,0.15)" : "none",
    transition: "all 0.18s ease",
  });

  if (success) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #FFFDF7 0%, #FFF7E6 50%, #FEF3C7 100%)" }}>
      <div className="flex flex-col items-center gap-3 bg-white rounded-3xl px-10 py-8 shadow-xl border border-[#EEEEEE]">
        <CheckCircle size={48} color="#10B981" weight="fill" />
        <p className="text-[17px] font-bold text-[#1F1F1F]">Check your email</p>
        <p className="text-[13px] text-[#8A8A8A] font-medium text-center max-w-[300px]">We sent a link to {email.value} to confirm your address. Then you can sign in.</p>
        {verifyLink && (<a href={verifyLink} className="text-[12.5px] font-bold text-[#B45309] underline text-center max-w-[300px]">Email is not configured on this server. Open the verification link here.</a>)}
        <button onClick={() => router.push("/login")} className="text-[13px] font-bold text-[#B45309]">Go to sign in</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-6"
      style={{ background: "linear-gradient(135deg, #FFFDF7 0%, #FFF7E6 50%, #FEF3C7 100%)" }}>
      {/* Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #FDE68A 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #FCD34D 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-[460px] rounded-3xl shadow-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.93)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "0 25px 60px rgba(245,158,11,0.14), 0 8px 24px rgba(0,0,0,0.06)",
        }}>
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #D97706 0%, #F59E0B 50%, #FBBF24 100%)" }} />

        <div className="px-10 pt-7 pb-6">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <img src="/logo.png" alt="ServiceOps" style={{ height: "28px", width: "auto" }} />
          </div>

          {/* Heading */}
          <div className="mb-5">
            <h1 className="m-0 text-[22px] font-extrabold text-[#111111] tracking-tight leading-tight">Create your account</h1>
            <p className="text-[#8A8A8A] text-[13px] mt-0.5 font-medium">Schedule, dispatch and invoice field work in one place</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-red-700 flex items-center gap-2"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              {error}
            </div>
          )}

          {/* Social sign-up */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button type="button" onClick={() => social("google")}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
              style={{ color: "#374151", background: "white", border: "1.5px solid #E5E5E5" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#FCD34D"; e.currentTarget.style.background = "#FFFCF5"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E5E5"; e.currentTarget.style.background = "white"; }}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button type="button" onClick={() => social("microsoft-entra-id")}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
              style={{ color: "#374151", background: "white", border: "1.5px solid #E5E5E5" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#FCD34D"; e.currentTarget.style.background = "#FFFCF5"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E5E5"; e.currentTarget.style.background = "white"; }}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
                <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
                <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
                <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
              </svg>
              Microsoft
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: "#EEEEEE" }} />
            <span className="text-[12px] font-semibold text-[#8A8A8A] uppercase tracking-wider whitespace-nowrap">Or with email</span>
            <div className="flex-1 h-px" style={{ background: "#EEEEEE" }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <label style={labelStyle(fullName)}>Full name</label>
              <input required autoComplete="name" value={fullName.value} style={inputStyle(fullName)}
                onChange={e => setFullName(p => ({ ...p, value: e.target.value }))}
                onFocus={() => setFullName(p => ({ ...p, focus: true }))}
                onBlur={() => setFullName(p => ({ ...p, focus: false }))} />
            </div>

            <div className="relative">
              <label style={labelStyle(email)}>Work email</label>
              <input required type="email" autoComplete="email" value={email.value} style={inputStyle(email)}
                onChange={e => setEmail(p => ({ ...p, value: e.target.value }))}
                onFocus={() => setEmail(p => ({ ...p, focus: true }))}
                onBlur={() => setEmail(p => ({ ...p, focus: false }))} />
            </div>

            <div className="relative">
              <label style={labelStyle(password)}>Password (8+ characters)</label>
              <input required type={showPass ? "text" : "password"} autoComplete="new-password" value={password.value}
                style={{ ...inputStyle(password), paddingRight: 40 }}
                onChange={e => setPassword(p => ({ ...p, value: e.target.value }))}
                onFocus={() => setPassword(p => ({ ...p, focus: true }))}
                onBlur={() => setPassword(p => ({ ...p, focus: false }))} />
              <button type="button" onClick={() => setShowPass(p => !p)} aria-label={showPass ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D] transition-colors">
                {showPass ? <EyeSlash size={16} weight="duotone" /> : <Eye size={16} weight="duotone" />}
              </button>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#F59E0B]" />
              <span className="text-[12.5px] font-medium text-[#6B6B6B] leading-snug">
                I agree to the <span className="text-[#B45309] hover:underline">Terms</span> and <span className="text-[#B45309] hover:underline">Privacy Policy</span>
              </span>
            </label>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-[14px] font-bold text-[#111111] flex items-center justify-center gap-2 mt-1 transition-all"
              style={{
                background: loading ? "#FDE68A" : "#F59E0B",
                boxShadow: loading ? "none" : "0 4px 16px rgba(245,158,11,0.3)",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#F7B13C"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#F59E0B"; }}>
              {loading ? (
                <>
                  <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#111111" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#111111" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Creating account…
                </>
              ) : (
                <>Create account <ArrowRight size={14} weight="bold" /></>
              )}
            </button>
          </form>

          <p className="text-center text-[12.5px] text-[#6B6B6B] mt-4 font-medium">
            Already have an account?{" "}
            <button onClick={() => router.push("/login")}
              className="font-bold transition-colors"
              style={{ color: "#B45309" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#92400E")}
              onMouseLeave={e => (e.currentTarget.style.color = "#B45309")}>
              Sign in
            </button>
          </p>
        </div>

        <div className="px-10 py-3 border-t text-center" style={{ borderColor: "#EEEEEE", background: "#FAFAFA" }}>
          <p className="text-[11px] text-[#8A8A8A] font-medium">
            © 2026 Social DNA Labs ·{" "}
            <span className="text-[#B45309] cursor-pointer hover:underline">Privacy</span> ·{" "}
            <span className="text-[#B45309] cursor-pointer hover:underline">Terms</span>
          </p>
        </div>
      </div>
    </div>
  );
}
