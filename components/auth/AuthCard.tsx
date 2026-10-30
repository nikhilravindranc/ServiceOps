import type { ReactNode } from "react";

/** Shared frame for the small account pages (verify, reset, invite). Matches the login card. */
export default function AuthCard({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children?: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #FFFDF7 0%, #FFF7E6 50%, #FEF3C7 100%)" }}>
      <div className={`relative w-full ${wide ? "max-w-[720px]" : "max-w-[440px]"} rounded-3xl shadow-2xl overflow-hidden`}
        style={{ background: "rgba(255,255,255,0.94)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 25px 60px rgba(245,158,11,0.14), 0 8px 24px rgba(0,0,0,0.06)" }}>
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #D97706 0%, #F59E0B 50%, #FBBF24 100%)" }} />
        <div className="px-10 py-8">
          <div className="flex justify-center mb-5">
            <img src="/logo.png" alt="ServiceOps" style={{ height: 28, width: "auto" }} />
          </div>
          <h1 className="m-0 text-[22px] font-extrabold text-[#111111] tracking-tight">{title}</h1>
          {subtitle && <p className="text-[#8A8A8A] text-[13px] mt-1 mb-5 font-medium">{subtitle}</p>}
          <div className={subtitle ? "" : "mt-5"}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export const authInput = "w-full py-3 px-4 rounded-xl text-[14px] font-medium text-[#1F1F1F] outline-none border-[1.5px] border-[#E5E5E5] bg-[#F7F7F7] focus:border-[#F59E0B] focus:bg-[#FFFCF5]";
export const authButton = "w-full py-3 rounded-xl text-[14px] font-bold text-[#111111] bg-[#F59E0B] hover:bg-[#F7B13C] disabled:opacity-60 transition-colors";
