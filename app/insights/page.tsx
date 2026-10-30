"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Lightbulb } from "@phosphor-icons/react";
import { PageShell, PageHeader } from "@/components/ui/ServiceOpsUI";
import { CARD_SHADOW } from "@/components/dashboard/DashboardSection";
import { ALL_JOBS } from "@/lib/jobsData";
import {
  allInvoices, outstanding, ESTIMATES, estimateTotal, WORK_ORDERS, jobCharges, workOrderForJob, billingStateForJob,
  JOBS_TODAY_TS, DAY_MS, fmtDay, money,
} from "@/lib/serviceData";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function Card({ title, tip, children, wide = false }: { title: string; tip?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 sm:p-5 flex flex-col gap-3 min-w-0 ${wide ? "lg:col-span-2" : ""}`} style={{ boxShadow: CARD_SHADOW }}>
      <h2 className="m-0 text-h2 font-bold text-[var(--text-primary)]">{title}</h2>
      <div className="flex-1">{children}</div>
      {tip && <p className="m-0 flex items-start gap-2 text-caption text-[var(--text-body)] rounded-lg bg-[var(--serviceops-tint)] px-3 py-2"><Lightbulb size={14} weight="fill" className="mt-0.5 flex-shrink-0 text-amber-500" />{tip}</p>}
    </section>
  );
}

function Bars({ rows, format = money }: { rows: { label: string; value: number; note?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-2">
      {rows.map(r => (
        <li key={r.label} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
          <span className="truncate text-[var(--text-body)]">{r.label}</span>
          <span className="h-2.5 rounded-full bg-[var(--serviceops-tint)] overflow-hidden"><span className="block h-full rounded-full bg-[var(--serviceops-primary)]" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">{format(r.value)}{r.note && <span className="ml-1.5 font-normal text-[var(--text-muted)]">{r.note}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

export default function InsightsPage() {
  const [requests, setRequests] = useState<number | null>(null);
  const [costs, setCosts] = useState<{ jobId: number; cost: number }[] | null>(null);
  const [goal, setGoal] = useState(0);
  const [reviews, setReviews] = useState<{ count: number; average: number | null; referrals: number; recent: { id: string; customer: string; rating: number; comment: string | null }[] } | null>(null);
  const saveGoal = (v: number) => { fetch("/api/org", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revenueGoal: v }) }).catch(() => {}); };

  useEffect(() => {
    fetch("/api/requests").then(r => (r.ok ? r.json() : [])).then((x: unknown[]) => setRequests(x.length)).catch(() => setRequests(0));
    fetch("/api/job-costs/summary").then(r => (r.ok ? r.json() : null)).then(setCosts).catch(() => setCosts(null));
    fetch("/api/org").then(r => (r.ok ? r.json() : null)).then(o => { if (o) setGoal(o.revenueGoal ?? 0); }).catch(() => {});
    fetch("/api/reviews").then(r => (r.ok ? r.json() : null)).then(setReviews).catch(() => {});
  }, []);

  const d = useMemo(() => {
    const invoices = allInvoices();
    const collected = sum(invoices.map(i => i.paid));
    const open = invoices.filter(i => i.status !== "Paid");

    // Revenue by where the work came from, using completed jobs linked to a work order.
    const bySource = new Map<string, number>();
    for (const j of ALL_JOBS) {
      if (j.status !== "Completed") continue;
      const src = workOrderForJob(j.id)?.source ?? "No work order";
      bySource.set(src, (bySource.get(src) ?? 0) + jobCharges(j).total);
    }

    // Cash still to collect, by how late it is.
    const buckets = [["Overdue", -Infinity, 0], ["Due in 7 days", 0, 7], ["Due in 8 to 14", 7, 14], ["Due in 15 to 30", 14, 30], ["Later", 30, Infinity]] as const;
    const cash = buckets.map(([label, lo, hi]) => ({
      label, value: sum(open.filter(i => { const days = (i.dueOn - JOBS_TODAY_TS) / DAY_MS; return days > lo && days <= hi || (lo === -Infinity && days <= 0); }).map(outstanding)),
    }));

    const decided = ESTIMATES.filter(e => e.status === "Approved" || e.status === "Declined");
    const approved = ESTIMATES.filter(e => e.status === "Approved");
    const sentOrBeyond = ESTIMATES.filter(e => e.status !== "Draft");
    const completed = ALL_JOBS.filter(j => j.status === "Completed");
    const funnel = [
      { label: "Requests", value: requests ?? 0 }, { label: "Work orders", value: WORK_ORDERS.length }, { label: "Estimates sent", value: sentOrBeyond.length },
      { label: "Approved", value: approved.length }, { label: "Jobs completed", value: completed.length },
      { label: "Invoiced", value: completed.filter(j => ["Invoiced", "Paid"].includes(billingStateForJob(j.id))).length },
    ];

    const forecast = Array.from({ length: 7 }, (_, i) => {
      const day = JOBS_TODAY_TS + i * DAY_MS;
      const jobs = ALL_JOBS.filter(j => !["Completed", "Cancelled"].includes(j.status) && Math.floor((j.scheduledAt - JOBS_TODAY_TS) / DAY_MS) === i);
      return { label: fmtDay(day), value: sum(jobs.map(j => jobCharges(j).total)), note: `${jobs.length} job${jobs.length === 1 ? "" : "s"}` };
    });

    return {
      billed: sum(invoices.map(i => i.amount)), collected, outstanding: sum(open.map(outstanding)),
      sources: [...bySource].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      cash, funnel, forecast,
      winRate: decided.length ? Math.round((approved.length / decided.length) * 100) : null,
      wonValue: sum(approved.map(estimateTotal)), openQuotes: sum(ESTIMATES.filter(e => e.status === "Sent").map(estimateTotal)),
    };
  }, [requests]);

  const profit = useMemo(() => {
    if (!costs) return null;
    return costs.flatMap(c => {
      const job = ALL_JOBS.find(j => j.id === c.jobId);
      if (!job) return [];
      const ch = jobCharges(job);
      const revenue = ch.labor + ch.partsTotal - ch.discount;
      return [{ job, revenue, cost: c.cost, profit: revenue - c.cost, margin: revenue > 0 ? Math.round(((revenue - c.cost) / revenue) * 100) : 0 }];
    }).sort((a, b) => a.margin - b.margin);
  }, [costs]);

  const pctGoal = goal > 0 ? Math.min(100, Math.round((d.collected / goal) * 100)) : 0;
  const topSource = d.sources[0];
  const worst = d.cash[0];

  return (
    <PageShell>
      <PageHeader title="Insights" subtitle="What is earning, what is stuck and what is coming." crumbs={[{ label: "Business" }, { label: "Insights" }]} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Revenue goal" tip={goal > 0 ? `${pctGoal}% of the goal is collected. ${money(d.outstanding)} is still outstanding.` : "Set a goal to see how far collected revenue has come."}>
          <div className="flex flex-wrap items-end gap-6 mb-3">
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Billed</p><p className="m-0 text-h1 font-bold">{money(d.billed)}</p></div>
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Collected</p><p className="m-0 text-h1 font-bold">{money(d.collected)}</p></div>
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Outstanding</p><p className="m-0 text-h1 font-bold">{money(d.outstanding)}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-2 text-[13px]">
            <label htmlFor="goal">Goal</label>
            <input id="goal" type="number" min={0} className="h-9 w-[150px] px-3 rounded-[10px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)]" value={goal || ""} placeholder="e.g. 500000"
              onChange={e => setGoal(Number(e.target.value) || 0)} onBlur={e => saveGoal(Number(e.target.value) || 0)} />
            <span className="text-[var(--text-muted)]">saved for the company</span>
          </div>
          {goal > 0 && <div className="h-2.5 rounded-full bg-[var(--serviceops-tint)] overflow-hidden" role="progressbar" aria-valuenow={pctGoal} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-emerald-500" style={{ width: `${pctGoal}%` }} /></div>}
        </Card>

        <Card title="Revenue by lead source" tip={topSource ? `${topSource.label} brings in the most completed work (${money(topSource.value)}). Put follow-up effort there first.` : "Complete jobs from work orders to see which channels earn."}>
          {d.sources.length ? <Bars rows={d.sources} /> : <p className="m-0 text-body text-[var(--text-muted)]">No completed jobs yet.</p>}
        </Card>

        <Card title="Lead funnel" tip="Counts at each step. Estimates only apply to work orders that need approval, so a smaller number there is normal.">
          <Bars rows={d.funnel} format={n => String(n)} />
        </Card>

        <Card title="Quote conversion" tip={d.winRate === null ? "No estimate has been approved or declined yet." : d.winRate < 50 ? "Fewer than half of decided quotes are won. Try good, better, best options and a deposit." : "Most decided quotes are won. Keep follow-ups turned on to protect that."}>
          <div className="flex flex-wrap gap-8">
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Win rate</p><p className="m-0 text-h1 font-bold">{d.winRate === null ? "n/a" : `${d.winRate}%`}</p></div>
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Won</p><p className="m-0 text-h1 font-bold">{money(d.wonValue)}</p></div>
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Waiting on customers</p><p className="m-0 text-h1 font-bold">{money(d.openQuotes)}</p></div>
          </div>
        </Card>

        <Card title="Cash to collect" tip={worst.value > 0 ? `${money(worst.value)} is overdue. Send payment links from Billing.` : "Nothing is overdue."}>
          <Bars rows={d.cash} />
        </Card>

        <Card title="Job forecast, next 7 days" tip="Value of scheduled work by day. Gaps are days to fill; peaks are days to add a technician.">
          <Bars rows={d.forecast} />
        </Card>

        <Card title="Reviews and referrals" tip={reviews?.count ? "Ask for a review from a completed job (Job menu, Request a review)." : "Request a review from a completed job to start collecting feedback."}>
          <div className="flex flex-wrap gap-8 mb-3">
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Average rating</p><p className="m-0 text-h1 font-bold">{reviews?.average ? reviews.average.toFixed(1) : "n/a"}</p></div>
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Reviews</p><p className="m-0 text-h1 font-bold">{reviews?.count ?? 0}</p></div>
            <div><p className="m-0 text-caption text-[var(--text-muted)]">Referral requests</p><p className="m-0 text-h1 font-bold">{reviews?.referrals ?? 0}</p></div>
          </div>
          <ul className="m-0 p-0 list-none text-[13px]">{(reviews?.recent ?? []).map(r => <li key={r.id} className="py-1.5 border-t border-[var(--border-soft)]"><b>{"★".repeat(r.rating)}</b> {r.customer}{r.comment ? `: ${r.comment}` : ""}</li>)}</ul>
        </Card>

        <Card wide title="Profit per job" tip={profit?.length ? "Lowest margins first. Check pricing or parts cost on the jobs at the top." : "Book costs on a job's Costing tab to see its margin here."}>
          {costs === null ? <p className="m-0 text-body text-[var(--text-muted)]">Visible to administrators and service managers.</p>
            : profit && profit.length ? (
              <table className="w-full text-[13px]"><thead><tr className="text-left text-[var(--text-muted)]"><th className="py-1.5 font-semibold">Job</th><th className="py-1.5 text-right font-semibold">Revenue</th><th className="py-1.5 text-right font-semibold">Cost</th><th className="py-1.5 text-right font-semibold">Profit</th><th className="py-1.5 text-right font-semibold">Margin</th></tr></thead>
                <tbody>{profit.slice(0, 8).map(p => <tr key={p.job.id} className="border-t border-[var(--border-soft)]"><td className="py-1.5">{p.job.jobId} · {p.job.jobName}</td><td className="py-1.5 text-right">{money(p.revenue)}</td><td className="py-1.5 text-right">{money(p.cost)}</td><td className="py-1.5 text-right">{money(p.profit)}</td><td className="py-1.5 text-right font-semibold">{p.margin}%</td></tr>)}</tbody></table>
            ) : <p className="m-0 text-body text-[var(--text-muted)]">No job has costs booked yet.</p>}
        </Card>
      </div>
    </PageShell>
  );
}
