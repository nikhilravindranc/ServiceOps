"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, CaretDown, CheckCircle, CalendarCheck, ClipboardText, FileText, WarningCircle, Tray, CurrencyDollar, ClockCounterClockwise, BellRinging,
} from "@phosphor-icons/react";
import { PageShell, KpiRow, KpiTile } from "@/components/ui/ServiceOpsUI";
import { JobStatusPill } from "@/components/workorders/woShared";
import { CARD_SHADOW, TONES, type Tone } from "@/components/dashboard/DashboardSection";
import FirstSteps from "@/components/dashboard/FirstSteps";
import HomeBanner from "@/components/dashboard/HomeBanner";
import { useHomeData, plural, greeting, type Level } from "@/components/dashboard/useHomeData";
import { JOBS_TODAY_TS, workOrderById, fmtTime, fmtDay, money } from "@/lib/serviceData";

const PREVIEW = 5;
const DOT: Record<Level, string> = { red: "#DC2626", amber: "#D97706", blue: "#2563EB" };

/** The button under a shortened list. Either expands the list in place or goes to the full page. */
function MoreButton({ label, onClick, href, expanded }: { label: string; onClick?: () => void; href?: string; expanded?: boolean }) {
  const cls = "mt-1 w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-[var(--border)] text-[13.5px] font-semibold text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--serviceops-tint)] no-underline";
  return href
    ? <Link href={href} className={cls}>{label}<ArrowRight size={14} weight="bold" /></Link>
    : <button type="button" onClick={onClick} aria-expanded={expanded} className={cls}>{label}<CaretDown size={14} weight="bold" className={expanded ? "rotate-180" : ""} /></button>;
}


/** A white card with a small icon, a title and an optional link on the right. */
function Card({ title, icon: Icon, tone = "gray", aside, children }: { title: string; icon: typeof BellRinging; tone?: Tone; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 sm:p-5 min-w-0" style={{ boxShadow: CARD_SHADOW }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="m-0 flex items-center gap-2.5 text-[15px] font-bold text-[var(--text-primary)]">
          <span className="w-7 h-7 rounded-lg inline-flex items-center justify-center flex-shrink-0" style={{ background: TONES[tone].tint }}><Icon size={16} weight="fill" color={TONES[tone].fg} /></span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function HomeClassic() {
  const router = useRouter();
  const { role, firstName, sees, org, newRequests, d, visits } = useHomeData();
  const [showAllItems, setShowAllItems] = useState(false);

  const pct = org.goal > 0 ? Math.min(100, Math.round((d.collected / org.goal) * 100)) : 0;
  const summary = [plural(visits.length, "visit") + " today", sees.office && d.items.length ? `${d.items.length} need${d.items.length === 1 ? "s" : ""} attention` : ""].filter(Boolean).join(" · ");

  return (
    <PageShell wide>
      <HomeBanner banner={org.banner} image={org.image} canEdit={role === "Administrator"}>
        <p className="m-0 text-[12.5px] font-semibold uppercase tracking-wide opacity-80">{new Date(JOBS_TODAY_TS).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
        <h1 className="m-0 mt-1 text-[28px] leading-[34px] sm:text-[32px] sm:leading-[40px] font-bold tracking-tight">{greeting()}{firstName ? `, ${firstName}` : ""}</h1>
        <p className="m-0 mt-1 text-body opacity-90">{summary}</p>
      </HomeBanner>

      {role === "Administrator" && <FirstSteps />}

      <KpiRow cols={sees.money ? "xl:grid-cols-4" : "xl:grid-cols-3"}>
        <KpiTile label={role === "Technician" ? "Your visits today" : "Visits today"} value={visits.length} meta={d.inField ? `${d.inField} in the field` : "None started yet"} tone="green" icon={CalendarCheck} onClick={() => router.push(sees.office ? "/dispatch" : "/jobs")} />
        {sees.office && <KpiTile label="Open work orders" value={d.open} meta={`${d.toSchedule} ready to schedule`} tone="blue" icon={ClipboardText} onClick={() => router.push("/work-orders")} />}
        {sees.office && !sees.money && <KpiTile label="New requests" value={newRequests} meta="Not yet looked at" tone="amber" icon={Tray} onClick={() => router.push("/requests")} />}
        {sees.money && <KpiTile label="Quotes waiting" value={money(d.waitingSum)} meta={plural(d.waiting, "estimate")} tone="purple" icon={FileText} onClick={() => router.push("/billing")} />}
        {sees.money && <KpiTile label="Overdue invoices" value={money(d.overdueSum)} meta={plural(d.overdue, "invoice")} tone="red" icon={WarningCircle} onClick={() => router.push("/billing")} />}
      </KpiRow>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          {sees.office && (
            <Card title="Needs attention" icon={BellRinging} tone="amber" aside={d.items.length ? <span className="text-caption text-[var(--text-muted)]">{d.items.length}</span> : undefined}>
              {d.items.length === 0 ? (
                <p className="flex items-center gap-2 m-0 py-4 text-body text-[var(--text-body)]"><CheckCircle size={18} weight="fill" color="#16A34A" />Nothing needs you right now.</p>
              ) : (
                <ul className="m-0 p-0 list-none">
                  {(showAllItems ? d.items : d.items.slice(0, PREVIEW)).map((it, i) => (
                    <li key={i} className="border-t border-[var(--border-soft)] first:border-t-0">
                      <Link href={it.href} className="flex items-center gap-3 py-3 group no-underline">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DOT[it.level] }} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-body font-semibold text-[var(--text-primary)] truncate">{it.title}</span>
                          <span className="block text-caption text-[var(--text-muted)] truncate">{it.detail}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 group-hover:underline whitespace-nowrap">{it.cta}<ArrowRight size={13} weight="bold" /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {d.items.length > PREVIEW && (
                <MoreButton expanded={showAllItems} onClick={() => setShowAllItems(v => !v)} label={showAllItems ? "Show fewer" : `View all ${d.items.length} items`} />
              )}
            </Card>
          )}

          <Card title={role === "Technician" ? "Your visits today" : "Today's visits"} icon={CalendarCheck} tone="green"
            aside={sees.office ? <Link href="/dispatch" className="text-[13px] font-semibold text-blue-600 hover:underline">Open Dispatch</Link> : undefined}>
            {visits.length === 0 ? <p className="m-0 py-4 text-body text-[var(--text-muted)]">No visits booked today.</p> : (
              <ul className="m-0 p-0 list-none">
                {visits.slice(0, PREVIEW).map(j => (
                  <li key={j.id} className="border-t border-[var(--border-soft)] first:border-t-0">
                    <Link href={`/jobs/${j.id}`} className="grid grid-cols-[76px_minmax(0,1fr)_auto] sm:grid-cols-[76px_minmax(0,1fr)_160px_auto] items-center gap-3 py-2.5 no-underline">
                      <span className="text-body font-semibold text-[var(--text-primary)] tabular-nums">{j.scheduledTime}</span>
                      <span className="min-w-0"><span className="block text-body text-[var(--text-primary)] truncate">{j.customer}</span><span className="block text-caption text-[var(--text-muted)] truncate">{j.jobName}</span></span>
                      <span className="hidden sm:block text-body text-[var(--text-body)] truncate">{j.technician}</span>
                      <JobStatusPill status={j.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {visits.length > PREVIEW && (
              <MoreButton href={sees.office ? "/dispatch" : "/jobs"} label={sees.office ? `View all ${visits.length} visits in Dispatch` : `View all ${visits.length} of your jobs`} />
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-5 min-w-0">
          {sees.money && (
            <Card title="Money collected" icon={CurrencyDollar} tone="green">
              <p className="m-0 text-[26px] leading-[32px] font-bold text-[var(--text-primary)] tabular-nums">{money(d.collected)}</p>
              {org.goal > 0 ? (
                <>
                  <div className="mt-3 h-2 rounded-full bg-[var(--serviceops-tint)] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to revenue goal"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                  <p className="m-0 mt-1.5 text-caption text-[var(--text-muted)]">{pct}% of the {money(org.goal)} goal</p>
                </>
              ) : <p className="m-0 mt-1 text-caption text-[var(--text-muted)]"><Link href="/insights" className="text-blue-600 hover:underline">Set a revenue goal</Link> to track progress.</p>}
            </Card>
          )}

          {sees.office && (
            <Card title="Recent activity" icon={ClockCounterClockwise} tone="blue">
              {d.activity.length === 0 ? <p className="m-0 py-3 text-body text-[var(--text-muted)]">Nothing yet.</p> : (
                <ul className="m-0 p-0 list-none">
                  {d.activity.map((a, i) => (
                    <li key={i} className="border-t border-[var(--border-soft)] first:border-t-0">
                      <Link href={`/work-orders/${a.id}`} className="block py-2.5 no-underline">
                        <span className="block text-body text-[var(--text-primary)] line-clamp-2">{a.label}</span>
                        <span className="block text-caption text-[var(--text-muted)]">{workOrderById(a.id)?.number} · {fmtDay(a.at)}, {fmtTime(a.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
