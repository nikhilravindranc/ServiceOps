"use client";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import {
  Receipt, CurrencyDollar, WarningCircle, CheckCircle, FileText, PlugsConnected, PaperPlaneTilt, Money, Wrench, Info,
} from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, SecondaryButton, KpiTile, KpiRow, ListCard, SearchBox, FilterSelect, DataTable, Stack, Pill,
  ActionMenu, useToast, DetailTabs, Segmented, IdLink, RecordLink, type Column, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import { INVOICE_TONE, ESTIMATE_TONE } from "@/components/workorders/woShared";
import { matchesQuery } from "@/lib/filtering";
import { ALL_JOBS, getWorkspace, type JobRecord } from "@/lib/jobsData";
import {
  allInvoices, outstanding, invoiceSummary, raiseInvoice, saveInvoiceLedger, customerBillingProblems, creditNoteReadiness, billingStateForJob, jobCharges, workOrderForJob, ESTIMATES, estimateTotal,
  workOrderById, setEstimateStatus, customerHref, customerByName, fmtDate, fmtDay, money, JOBS_TODAY_TS, DAY_MS,
  invoiceReadiness, type Invoice, type BillingState, type InvoiceStatus,
} from "@/lib/serviceData";
import InvoiceBlockedDialog, { type InvoiceProblem } from "@/components/billing/InvoiceBlockedDialog";
import InvoiceDrawer from "@/components/billing/InvoiceDrawer";
import { PaymentDialog, CreditNoteDialog, VoidDialog, ReissueDialog } from "@/components/billing/InvoiceDialogs";
import CreditNoteSheet, { type CreditNotePrint } from "@/components/billing/CreditNoteSheet";
import { canManageMoney, usd } from "@/lib/ledger";

type Tab = "jobs" | "invoices" | "estimates";
type JobScope = "ready" | "accruing" | "billed";
const BILLING_TONE: Record<BillingState, PillTone> = { "Ready to invoice": "amber", "Not billable yet": "gray", Invoiced: "blue", Paid: "green", Voided: "gray", "Not billable": "gray" };
const INV_STATUS = ["All invoices", "Sent", "Partially paid", "Overdue", "Paid", "Void"];

export default function BillingPage() {
  const router = useRouter();
  const { toastNode, notify } = useToast();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const by = session?.user?.name ?? "Office";
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);
  const [tab, setTab] = useState<Tab>("jobs");
  const [scope, setScope] = useState<JobScope>("ready");
  const [search, setSearch] = useState("");
  const [invF, setInvF] = useState(INV_STATUS[0]);

  const jobs = useMemo(() => ALL_JOBS
    .map(j => ({ j, state: billingStateForJob(j.id), charges: jobCharges(j), wo: workOrderForJob(j.id) }))
    .filter(r => r.state !== "Not billable"), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const invoices = useMemo(() => allInvoices(), [version]);

  const ready = jobs.filter(r => r.state === "Ready to invoice");
  const accruing = jobs.filter(r => r.state === "Not billable yet" && ["On site", "En route", "Incomplete"].includes(r.j.status));
  const billed = jobs.filter(r => r.state === "Invoiced" || r.state === "Paid");
  // One helper for every screen: Outstanding and Overdue are balances; void invoices are left out.
  const totals = useMemo(() => invoiceSummary(invoices), [invoices]);
  const open = totals.open;
  const paidInvoices = invoices.filter(i => i.status === "Paid");
  const pendingEst = ESTIMATES.filter(e => e.status === "Sent");

  const [blocked, setBlocked] = useState<{ title: string; problems: InvoiceProblem[] } | null>(null);
  // Invoice detail and the money dialogs. They hold an invoice number and look the invoice up again, so they are never stale.
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "pay" | "credit" | "void" | "reissue"; number: string } | null>(null);
  const [creditPrint, setCreditPrint] = useState<CreditNotePrint | null>(null);
  const find = (number: string | null | undefined) => (number ? invoices.find(i => i.number === number) : undefined);
  const dialogInv = find(dialog?.number);
  const done = (msg: string) => { setDialog(null); refresh(); notify(msg); };
  const openCredit = (i: Invoice) => {
    const problems = creditNoteReadiness(i);
    if (problems.length) { setBlocked({ title: `A credit note for ${i.number} cannot be issued`, problems }); return; }
    setDialog({ kind: "credit", number: i.number });
  };
  const printCredit = (i: Invoice, creditNumber: string) => {
    setCreditPrint({ invoice: i, creditNumber });
    window.setTimeout(() => window.print(), 80);
  };
  const sendPayLink = async (i: Invoice) => {
    const email = customerByName(i.customer)?.email ?? "";
    // Nothing goes to a customer without a valid address and a real amount.
    const job = i.jobId ? ALL_JOBS.find(j => j.id === i.jobId) : undefined;
    const problems: InvoiceProblem[] = job ? invoiceReadiness(job, i.stage?.index).problems : customerBillingProblems(i.customer);
    if (!(i.amount > 0)) problems.push({ text: "The invoice amount is zero." });
    if (i.status === "Void") problems.push({ text: "This invoice is void." });
    if (i.balance <= 0 && i.status !== "Void") problems.push({ text: "This invoice has nothing left to pay." });
    if (problems.length) { setBlocked({ title: `${i.number} cannot be sent`, problems }); return; }
    // The pay page reads the amount from the saved invoice ledger, never from this browser: save it first.
    saveInvoiceLedger(i);
    const res = await fetch("/api/public-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "invoice", ref: i.number, customer: i.customer, title: `Invoice ${i.number}`, email, taxPct: 0, lines: [] }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { notify("Could not create the payment link", undefined, "info"); return; }
    if (data.emailed) { notify(`Payment link emailed to ${email}`); return; }
    navigator.clipboard?.writeText(data.url).catch(() => {});
    notify("Link created and copied. Email is not configured here, so share it by hand.", undefined, "info");
  };
  /** Raises the single invoice, or the next stage when the job is progress-billed. */
  const raise = (j: JobRecord) => raiseInvoice(j);
  const readiness = (j: JobRecord) => {
    const stages = getWorkspace(j.id).stages;
    return invoiceReadiness(j, stages?.length ? stages.findIndex(s => !s.invoice) : undefined);
  };
  const invoiceJob = (j: JobRecord) => {
    const r = readiness(j);
    if (!r.ok) { setBlocked({ title: `${j.jobId} is not ready to invoice`, problems: r.problems }); return; }
    const inv = raise(j);
    refresh(); notify(`${inv.number} raised for ${j.customer}`, `/jobs/${j.id}`);
  };
  const invoiceAllReady = () => {
    if (!ready.length) return;
    const ok = ready.filter(r => readiness(r.j).ok);
    const skipped = ready.filter(r => !readiness(r.j).ok);
    ok.forEach(r => raise(r.j));
    refresh();
    if (ok.length) { setTab("invoices"); notify(`${ok.length} invoice${ok.length === 1 ? "" : "s"} raised${skipped.length ? `, ${skipped.length} held back` : ""}`); }
    if (skipped.length) setBlocked({ title: `${skipped.length} job${skipped.length === 1 ? "" : "s"} held back`, problems: skipped.flatMap(r => readiness(r.j).problems.map(p => ({ ...p, text: `${r.j.jobId}: ${p.text}` }))) });
  };

  type JRow = typeof jobs[number];
  const jobRows = scope === "ready" ? ready : scope === "accruing" ? accruing : billed;
  const jobCols: Column<JRow>[] = [
    { key: "job", header: "Job #", cell: r => <IdLink href={`/jobs/${r.j.id}`}>{r.j.jobId}</IdLink>, sortValue: r => r.j.jobId },
    { key: "work", header: "Work done", cell: r => <Stack top={r.j.jobName} bottom={r.wo ? r.wo.number : undefined} /> },
    { key: "customer", header: "Customer", cell: r => <RecordLink href={customerHref(r.j.customer)} className="text-table-cell text-[var(--text-primary)] whitespace-nowrap">{r.j.customer}</RecordLink>, sortValue: r => r.j.customer },
    { key: "date", header: scope === "accruing" ? "Visit" : "Completed", cell: r => <Stack top={fmtDay(r.j.scheduledAt)} bottom={r.j.technician} />, sortValue: r => r.j.scheduledAt },
    {
      key: "charges", header: "Charges",
      cell: r => (
        <Tooltip title={`Labour ${money(r.charges.labor)} · Parts ${money(r.charges.partsTotal)} · Tax ${money(r.charges.tax)}${r.charges.discount ? ` · Discount −${money(r.charges.discount)}` : ""}`}>
          <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap underline decoration-dotted underline-offset-4">Labour + {r.charges.parts.length} parts</span>
        </Tooltip>
      ),
    },
    { key: "amount", header: "Amount", align: "right", cell: r => <span className="text-table-cell font-semibold text-[var(--text-primary)]">{money(r.charges.total)}</span>, sortValue: r => r.charges.total },
    { key: "state", header: "Billing", cell: r => <Pill tone={BILLING_TONE[r.state]}>{r.state === "Not billable yet" ? `Accruing · ${r.j.status}` : r.state}</Pill> },
    {
      key: "action", header: "", align: "right",
      cell: r => r.state === "Ready to invoice"
        ? <Button size="small" variant="contained" onClick={e => { e.stopPropagation(); invoiceJob(r.j); }}>Invoice</Button>
        : r.state === "Invoiced" ? <span className="text-caption text-[var(--text-muted)]">{getWorkspace(r.j.id).invoice?.number}</span> : null,
    },
  ];

  const invRows = invoices.filter(i => (invF === INV_STATUS[0] || i.status === invF) && matchesQuery(search, i.number, i.customer, i.jobRef, i.woNumber));
  const invCols: Column<Invoice>[] = [
    { key: "no", header: "Invoice #", cell: i => <span className="text-table-cell font-semibold text-[var(--text-primary)] whitespace-nowrap">{i.number}</span>, sortValue: i => i.number },
    { key: "customer", header: "Customer", cell: i => <RecordLink href={customerHref(i.customer)} className="text-table-cell text-[var(--text-primary)] whitespace-nowrap">{i.customer}</RecordLink>, sortValue: i => i.customer },
    { key: "job", header: "Job", cell: i => i.jobId ? <IdLink href={`/jobs/${i.jobId}`}>{i.jobRef}</IdLink> : <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap">{i.jobRef}</span> },
    { key: "issued", header: "Issued", cell: i => <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(i.issuedOn)}</span>, sortValue: i => i.issuedOn },
    {
      key: "due", header: "Due", sortValue: i => i.dueOn,
      cell: i => <span className={`text-table-cell whitespace-nowrap ${i.status === "Overdue" ? "text-[#EF4444] font-medium" : "text-[var(--text-body)]"}`}>{fmtDate(i.dueOn)}{i.status === "Overdue" && ` · ${Math.round((JOBS_TODAY_TS - i.dueOn) / DAY_MS)}d late`}</span>,
    },
    { key: "amount", header: "Amount", align: "right", cell: i => <span className="text-table-cell text-[var(--text-primary)]">{money(i.amount)}</span>, sortValue: i => i.amount },
    { key: "paid", header: "Paid", align: "right", cell: i => <span className="text-table-cell text-[var(--text-body)]">{i.paid ? usd(i.paid) : "—"}</span>, sortValue: i => i.paid },
    { key: "out", header: "Balance", align: "right", cell: i => <span className="text-table-cell font-semibold text-[var(--text-primary)]">{outstanding(i) ? usd(outstanding(i)) : "—"}</span>, sortValue: i => outstanding(i) },
    { key: "status", header: "Status", cell: i => <Pill tone={INVOICE_TONE[i.status]}>{i.status}</Pill>, sortValue: i => (["Overdue", "Partially paid", "Sent", "Draft", "Paid", "Void"] as InvoiceStatus[]).indexOf(i.status) },
    {
      key: "actions", header: "Actions", align: "right",
      cell: i => (
        <ActionMenu label={`Actions for ${i.number}`} actions={[
          ...(i.jobId ? [{ label: "Open job", icon: Wrench, onClick: () => router.push(`/jobs/${i.jobId}`) }] : []),
          { label: "View details", icon: Info, onClick: () => setSelected(i.number) },
          { label: "Record payment", icon: Money, disabled: i.status === "Void" || i.balance <= 0, onClick: () => setDialog({ kind: "pay", number: i.number }) },
          { label: "Send payment link", icon: PaperPlaneTilt, disabled: i.status === "Void" || i.balance <= 0, onClick: () => sendPayLink(i) },
          { label: "Credit note", icon: FileText, disabled: i.status === "Void" || i.balance <= 0, onClick: () => openCredit(i) },
          i.status === "Void"
            ? { label: i.reissuedAs ? `Reissued as ${i.reissuedAs}` : "Reissue invoice", icon: Receipt, disabled: !canManageMoney(role) || !!i.reissuedAs, onClick: () => setDialog({ kind: "reissue", number: i.number }), divider: true }
            : { label: "Void invoice", icon: WarningCircle, danger: true, divider: true, disabled: !canManageMoney(role) || i.status === "Draft", onClick: () => setDialog({ kind: "void", number: i.number }) },
        ]} />
      ),
    },
  ];

  const estRows = ESTIMATES.filter(e => matchesQuery(search, e.number, e.customer, workOrderById(e.woId)?.number)).sort((a, b) => b.issuedOn - a.issuedOn);
  type ERow = typeof estRows[number];
  const estCols: Column<ERow>[] = [
    { key: "no", header: "Estimate #", cell: e => <span className="text-table-cell font-semibold text-[var(--text-primary)] whitespace-nowrap">{e.number}</span> },
    { key: "wo", header: "Work order", cell: e => { const w = workOrderById(e.woId); return w ? <Stack top={<IdLink href={`/work-orders/${w.id}?tab=estimate`}>{w.number}</IdLink>} bottom={w.title} /> : "—"; } },
    { key: "customer", header: "Customer", cell: e => <span className="text-table-cell text-[var(--text-primary)] whitespace-nowrap">{e.customer}</span>, sortValue: e => e.customer },
    { key: "issued", header: "Issued", cell: e => <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(e.issuedOn)}</span>, sortValue: e => e.issuedOn },
    { key: "valid", header: "Valid until", cell: e => <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(e.validUntil)}</span> },
    { key: "amount", header: "Amount", align: "right", cell: e => <span className="text-table-cell font-semibold text-[var(--text-primary)]">{money(estimateTotal(e))}</span>, sortValue: e => estimateTotal(e) },
    { key: "status", header: "Status", cell: e => <Pill tone={ESTIMATE_TONE[e.status]}>{e.status}</Pill> },
    {
      key: "act", header: "", align: "right",
      cell: e => e.status === "Sent" ? (
        <Button size="small" variant="outlined" onClick={ev => { ev.stopPropagation(); setEstimateStatus(e, "Approved"); refresh(); notify(`${e.number} approved — work order ready to schedule`); }}>Mark approved</Button>
      ) : e.status === "Draft" ? (
        <Button size="small" variant="outlined" onClick={ev => { ev.stopPropagation(); setEstimateStatus(e, "Sent"); refresh(); notify(`${e.number} sent to ${e.customer}`); }}>Send</Button>
      ) : null,
    },
  ];

  return (
    <PageShell>
      <PageHeader title="Billing" subtitle="Service charges from completed job to collected payment."
        actions={
          <>
            <SecondaryButton icon={PlugsConnected} href="/integrations" className="hidden md:inline-flex">EVOQ Billing</SecondaryButton>
            <PrimaryButton icon={Receipt} onClick={invoiceAllReady}>{ready.length ? `Invoice ${ready.length} ready job${ready.length === 1 ? "" : "s"}` : "Nothing to invoice"}</PrimaryButton>
          </>
        } />

      <KpiRow cols="xl:grid-cols-6">
        <KpiTile label="Ready to invoice" value={money(ready.reduce((s, r) => s + r.charges.total, 0))} meta={`${ready.length} completed job${ready.length === 1 ? "" : "s"}`} tone="amber" icon={Receipt} active={tab === "jobs" && scope === "ready"} onClick={() => { setTab("jobs"); setScope("ready"); }} />
        <KpiTile label="Work in progress" value={money(accruing.reduce((s, r) => s + r.charges.total, 0))} meta={`${accruing.length} jobs accruing`} tone="blue" icon={Wrench} active={tab === "jobs" && scope === "accruing"} onClick={() => { setTab("jobs"); setScope("accruing"); }} />
        <KpiTile label="Outstanding" value={money(totals.outstanding)} meta={`${totals.openCount} open invoices`} tone="purple" icon={CurrencyDollar} active={tab === "invoices" && invF === INV_STATUS[0]} onClick={() => { setTab("invoices"); setInvF(INV_STATUS[0]); }} />
        <KpiTile label="Overdue" value={money(totals.overdue)} meta={`${totals.overdueCount} invoices`} tone="red" icon={WarningCircle} active={tab === "invoices" && invF === "Overdue"} onClick={() => { setTab("invoices"); setInvF("Overdue"); }} />
        <KpiTile label="Collected" value={money(totals.collected)} meta={`${paidInvoices.length} paid in full`} tone="green" icon={CheckCircle} active={tab === "invoices" && invF === "Paid"} onClick={() => { setTab("invoices"); setInvF("Paid"); }} />
        <KpiTile label="Estimates out" value={money(pendingEst.reduce((s, e) => s + estimateTotal(e), 0))} meta={`${pendingEst.length} awaiting approval`} tone="gray" icon={FileText} active={tab === "estimates"} onClick={() => setTab("estimates")} />
      </KpiRow>

      <ListCard>
        <DetailTabs label="Billing views" active={tab} onChange={t => { setTab(t); setSearch(""); }} tabs={[
          { key: "jobs", label: "Billable jobs", count: ready.length },
          { key: "invoices", label: "Invoices", count: totals.openCount },
          { key: "estimates", label: "Estimates", count: pendingEst.length },
        ]} />

        {tab === "jobs" && (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Segmented value={scope} onChange={setScope} options={[
                { value: "ready", label: "Ready to invoice", count: ready.length },
                { value: "accruing", label: "In progress", count: accruing.length },
                { value: "billed", label: "Invoiced & paid", count: billed.length },
              ]} />
              <p className="m-0 inline-flex items-center gap-1.5 text-caption text-[var(--text-muted)]"><Info size={14} />Charges come from each job&apos;s labour and parts — same totals as Job Details.</p>
            </div>
            <DataTable columns={jobCols} rows={jobRows} rowKey={r => r.j.id} onRowClick={r => router.push(`/jobs/${r.j.id}`)} pageSize={10} noun="jobs" minWidth={1000}
              empty={{ icon: CheckCircle, title: scope === "ready" ? "No completed jobs waiting to be invoiced" : "Nothing here", hint: scope === "ready" ? "Completed jobs appear here until an invoice is raised" : undefined }}
              mobileCard={r => (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="m-0 text-caption font-semibold text-blue-600">{r.j.jobId}</p><p className="m-0 text-label text-[var(--text-primary)]">{r.j.customer}</p><p className="m-0 text-caption text-[var(--text-muted)]">{r.j.jobName} · {fmtDay(r.j.scheduledAt)}</p></div>
                    <p className="m-0 text-label font-bold text-[var(--text-primary)]">{money(r.charges.total)}</p>
                  </div>
                  <div className="flex items-center justify-between"><Pill tone={BILLING_TONE[r.state]}>{r.state}</Pill>{r.state === "Ready to invoice" && <Button size="small" variant="contained" onClick={e => { e.stopPropagation(); invoiceJob(r.j); }}>Invoice</Button>}</div>
                </div>
              )} />
          </>
        )}

        {tab === "invoices" && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder="Search invoice, customer, job…" className="w-full sm:w-auto sm:flex-1 lg:flex-none lg:w-[300px]" />
              <FilterSelect value={invF} options={INV_STATUS} onChange={setInvF} className="flex-1 sm:flex-none min-w-[150px] sm:w-[170px]" />
            </div>
            <DataTable columns={invCols} rows={invRows} rowKey={i => i.number} onRowClick={i => setSelected(i.number)} pageSize={10} noun="invoices" minWidth={1140}
              defaultSort={{ key: "issued", dir: "desc" }}
              empty={{ icon: Receipt, title: "No invoices match", hint: "Try a different status or search" }}
              mobileCard={i => (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="m-0 text-label text-[var(--text-primary)]">{i.number} · {i.customer}</p><p className="m-0 text-caption text-[var(--text-muted)]">{i.jobRef} · due {fmtDate(i.dueOn)}</p></div>
                    <Pill tone={INVOICE_TONE[i.status]}>{i.status}</Pill>
                  </div>
                  <p className="m-0 text-caption text-[var(--text-body)]">{money(i.amount)}{i.paid > 0 ? ` · ${usd(i.paid)} paid` : ""}{outstanding(i) ? ` · ${usd(outstanding(i))} balance` : ""}</p>
                </div>
              )} />
          </>
        )}

        {tab === "estimates" && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder="Search estimate, customer, work order…" className="w-full sm:w-auto sm:flex-1 lg:flex-none lg:w-[300px]" />
            </div>
            <DataTable columns={estCols} rows={estRows} rowKey={e => e.id} onRowClick={e => router.push(`/work-orders/${e.woId}?tab=estimate`)} pageSize={10} noun="estimates" minWidth={960}
              empty={{ icon: FileText, title: "No estimates" }}
              mobileCard={e => (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="m-0 text-label text-[var(--text-primary)]">{e.number} · {e.customer}</p><p className="m-0 text-caption text-[var(--text-muted)]">{workOrderById(e.woId)?.title}</p></div>
                  <div className="text-right"><p className="m-0 text-label font-bold text-[var(--text-primary)]">{money(estimateTotal(e))}</p><Pill tone={ESTIMATE_TONE[e.status]}>{e.status}</Pill></div>
                </div>
              )} />
          </>
        )}
      </ListCard>

      <p className="m-0 flex items-center gap-2 text-caption text-[var(--text-muted)]">
        <Info size={14} /> Payments, credit notes and accounting exports are handled in <Link href="/integrations" className="text-blue-600 hover:underline">EVOQ Billing</Link>.
      </p>
      <InvoiceDrawer inv={find(selected)} role={role} onClose={() => setSelected(null)}
        onPay={i => setDialog({ kind: "pay", number: i.number })} onCredit={openCredit} onVoid={i => setDialog({ kind: "void", number: i.number })} onReissue={i => setDialog({ kind: "reissue", number: i.number })}
        onPrintCredit={printCredit} onOpenInvoice={setSelected} />
      {dialog?.kind === "pay" && dialogInv && <PaymentDialog key={dialogInv.number} inv={dialogInv} by={by} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "credit" && dialogInv && <CreditNoteDialog key={dialogInv.number} inv={dialogInv} by={by} onClose={() => setDialog(null)} onDone={msg => done(msg)} />}
      {dialog?.kind === "void" && dialogInv && <VoidDialog key={dialogInv.number} inv={dialogInv} role={role} by={by} onClose={() => setDialog(null)}
        onDone={(msg, reissue) => { done(msg); if (reissue) setDialog({ kind: "reissue", number: dialogInv.number }); }} />}
      {dialog?.kind === "reissue" && dialogInv && <ReissueDialog key={dialogInv.number} inv={dialogInv} role={role} by={by} onClose={() => setDialog(null)} onDone={done} />}
      <CreditNoteSheet print={creditPrint} />
      <InvoiceBlockedDialog open={!!blocked} title={blocked?.title ?? ""} problems={blocked?.problems ?? []} onClose={() => setBlocked(null)} />
      {toastNode}
    </PageShell>
  );
}
