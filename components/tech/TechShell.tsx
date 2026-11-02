"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { CaretLeft, SignOut } from "@phosphor-icons/react";
import Logo from "@/components/ui/Logo";
import SyncIndicator from "@/components/layout/SyncIndicator";

/** Phone-first frame for the technician screens: a slim top bar and a single column of content. */
export default function TechShell({ title, subtitle, back, right, children, footer }: {
  title: string; subtitle?: string; back?: string; right?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  const { data: session } = useSession();
  return (
    <div className="min-h-screen bg-[var(--bg-page,var(--bg-card))] flex flex-col">
      <header className="sticky top-0 z-30 bg-[var(--bg-card)] border-b border-[var(--border-soft)] px-4 h-14 flex items-center gap-3">
        {back ? <Link href={back} aria-label="Back" className="w-9 h-9 -ml-2 flex items-center justify-center rounded-lg text-[var(--text-primary)]"><CaretLeft size={22} weight="bold" /></Link> : <Logo style={{ height: "24px", width: "auto" }} />}
        <div className="flex-1 min-w-0">
          <h1 className="m-0 text-[17px] leading-5 font-bold text-[var(--text-primary)] truncate">{title}</h1>
          {subtitle && <p className="m-0 text-caption text-[var(--text-muted)] truncate">{subtitle}</p>}
        </div>
        <SyncIndicator />
        {right}
        <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} aria-label={`Sign out ${session?.user?.name ?? ""}`} title="Sign out"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)]"><SignOut size={20} /></button>
      </header>
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 flex flex-col gap-4 pb-28">{children}</main>
      {footer && <div className="fixed bottom-0 inset-x-0 z-30 bg-[var(--bg-card)] border-t border-[var(--border-soft)] px-4 py-3"><div className="max-w-xl mx-auto">{footer}</div></div>}
    </div>
  );
}
