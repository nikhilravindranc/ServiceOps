"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import { ClipboardText, FileText, MagnifyingGlass, XCircle, ArrowsClockwise, Tray, User, Wrench, ListChecks, LinkSimple, ClockCounterClockwise, CheckCircle, Circle } from "@phosphor-icons/react";
import {
  PageShell, Breadcrumb, DetailCard, Field, Pill, PriorityTag, RecordLink, SecondaryButton, DetailPrimaryButton, ActionMenu, Timeline, useToast, EmptyState, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import { chainForRequest, workOrderFromRequest, type Req } from "@/lib/requestFlow";
import { customerByName, customerHref, fmtDate, fmtTime, woStatus } from "@/lib/serviceData";
import { detailPairs, parseDetails, WORK_TYPE_INFO } from "@/lib/workTypes";

type Detail = Req & { createdBy: string | null; timeline: { action: string; at: string; by: string | null; meta: Record<string, unknown> | null }[] };
const STATUS_TONE: Record<Req["status"], PillTone> = { New: "purple", Reviewing: "amber", Converted: "green", Declined: "gray" };

/** One line in the linked-records chain: a record that exists (with a link) or a step that has not happened yet. */
function ChainRow({ label, number, href, status, tone, done }: { label: string; number?: string; href?: string; status?: string; tone?: PillTone; done: boolean }) {
  const Icon = done ? CheckCircle : Circle;
  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-[var(--border-soft)] last:border-b-0">
      <Icon size={20} weight={done ? "fill" : "regular"} className={done ? "text-green-600" : "text-[var(--text-muted)]"} />
      <span className="w-24 flex-shrink-0 text-body text-[var(--text-muted)]">{label}</span>
      <span className="flex-1 min-w-0 text-body">
        {done && number ? (href ? <Link href={href} className="font-semibold text-blue-600 hover:underline">{number}</Link> : <span className="font-semibold text-[var(--text-primary)]">{number}</span>) : <span className="text-[var(--text-muted)]">Not created yet</span>}
      </span>
      {done && status && <Pill tone={tone ?? "gray"}>{status}</Pill>}
    </li>
  );
}

export default function RequestDetail({ number }: { number: string }) {
  const router = useRouter();
  const { toastNode, notify } = useToast();
  const [req, setReq] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/requests/${encodeURIComponent(number)}`);
    if (res.status === 404) { setMissing(true); return; }
    if (res.ok) setReq(await res.json());
  }, [number]);
  useEffect(() => { load(); }, [load]);

  const chain = useMemo(() => (req ? chainForRequest(req) : null), [req, req?.convertedTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body: object) => {
    const res = await fetch(`/api/requests/${req!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { notify((await res.json().catch(() => ({}))).error ?? "Could not update the request", undefined, "info"); return false; }
    await load(); setTick(t => t + 1);
    return true;
  };

  const convert = async (needsEstimate: boolean) => {
    const wo = workOrderFromRequest(req!, needsEstimate);
    if (await patch({ status: "Converted", convertedTo: `work-order:${wo.id}` })) {
      notify(`${req!.number} converted to ${wo.number}${needsEstimate ? ". An estimate is needed before scheduling." : ""}`, `/work-orders/${wo.id}`);
    }
  };

  if (missing) return <PageShell><Breadcrumb homeIcon items={[{ label: "Requests", href: "/requests" }, { label: number }]} /><EmptyState icon={Tray} text="This request does not exist, or it belongs to another company." action={<Button variant="outlined" onClick={() => router.push("/requests")}>Back to requests</Button>} /></PageShell>;
  if (!req || !chain) return <PageShell><div className="py-16 text-center text-body text-[var(--text-muted)]" role="status">Loading request…</div></PageShell>;

  const cust = customerByName(req.customerName);
  const pairs = detailPairs(req.workType, parseDetails(req.details));
  const { workOrder: wo, estimate, jobs, invoices } = chain;
  const open = req.status === "New" || req.status === "Reviewing";
  const received = new Date(req.createdAt);
  const events = [
    { label: `Request logged${req.createdBy ? ` by ${req.createdBy}` : ""} via ${req.source}`, at: `${fmtDate(received)}, ${fmtTime(received)}` },
    ...req.timeline.filter(t => t.action === "request.update").map(t => {
      const m = t.meta ?? {};
      const what = m.status ? `Status changed from ${String(m.from ?? "—")} to ${String(m.status)}${m.declineReason ? ` (${String(m.declineReason)})` : ""}` : "Request updated";
      const d = new Date(t.at);
      return { label: `${what}${t.by ? ` by ${t.by}` : ""}`, at: `${fmtDate(d)}, ${fmtTime(d)}` };
    }),
  ];

  return (
    <PageShell>
      <Breadcrumb homeIcon items={[{ label: "Requests", href: "/requests" }, { label: req.number }]} />

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-h1 sm:text-[22px] font-bold text-[var(--text-primary)]">{req.title}</h1>
          <Pill tone={STATUS_TONE[req.status]}>{req.status}</Pill>
          <PriorityTag priority={req.priority} />
          <Pill tone="blue" dot={false}>{req.workType}</Pill>
        </div>
        <p className="m-0 text-body text-[var(--text-body)]">
          {req.number} · {cust ? <RecordLink href={customerHref(cust.name)}>{req.customerName}</RecordLink> : req.customerName} · Received {fmtDate(received)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {open && <DetailPrimaryButton icon={ClipboardText} onClick={() => convert(false)}>Convert to work order</DetailPrimaryButton>}
        {open && <SecondaryButton icon={FileText} onClick={() => convert(true)}>Convert and request estimate</SecondaryButton>}
        {req.status === "Converted" && wo && <DetailPrimaryButton icon={ClipboardText} href={`/work-orders/${wo.id}`}>Open {wo.number}</DetailPrimaryButton>}
        {(req.status === "Converted" || req.status === "Declined") && <SecondaryButton icon={ArrowsClockwise} onClick={() => patch({ status: "New" })}>Reopen</SecondaryButton>}
        {open && (
          <ActionMenu variant="page" actions={[
            ...(req.status === "New" ? [{ label: "Mark as reviewing", icon: MagnifyingGlass, onClick: () => patch({ status: "Reviewing" }) }] : []),
            { label: "Decline request", icon: XCircle, danger: true, divider: true, onClick: () => { setReason(""); setDeclineOpen(true); } },
          ]} />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <DetailCard icon={Tray} title="Request">
            <dl className="m-0 grid grid-cols-[minmax(110px,160px)_minmax(0,1fr)] gap-x-4 gap-y-3">
              <Field label="Summary">{req.title}</Field>
              <Field label="Work type">{req.workType}</Field>
              <Field label="Trade">{req.serviceType}</Field>
              <Field label="Priority">{req.priority}</Field>
              <Field label="Received via">{req.source}{req.campaign ? ` · ${req.campaign}` : ""}</Field>
              <Field label="Preferred date">{req.preferredDate ? fmtDate(new Date(`${req.preferredDate}T09:00`)) : "No preference"}</Field>
              <Field label="Notes">{req.description || "None"}</Field>
            </dl>
          </DetailCard>

          <DetailCard icon={ListChecks} title={`${req.workType} details`}>
            {pairs.length ? (
              <dl className="m-0 grid grid-cols-[minmax(110px,200px)_minmax(0,1fr)] gap-x-4 gap-y-3">{pairs.map(([k, v]) => <Field key={k} label={k}>{v}</Field>)}</dl>
            ) : <p className="m-0 text-body text-[var(--text-muted)]">{WORK_TYPE_INFO[req.workType].blurb} No extra details were captured on this request.</p>}
          </DetailCard>

          <DetailCard icon={User} title="Customer and site">
            <dl className="m-0 grid grid-cols-[minmax(110px,160px)_minmax(0,1fr)] gap-x-4 gap-y-3">
              <Field label="Customer">{cust ? <RecordLink href={customerHref(cust.name)}>{req.customerName}</RecordLink> : <>{req.customerName} <span className="text-[var(--text-muted)]">(not in Customers yet)</span></>}</Field>
              <Field label="Contact">{req.contactName || "Not given"}</Field>
              <Field label="Phone">{req.phone ? <a className="text-blue-600 hover:underline" href={`tel:${req.phone}`}>{req.phone}</a> : "Not given"}</Field>
              <Field label="Email">{req.email ? <a className="text-blue-600 hover:underline" href={`mailto:${req.email}`}>{req.email}</a> : "Not given"}</Field>
              <Field label="Site">{req.site || "Not given"}</Field>
            </dl>
          </DetailCard>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <DetailCard icon={LinkSimple} title="Linked records">
            <ul className="m-0 p-0 list-none">
              <ChainRow label="Request" number={req.number} done status={req.status} tone={STATUS_TONE[req.status]} />
              <ChainRow label="Estimate" done={!!estimate} number={estimate?.number} href={wo ? `/work-orders/${wo.id}` : undefined} status={estimate?.status} tone={estimate?.status === "Approved" ? "green" : estimate?.status === "Declined" ? "red" : "amber"} />
              <ChainRow label="Work order" done={!!wo} number={wo?.number} href={wo ? `/work-orders/${wo.id}` : undefined} status={wo ? woStatus(wo) : undefined} tone="blue" />
              {jobs.length ? jobs.map(j => <ChainRow key={j.id} label="Job" done number={j.jobId} href={`/jobs/${j.id}`} status={j.status} tone="blue" />) : <ChainRow label="Job" done={false} />}
              {invoices.length ? invoices.map(i => <ChainRow key={i.number} label="Invoice" done number={i.number} href={i.jobId ? `/jobs/${i.jobId}` : "/billing"} status={i.status} tone={i.status === "Paid" ? "green" : i.status === "Overdue" ? "red" : "amber"} />) : <ChainRow label="Invoice" done={false} />}
            </ul>
            {req.status === "Declined" && <p className="m-0 mt-3 text-caption text-[var(--text-muted)]">This request was declined, so nothing follows it.</p>}
            {open && <p className="m-0 mt-3 text-caption text-[var(--text-muted)]">Convert the request to start the chain: work order, estimate, job and invoice all keep this request number as their reference.</p>}
          </DetailCard>

          <DetailCard icon={ClockCounterClockwise} title="Activity"><Timeline items={events} /></DetailCard>
          {open && <p className="m-0 flex items-center gap-2 text-caption text-[var(--text-muted)]"><Wrench size={14} />Estimates and jobs are created from the work order.</p>}
        </div>
      </div>

      <Dialog open={declineOpen} onClose={() => setDeclineOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Decline {req.number}?</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Reason (required)" value={reason} onChange={e => setReason(e.target.value)} size="small" fullWidth multiline rows={3} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeclineOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={reason.trim().length < 3}
            onClick={async () => { if (await patch({ status: "Declined", declineReason: reason.trim() })) { setDeclineOpen(false); notify(`${req.number} declined`); } }}>Decline request</Button>
        </DialogActions>
      </Dialog>
      {toastNode}
    </PageShell>
  );
}
