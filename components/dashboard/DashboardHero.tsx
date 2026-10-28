"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarBlank, Sun, MapPin, Plus, Truck, UserPlus, FileText, ChartBar,
  ClipboardText, UserGear, CalendarCheck, UsersThree, CaretRight,
} from "@phosphor-icons/react";
import { CARD_SHADOW, IconTile, Tone } from "./DashboardSection";

const HERO_IMAGE =
  "https://plus.unsplash.com/premium_photo-1667511116296-365dfbb3aadc?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const kpis: { label: string; value: number; meta: string; href: string; tone: Tone; Icon: typeof ClipboardText }[] = [
  { label: "Work orders",        value: 61, meta: "43 yet to start",              href: "/work-orders",     tone: "amber",  Icon: ClipboardText },
  { label: "Technicians active", value: 18, meta: "15 on field · 3 unavailable",  href: "/dispatch", tone: "blue",   Icon: UserGear },
  { label: "Service visits",     value: 31, meta: "24 scheduled · 7 upcoming",    href: "/jobs",     tone: "green",  Icon: CalendarCheck },
  { label: "Customers",          value: 56, meta: "5 new this month",             href: "/customers", tone: "purple", Icon: UsersThree },
];

const quickActions = [
  { label: "New work order",   href: "/work-orders",     Icon: Plus,     primary: true },
  { label: "Dispatch console", href: "/dispatch",     Icon: Truck },
  { label: "Add customer",     href: "/customers", Icon: UserPlus },
  { label: "Create estimate",  href: "/billing",    Icon: FileText },
  { label: "View reports",     href: "/reports",  Icon: ChartBar },
];

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface DashboardHeroProps {
  userName: string;
  /** Optional control rendered beside the date (e.g. the dashboard switcher). */
  dateAside?: ReactNode;
}

/* Full-bleed hero: the photo fades into the dashboard background (`--dash-bg`,
   set by the page) so the KPI cards and quick actions float over its lower edge. */
export default function DashboardHero({ userName, dateAside }: DashboardHeroProps) {
  // Date + greeting are computed on the client so SSR output never mismatches the viewer's clock.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const dateLabel = now
    ? now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : " ";
  const greeting = now ? greetingFor(now.getHours()) : "Welcome";

  return (
    <section className="relative overflow-hidden">
      {/* Background photo — faded into the page on the left and at the bottom */}
      <div className="absolute inset-x-0 top-0 h-[300px] sm:h-[340px] lg:h-[380px]" aria-hidden>
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover object-[65%_35%]" />
        <div
          className="absolute inset-0 hidden md:block"
          style={{ background: "linear-gradient(90deg, var(--dash-bg) 0%, color-mix(in srgb, var(--dash-bg) 88%, transparent) 25%, color-mix(in srgb, var(--dash-bg) 35%, transparent) 50%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 md:hidden"
          style={{ background: "color-mix(in srgb, var(--dash-bg) 75%, transparent)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: "linear-gradient(180deg, transparent 0%, var(--dash-bg) 100%)" }}
        />
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label uppercase text-[var(--text-primary)]">
              <span className="inline-flex items-center gap-2">
                <CalendarBlank size={18} weight="regular" />
                {dateLabel}
              </span>
              <span className="normal-case">{dateAside}</span>
            </div>
            <h1 className="m-0 mt-3 text-display sm:text-[36px] sm:leading-[44px] lg:text-[40px] lg:leading-[48px] font-bold tracking-tight text-[var(--text-primary)]">
              {greeting}, {userName}.
            </h1>
            <p className="m-0 mt-1 text-body sm:text-[18px] sm:leading-[26px] text-[var(--text-body)]">
              Your field teams are in action today.
            </p>
          </div>

          {/* Weather */}
          <div
            className="hidden sm:flex items-center gap-4 rounded-2xl pl-4 pr-8 py-4 flex-shrink-0 backdrop-blur-md border border-white/50"
            style={{ background: "color-mix(in srgb, var(--bg-card) 88%, transparent)", boxShadow: CARD_SHADOW }}
          >
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-full" style={{ backgroundColor: "var(--serviceops-primary-10)" }}>
              <Sun size={36} weight="fill" color="#F59E0B" />
            </span>
            <div>
              <p className="m-0 text-[24px] leading-[30px] font-bold text-[var(--text-primary)]">28°C</p>
              <p className="m-0 text-card-content text-[var(--text-body)]">Sunny</p>
              <p className="m-0 mt-0.5 inline-flex items-center gap-1 text-card-content text-[var(--text-body)]">
                <MapPin size={13} weight="regular" /> New York, NY
              </p>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-6 sm:mt-10 grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map(({ label, value, meta, href, tone, Icon }) => (
            <Link
              key={label}
              href={href}
              className="group flex items-center gap-3 sm:gap-4 rounded-2xl border border-[var(--border-soft)] px-4 sm:px-5 py-4 backdrop-blur-md transition-transform hover:-translate-y-0.5"
              style={{ background: "color-mix(in srgb, var(--bg-card) 94%, transparent)", boxShadow: CARD_SHADOW }}
            >
              <IconTile tone={tone} size={56} round><Icon size={26} weight="fill" /></IconTile>
              <div className="flex-1 min-w-0">
                <p className="m-0 text-label font-normal text-[var(--text-primary)] truncate">{label}</p>
                <p className="m-0 text-display font-bold text-[var(--text-primary)]">{value}</p>
                <p className="m-0 text-card-content text-[var(--text-body)] truncate">{meta}</p>
              </div>
              <CaretRight size={16} className="flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <nav
          aria-label="Quick actions"
          className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 rounded-2xl p-2 sm:p-3 backdrop-blur-md border border-[var(--border-soft)]"
          style={{ background: "color-mix(in srgb, var(--bg-card) 80%, transparent)", boxShadow: CARD_SHADOW }}
        >
          {quickActions.map(({ label, href, Icon, primary }, i) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center justify-center gap-2 sm:gap-2.5 rounded-full px-2 sm:px-3 py-2.5 sm:py-3 text-caption sm:text-button font-semibold transition-colors ${
                i === quickActions.length - 1 ? "col-span-2 md:col-span-1" : ""
              } ${
                primary
                  ? "bg-[var(--serviceops-primary)] text-[#111111] hover:bg-[var(--serviceops-hover)] shadow-[0_4px_14px_rgba(245,158,11,0.35)]"
                  : "bg-[color-mix(in_srgb,var(--serviceops-tint)_70%,var(--bg-card))] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--serviceops-primary)] hover:text-[var(--serviceops-primary)]"
              }`}
            >
              <Icon size={18} weight={primary ? "bold" : "fill"} className="flex-shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
