"use client";
import { ReactNode } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";

/* ─────────── Shared palette for the ServiceOps overview dashboard ───────────
   One hue per meaning, reused by every section (stat tiles, charts, pills) so
   a colour always says the same thing. `tint` is a translucent wash of the
   hue so it reads on both the light and dark card surface. */
export const TONES = {
  amber:  { fg: "#F59E0B", tint: "rgba(245, 158, 11, 0.12)" },
  yellow: { fg: "#FBBF24", tint: "rgba(251, 191, 36, 0.14)" },
  blue:   { fg: "#3B82F6", tint: "rgba(59, 130, 246, 0.10)" },
  indigo: { fg: "#4F46E5", tint: "rgba(79, 70, 229, 0.10)" },
  sky:    { fg: "#60A5FA", tint: "rgba(96, 165, 250, 0.12)" },
  red:    { fg: "#EF4444", tint: "rgba(239, 68, 68, 0.10)" },
  coral:  { fg: "#F87171", tint: "rgba(248, 113, 113, 0.12)" },
  green:  { fg: "#22C55E", tint: "rgba(34, 197, 94, 0.12)" },
  purple: { fg: "#8B5CF6", tint: "rgba(139, 92, 246, 0.10)" },
  gray:   { fg: "#9CA3AF", tint: "rgba(156, 163, 175, 0.16)" },
} as const;

export type Tone = keyof typeof TONES;

/** Card surface shared by every dashboard card (hero KPIs included). */
export const CARD_SHADOW = "0 1px 2px rgba(17, 17, 17, 0.04), 0 8px 24px rgba(17, 17, 17, 0.05)";


/** Bare "›" link for cards whose whole header navigates somewhere. */
export function ChevronLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex items-center justify-center w-7 h-7 -mr-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--serviceops-tint)] transition-colors"
    >
      <CaretRight size={14} weight="bold" />
    </Link>
  );
}

/** Rounded square icon chip — `solid` fills with the hue, otherwise a tint. */
export function IconTile({ tone, solid = false, size = 40, round = false, children }: { tone: Tone; solid?: boolean; size?: number; round?: boolean; children: ReactNode }) {
  const { fg, tint } = TONES[tone];
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 ${round ? "rounded-full" : "rounded-xl"}`}
      style={{ width: size, height: size, backgroundColor: solid ? fg : tint, color: solid ? "#FFFFFF" : fg }}
    >
      {children}
    </span>
  );
}

/** Stat with a thin coloured bar on its left — used by Job statistics and Quotations. */
export function BarStat({ value, label, tone }: { value: ReactNode; label: string; tone: Tone }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="w-[3px] h-[22px] mt-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: TONES[tone].fg }} />
      <div className="min-w-0">
        <p className="m-0 text-h1 font-bold text-[var(--text-primary)]">{value}</p>
        <p className="m-0 text-card-metadata text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}

interface DashboardSectionProps {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Card shell for each dashboard widget: title on the left, actions on the right. */
export default function DashboardSection({ title, headerRight, children, className = "" }: DashboardSectionProps) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 sm:p-5 min-w-0 ${className}`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      <header className="flex items-center justify-between gap-3 mb-4">
        <h2 className="m-0 text-card-title font-bold text-[var(--text-primary)] truncate">{title}</h2>
        {headerRight && <div className="flex items-center gap-3 flex-shrink-0">{headerRight}</div>}
      </header>
      {children}
    </section>
  );
}
