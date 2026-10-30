"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ALL_JOBS } from "@/lib/jobsData";
import {
  JOBS_TODAY_TS, DAY_MS, WORK_ORDERS, ESTIMATES, jobsOnDay, dispatchAlerts, woStatus, estimateTotal, allInvoices, outstanding,
  billingStateForJob, jobCharges, techAvailability, TECH_PROFILES, money,
} from "@/lib/serviceData";
import { dueVisits } from "@/lib/recurring";

export type Level = "red" | "amber" | "blue";
export type Item = { level: Level; title: string; detail: string; href: string; cta: string };
const RANK: Record<Level, number> = { red: 0, amber: 1, blue: 2 };

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

/** Everything the Home page shows, computed from live data. Used by both the classic and the compact layout. */
export function useHomeData() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const sees = { money: ["Administrator", "Service manager"].includes(role), office: role !== "Technician" };

  const [newRequests, setNewRequests] = useState(0);
  const [org, setOrg] = useState<{ goal: number; banner: string | null; image: string | null }>({ goal: 0, banner: null, image: null });
  useEffect(() => {
    fetch("/api/org").then(r => (r.ok ? r.json() : null)).then(o => setOrg({ goal: o?.revenueGoal ?? 0, banner: o?.homeBanner ?? "photo", image: o?.homeBannerImage ?? null })).catch(() => setOrg(v => ({ ...v, banner: "photo" })));
    if (sees.office) fetch("/api/requests?status=New").then(r => (r.ok ? r.json() : [])).then((x: unknown[]) => setNewRequests(x.length)).catch(() => {});
  }, [sees.office]);

  const d = useMemo(() => {
    const invoices = allInvoices();
    const overdue = invoices.filter(i => i.status === "Overdue");
    const overdueSum = overdue.reduce((s, i) => s + outstanding(i), 0);
    const waiting = ESTIMATES.filter(e => e.status === "Sent");
    const waitingSum = waiting.reduce((s, e) => s + estimateTotal(e), 0);
    const staleDays = (e: (typeof waiting)[number]) => Math.floor(((e.sentAt ? Date.now() : JOBS_TODAY_TS) - (e.sentAt ?? e.issuedOn)) / DAY_MS);
    const stale = waiting.filter(e => staleDays(e) >= 3);
    const ready = ALL_JOBS.filter(j => billingStateForJob(j.id) === "Ready to invoice");
    const readySum = ready.reduce((s, j) => s + jobCharges(j).total, 0);
    const toSchedule = WORK_ORDERS.filter(w => woStatus(w) === "Ready to schedule").length;
    const fresh = WORK_ORDERS.filter(w => woStatus(w) === "New").length;
    const maintenance = dueVisits(30).filter(v => !v.existing).length;
    const alerts = dispatchAlerts(JOBS_TODAY_TS, 4);
    const open = WORK_ORDERS.filter(w => !["Completed", "Cancelled"].includes(woStatus(w))).length;
    const collected = invoices.reduce((s, i) => s + i.paid, 0);
    const techsFree = TECH_PROFILES.filter(t => ["Available", "On job"].includes(techAvailability(t.name, JOBS_TODAY_TS))).length;

    const items: Item[] = [];
    if (sees.office) {
      alerts.slice(0, 4).forEach(a => items.push({ level: a.tone, title: `${a.job.jobId} · ${a.job.customer}`, detail: a.reason, href: `/jobs/${a.job.id}`, cta: "Open job" }));
      if (alerts.length > 4) items.push({ level: "amber", title: `${alerts.length - 4} more jobs need attention`, detail: "See them all in Dispatch", href: "/dispatch", cta: "Dispatch" });
      if (toSchedule) items.push({ level: "amber", title: `${plural(toSchedule, "work order")} ready to schedule`, detail: "Approved and waiting for a technician and a time", href: "/dispatch", cta: "Schedule" });
      if (fresh) items.push({ level: "blue", title: `${plural(fresh, "new work order")} to review`, detail: "Check the details, then approve or request an estimate", href: "/work-orders", cta: "Review" });
      if (newRequests) items.push({ level: "blue", title: plural(newRequests, "new request"), detail: "Customer asks that have not been looked at yet", href: "/requests", cta: "Open requests" });
      if (maintenance) items.push({ level: "blue", title: `${plural(maintenance, "maintenance visit")} due in 30 days`, detail: "From Gold and Silver plans, not yet raised as work orders", href: "/plans", cta: "Raise" });
    }
    if (sees.money) {
      if (overdue.length) items.push({ level: "red", title: `${plural(overdue.length, "invoice")} overdue`, detail: `${money(overdueSum)} outstanding`, href: "/billing", cta: "Billing" });
      if (stale.length) items.push({ level: "amber", title: `${plural(stale.length, "estimate")} waiting 3 days or more`, detail: `${money(stale.reduce((s, e) => s + estimateTotal(e), 0))} not yet approved`, href: "/billing", cta: "Follow up" });
      if (ready.length) items.push({ level: "blue", title: `${plural(ready.length, "completed job")} ready to invoice`, detail: `${money(readySum)} not yet billed`, href: "/billing", cta: "Invoice" });
    }
    items.sort((a, b) => RANK[a.level] - RANK[b.level]);

    const today = jobsOnDay(JOBS_TODAY_TS).filter(j => j.status !== "Cancelled").sort((a, b) => a.scheduledAt - b.scheduledAt);
    const inField = today.filter(j => ["En route", "On site"].includes(j.status)).length;
    const activity = WORK_ORDERS.flatMap(w => [
      { at: w.requestedAt, label: `${w.customer} asked for: ${w.title}`, id: w.id },
      ...w.activity.map(a => ({ at: a.at, label: a.label, id: w.id })),
    ]).filter(e => e.at <= JOBS_TODAY_TS + DAY_MS).sort((a, b) => b.at - a.at).slice(0, 6);

    // Value of work booked for the next seven days, for the compact Home chart.
    const week = Array.from({ length: 7 }, (_, i) => {
      const t = JOBS_TODAY_TS + i * DAY_MS;
      const jobs = ALL_JOBS.filter(j => !["Completed", "Cancelled"].includes(j.status) && Math.floor((j.scheduledAt - JOBS_TODAY_TS) / DAY_MS) === i);
      return { day: new Date(t).toLocaleDateString("en-US", { weekday: "short" }), value: Math.round(jobs.reduce((s, j) => s + jobCharges(j).total, 0)), jobs: jobs.length };
    });
    return { items, today, inField, activity, open, toSchedule, waitingSum, waiting: waiting.length, overdueSum, overdue: overdue.length, collected, techsFree, week };
  }, [sees.office, sees.money, newRequests]);

  const mine = role === "Technician" ? d.today.filter(j => j.technician === session?.user?.name) : d.today;
  const visits = role === "Technician" && mine.length === 0 ? d.today : mine;
  return { session, role, firstName, sees, org, newRequests, d, visits };
}
