"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import {
  FileText, Buildings, UserCircle, Envelope, Phone, MapPin, Cube, Notepad, Paperclip, ClockCounterClockwise,
  Wrench, Truck, CheckCircle, PencilSimple, XCircle, Plus, UploadSimple, Trash, CalendarBlank, Clock, Flag,
  Pulse, Globe, ShieldCheck, Receipt, ArrowRight, HourglassMedium, Key, ListChecks, PaperPlaneTilt,
} from "@phosphor-icons/react";
import {
  PageShell, Breadcrumb, DetailTabs, DetailCard, Field, IconField, EditButton, EmptyState, MiniTable, NextStep,
  Timeline, ActionMenu, useToast, Pill, PriorityTag, DetailPrimaryButton, SecondaryButton, RecordLink, SideDrawer,
  DrawerSection, DrawerActions, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import { WO_STATUS_TONE, ESTIMATE_TONE, JobStatusPill } from "@/components/workorders/woShared";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { TECHNICIAN_AVATARS, TECHNICIAN_TITLES, formatFileSize, type JobPriority } from "@/lib/jobsData";
import {
  workOrderById, woStatus, woJobs, woNextStep, customerById, CONTACTS, assetById, warrantyState, estimateForWO,
  estimateTotal, setEstimateStatus, ESTIMATES, SERVICE_PRICING, logWO, billingStateForJob, fmtDate, fmtTime, money,
  datasetNow, SLA_HOURS_BY_SERVICE, type WorkOrder, type Estimate,
} from "@/lib/serviceData";

const TABS = ["overview", "jobs", "estimate", "attachments", "history"] as const;
type Tab = typeof TABS[number];
const LIFECYCLE = ["Requested", "Approved", "Scheduled", "In progress", "Completed", "Invoiced"];

function lifecycleIndex(wo: WorkOrder): number {
  const s = woStatus(wo);
  if (s === "New") return 0;
  if (s === "Awaiting approval") return 1;
  if (s === "Ready to schedule") return 2;
  if (s === "Scheduled") return 3;
  if (s === "In progress") return 4;
  if (s === "Completed") {
    const st = billingStateForJob(woJobs(wo)[0]?.id);
    return st === "Invoiced" || st === "Paid" ? 6 : 5;
  }
  return 0;
}

export default function WorkOrderDetail({ woId }: { woId: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);
  const [tab, setTab] = useState<Tab>(() => (TABS as readonly string[]).includes(params.get("tab") ?? "") ? params.get("tab") as Tab : "overview");
  const [noteDraft, setNoteDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const wo = useMemo(() => workOrderById(woId), [woId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState(() => ({ title: wo?.title ?? "", priority: (wo?.priority ?? "Medium") as JobPriority, description: wo?.description ?? "" }));

  if (!wo) {
    return (
      <PageShell>
        <div className="flex-1 flex items-center justify-center py-24 text-center">
          <div>
            <p className="m-0 mb-2 text-h1 text-[var(--text-primary)]">Work order not found</p>
            <Link href="/work-orders" className="text-body underline text-[var(--text-primary)]">Back to Work Orders</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const status = woStatus(wo);
  const jobs = woJobs(wo).sort((a, b) => b.scheduledAt - a.scheduledAt);
  const latest = jobs[0];
  const customer = customerById(wo.customerId);
  const contact = CONTACTS.find(c => c.id === wo.contactId);
  const asset = wo.assetId ? assetById(wo.assetId) : undefined;
  const estimate = estimateForWO(wo.id);
  const next = woNextStep(wo);
  const lc = lifecycleIndex(wo);
  const cancelled = status === "Cancelled";

  const approve = () => { wo.baseStatus = "Ready to schedule"; logWO(wo, "Request reviewed and approved for scheduling"); refresh(); notify(`${wo.number} is ready to schedule`); };
  const cancel = () => { wo.baseStatus = "Cancelled"; logWO(wo, "Work order cancelled"); refresh(); notify(`${wo.number} cancelled`); };
  const createEstimate = () => {
    const p = SERVICE_PRICING[wo.serviceType];
    const est: Estimate = {
      id: `est-${wo.id}`, number: `EST-2024-${String(400 + ESTIMATES.length).padStart(4, "0")}`, woId: wo.id, customer: wo.customer,
      issuedOn: datasetNow(), validUntil: datasetNow() + 30 * 864e5, status: "Draft",
      lines: [...p.parts, { item: `Labour — ${p.durationHrs} hrs`, qty: 1, rate: p.labor }],
    };
    ESTIMATES.push(est);
    logWO(wo, `Estimate ${est.number} drafted`);
    setTab("estimate"); refresh(); notify(`${est.number} drafted from the ${wo.serviceType} price book`);
  };
  const estimateAction = (s: Estimate["status"]) => {
    if (!estimate) return;
    setEstimateStatus(estimate, s);
    refresh();
    notify(`${estimate.number} marked ${s.toLowerCase()}`);
  };
  const addNote = () => {
    if (!noteDraft.trim()) return;
    wo.notes.unshift({ id: `n-${Date.now()}`, text: noteDraft.trim(), author: "PM SDL", at: `${fmtDate(datasetNow())} ${fmtTime(datasetNow())}` });
    logWO(wo, "Note added");
    setNoteDraft(""); refresh();
  };
  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    wo.attachments.push(...Array.from(files).map((f, i) => ({ id: `f-${Date.now()}-${i}`, name: f.name, size: formatFileSize(f.size) })));
    logWO(wo, `${files.length} file${files.length > 1 ? "s" : ""} attached`);
    refresh(); notify(`${files.length} file${files.length > 1 ? "s" : ""} attached`);
  };
  const saveEdit = () => {
    Object.assign(wo, { title: draft.title.trim() || wo.title, priority: draft.priority, description: draft.description.trim() });
    logWO(wo, "Work order details updated");
    setEditOpen(false); refresh(); notify(`${wo.number} updated`);
  };

  // ── Primary action follows the lifecycle ──
  const primary = (() => {
    if (cancelled) return null;
    if (status === "New") return estimate ? <DetailPrimaryButton icon={PaperPlaneTilt} onClick={() => estimateAction("Sent")}>Send estimate</DetailPrimaryButton>
      : <DetailPrimaryButton icon={CheckCircle} onClick={approve}>Approve for scheduling</DetailPrimaryButton>;
    if (status === "Awaiting approval") return <DetailPrimaryButton icon={CheckCircle} onClick={() => estimateAction("Approved")}>Mark estimate approved</DetailPrimaryButton>;
    if (status === "Ready to schedule") return <DetailPrimaryButton icon={Truck} href={`/dispatch?wo=${wo.id}`}>Schedule in Dispatch</DetailPrimaryButton>;
    if (latest && status !== "Completed") return <DetailPrimaryButton icon={Wrench} href={`/jobs/${latest.id}`}>Open {latest.jobId}</DetailPrimaryButton>;
    if (status === "Completed") return <DetailPrimaryButton icon={Receipt} href="/billing">Go to billing</DetailPrimaryButton>;
    return null;
  })();

  // ── History: derived milestones + logged actions ──
  const history: { label: string; at: string; ts: number }[] = [
    { label: `Request received via ${wo.source.toLowerCase()}${contact ? ` from ${contact.name}` : ""}`, ts: wo.requestedAt, at: "" },
    ...(estimate ? [{ label: `Estimate ${estimate.number} ${estimate.status === "Draft" ? "drafted" : "issued"} — ${money(estimateTotal(estimate))}`, ts: estimate.issuedOn, at: "" }] : []),
    ...jobs.map(j => ({ label: `${j.jobId} scheduled with ${j.technician}`, ts: j.scheduledAt - 864e5, at: "" })),
    ...wo.activity.map(a => ({ label: a.label, ts: a.at, at: "" })),
  ].sort((a, b) => b.ts - a.ts).map(h => ({ ...h, at: `${fmtDate(h.ts).replace(/, \d{4}$/, "")}, ${fmtTime(h.ts)}` }));

  const tabs = [
    { key: "overview" as Tab, label: "Overview" },
    { key: "jobs" as Tab, label: "Jobs", count: jobs.length },
    { key: "estimate" as Tab, label: "Estimate" },
    { key: "attachments" as Tab, label: "Attachments", count: wo.attachments.length },
    { key: "history" as Tab, label: "History" },
  ];

  const lifecycleCard = (
    <DetailCard icon={ListChecks} title="Lifecycle">
      <ol className="m-0 p-0 list-none flex flex-col">
        {LIFECYCLE.map((step, i) => {
          const done = !cancelled && i < lc;
          const now = !cancelled && i === lc;
          return (
            <li key={step} className="flex items-stretch gap-3">
              <span className="flex flex-col items-center">
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${done ? "bg-blue-600 border-blue-600" : now ? "border-blue-600 bg-[var(--bg-card)]" : "border-[var(--border)] bg-[var(--bg-card)]"}`}>
                  {done && <CheckCircle size={12} weight="bold" color="#fff" />}
                </span>
                {i < LIFECYCLE.length - 1 && <span className={`w-[2px] flex-1 min-h-[14px] ${done ? "bg-blue-600" : "bg-[var(--border)]"}`} />}
              </span>
              <span className={`pb-3 text-body ${now ? "font-semibold text-[var(--text-primary)]" : done ? "text-[var(--text-body)]" : "text-[var(--text-muted)]"}`}>
                {step}{now && <span className="ml-2 text-caption text-blue-600">current</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {cancelled && <p className="m-0 mt-1 text-caption text-[#EF4444]">This work order was cancelled.</p>}
    </DetailCard>
  );

  const jobCard = (
    <DetailCard icon={Wrench} title="Field job" action={latest ? <EditButton icon={ArrowRight} label="Open" onClick={() => router.push(`/jobs/${latest.id}`)} /> : undefined}>
      {latest ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/jobs/${latest.id}`} className="text-label font-semibold text-blue-600 hover:underline">{latest.jobId}</Link>
            <JobStatusPill status={latest.status} />
          </div>
          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 items-center">
            <Avatar src={TECHNICIAN_AVATARS[latest.technician]} alt={latest.technician} sx={{ width: 44, height: 44 }} />
            <div className="min-w-0">
              <p className="m-0 text-label font-bold text-[var(--text-primary)]">{latest.technician}</p>
              <p className="m-0 text-caption text-[var(--text-muted)]">{TECHNICIAN_TITLES[latest.technician] ?? "Field Technician"}</p>
            </div>
          </div>
          <dl className="m-0 flex flex-col gap-2.5">
            <IconField icon={CalendarBlank} label="Scheduled" labelClass="text-caption">{latest.scheduledDate}</IconField>
            <IconField icon={Clock} label="Time" labelClass="text-caption">{latest.scheduledTime}</IconField>
          </dl>
          {jobs.length > 1 && <button type="button" onClick={() => setTab("jobs")} className="self-start text-button-sm text-blue-600 hover:underline">+{jobs.length - 1} earlier visit{jobs.length > 2 ? "s" : ""}</button>}
        </div>
      ) : (
        <EmptyState icon={Truck} text={status === "Ready to schedule" ? "Not scheduled yet — use Schedule in Dispatch" : "A job is created once this request is approved and scheduled"} />
      )}
    </DetailCard>
  );

  const estimateBody = estimate ? (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-label font-bold text-[var(--text-primary)]">{estimate.number}</p>
          <p className="m-0 text-caption text-[var(--text-muted)]">Issued {fmtDate(estimate.issuedOn)} · valid until {fmtDate(estimate.validUntil)}</p>
        </div>
        <Pill tone={ESTIMATE_TONE[estimate.status]}>{estimate.status}</Pill>
      </div>
      <MiniTable head={["Item", { label: "Qty", right: true }, { label: "Rate", right: true }, { label: "Amount", right: true }]}>
        {estimate.lines.map((l, i) => (
          <tr key={i}>
            <td className="px-4 text-table-cell text-[var(--text-primary)]">{l.item}</td>
            <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{l.qty}</td>
            <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{money(l.rate)}</td>
            <td className="px-4 text-right text-table-cell font-semibold text-[var(--text-primary)]">{money(l.qty * l.rate)}</td>
          </tr>
        ))}
      </MiniTable>
      <div className="flex flex-col gap-1.5 sm:w-72 sm:ml-auto">
        {(() => {
          const sub = estimate.lines.reduce((s, l) => s + l.qty * l.rate, 0);
          return (
            <>
              <div className="flex justify-between text-body"><span className="text-[var(--text-muted)]">Subtotal</span><span className="text-[var(--text-primary)]">{money(sub)}</span></div>
              <div className="flex justify-between text-body"><span className="text-[var(--text-muted)]">Tax (18%)</span><span className="text-[var(--text-primary)]">{money(sub * 0.18)}</span></div>
              <div className="flex justify-between pt-2 mt-1 border-t border-[var(--border-soft)]"><span className="text-label font-bold text-[var(--text-primary)]">Total</span><span className="text-h2 font-bold text-[var(--text-primary)]">{money(estimateTotal(estimate))}</span></div>
            </>
          );
        })()}
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        {estimate.status === "Draft" && <Button variant="contained" startIcon={<PaperPlaneTilt size={14} />} onClick={() => estimateAction("Sent")}>Send to customer</Button>}
        {estimate.status === "Sent" && (
          <>
            <Button variant="outlined" color="error" onClick={() => estimateAction("Declined")}>Mark declined</Button>
            <Button variant="contained" startIcon={<CheckCircle size={14} />} onClick={() => estimateAction("Approved")}>Mark approved</Button>
          </>
        )}
      </div>
    </div>
  ) : (
    <EmptyState icon={FileText} text="No estimate for this work order"
      action={!cancelled && !latest ? <Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={createEstimate}>Create estimate</Button> : undefined} />
  );

  return (
    <PageShell>
      <Breadcrumb homeIcon items={[{ label: "Work Orders", href: "/work-orders" }, { label: wo.number }]} />

      {/* Identity — one compact line, not a hero */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-h1 sm:text-[22px] font-bold text-[var(--text-primary)]">{wo.title}</h1>
          <Pill tone={WO_STATUS_TONE[status]}>{status}</Pill>
          <PriorityTag priority={wo.priority} />
        </div>
        <p className="m-0 text-body text-[var(--text-body)]">
          {wo.number} · <RecordLink href={`/customers/${wo.customerId}`}>{wo.customer}</RecordLink>
          {asset && <> · <RecordLink href={`/assets/${asset.id}`}>{asset.name}</RecordLink></>}
          {" "}· Requested {fmtDate(wo.requestedAt)}
        </p>
      </div>

      <DetailTabs label="Work order sections" tabs={tabs} active={tab} onChange={setTab}
        actions={
          <>
            {primary}
            <SecondaryButton icon={PencilSimple} onClick={() => { setDraft({ title: wo.title, priority: wo.priority, description: wo.description }); setEditOpen(true); }}>Edit</SecondaryButton>
            <ActionMenu variant="page" actions={[
              ...(status === "New" && estimate ? [{ label: "Approve without estimate", icon: CheckCircle, onClick: approve }] : []),
              { label: estimate ? "View estimate" : "Create estimate", icon: FileText, onClick: () => (estimate ? setTab("estimate") : createEstimate()) },
              { label: "Add note", icon: Notepad, onClick: () => setTab("overview") },
              { label: "Attach file", icon: Paperclip, onClick: () => { setTab("attachments"); setTimeout(() => fileInput.current?.click(), 50); } },
              { label: "Cancel work order", icon: XCircle, danger: true, divider: true, disabled: cancelled || !!latest, onClick: cancel },
            ]} />
          </>
        } />

      {/* ═════ OVERVIEW ═════ */}
      {tab === "overview" && (
        <>
          {!cancelled && (
            <NextStep tone={next.tone as PillTone} label={next.label}
              action={status === "Awaiting approval" && estimate ? <Button size="small" variant="outlined" onClick={() => setTab("estimate")}>Review estimate</Button>
                : status === "New" ? <Button size="small" variant="outlined" onClick={approve}>Approve</Button> : undefined} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
            <div className="flex flex-col gap-4 min-w-0">
              <DetailCard icon={FileText} title="Service request" action={<EditButton onClick={() => { setDraft({ title: wo.title, priority: wo.priority, description: wo.description }); setEditOpen(true); }} />}>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-y-5">
                  <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[135px_minmax(0,1fr)] gap-x-4 gap-y-4 items-start sm:pl-2 lg:pr-6">
                    <Field label="Work order #">{wo.number}</Field>
                    <Field label="Title">{wo.title}</Field>
                    <Field label="Description"><span className="text-[var(--text-body)]">{wo.description || "—"}</span></Field>
                    <Field label="Service type">{wo.serviceType}</Field>
                    <Field label="Priority"><PriorityTag priority={wo.priority} /></Field>
                    <Field label="Requested by">{contact ? `${contact.name} · ${contact.title}` : "—"}</Field>
                  </dl>
                  <dl className="m-0 flex flex-col gap-5 border-t border-[var(--border-soft)] pt-5 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6 sm:pl-2">
                    <IconField icon={CalendarBlank} label="Requested" labelClass="text-caption">{fmtDate(wo.requestedAt)}, {fmtTime(wo.requestedAt)}</IconField>
                    <IconField icon={Clock} label="Preferred visit" labelClass="text-caption">{wo.preferredDate ? fmtDate(wo.preferredDate) : "Flexible"}</IconField>
                    <IconField icon={HourglassMedium} label="Response SLA" labelClass="text-caption">{SLA_HOURS_BY_SERVICE[wo.serviceType]} hrs</IconField>
                    <IconField icon={Globe} label="Received via" labelClass="text-caption">{wo.source}</IconField>
                    <IconField icon={Pulse} label="Status" labelClass="text-caption"><Pill tone={WO_STATUS_TONE[status]}>{status}</Pill></IconField>
                  </dl>
                </div>
              </DetailCard>

              <DetailCard icon={Cube} title="Asset & location">
                {asset ? (
                  <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] sm:grid-cols-[176px_minmax(0,1fr)] gap-x-4 gap-y-4 sm:pl-10">
                    <Field label="Asset"><Link href={`/assets/${asset.id}`} className="text-blue-600 hover:underline">{asset.name}</Link> <span className="text-[var(--text-muted)]">· {asset.assetNo}</span></Field>
                    <Field label="Model">{asset.manufacturer === asset.model.split(" ")[0] ? asset.model : `${asset.manufacturer} ${asset.model}`}</Field>
                    <Field label="Serial number">{asset.serialNumber}</Field>
                    <Field label="Warranty">
                      <Pill tone={warrantyState(asset) === "Expired" ? "gray" : warrantyState(asset) === "Expiring soon" ? "amber" : "green"}>{warrantyState(asset)} · {fmtDate(asset.warrantyUntil)}</Pill>
                    </Field>
                    <Field label="Location">{asset.site}</Field>
                    <Field label="Site access"><span className="text-[var(--text-body)]">{customer?.accessNotes ?? "—"}</span></Field>
                  </dl>
                ) : (
                  <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] sm:grid-cols-[176px_minmax(0,1fr)] gap-x-4 gap-y-4 sm:pl-10">
                    <Field label="Asset"><span className="text-[var(--text-muted)]">Not linked to a specific asset</span></Field>
                    <Field label="Location">{wo.site || "—"}</Field>
                    <Field label="Site access"><span className="text-[var(--text-body)]">{customer?.accessNotes ?? "—"}</span></Field>
                  </dl>
                )}
              </DetailCard>

              <DetailCard icon={Notepad} title="Notes">
                <div className="flex flex-col gap-3 sm:pl-10">
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors">
                    <InputBase fullWidth multiline minRows={2} placeholder="Add a note for the team…" value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
                      sx={{ px: 2, py: 1.5, fontSize: "14px", color: "var(--text-primary)" }} />
                    {noteDraft.trim() && <div className="flex justify-end px-3 pb-2"><Button size="small" variant="contained" onClick={addNote}>Add note</Button></div>}
                  </div>
                  {wo.notes.length === 0 && <p className="m-0 text-body text-[var(--text-muted)]">No notes yet.</p>}
                  {wo.notes.map(n => (
                    <div key={n.id} className="rounded-xl px-4 py-3 border border-[var(--border-soft)] bg-[var(--serviceops-tint)]">
                      <p className="m-0 text-body text-[var(--text-primary)] break-words">{n.text}</p>
                      <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">{n.author} · {n.at}</p>
                    </div>
                  ))}
                </div>
              </DetailCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 min-w-0">
              <DetailCard icon={Buildings} title="Customer" action={<EditButton icon={ArrowRight} label="View" onClick={() => router.push(`/customers/${wo.customerId}`)} />}>
                <div className="flex items-start gap-4 mb-5">
                  <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0"><Buildings size={28} weight="duotone" /></span>
                  <div className="min-w-0">
                    <p className="m-0 text-label font-bold text-[var(--text-primary)]">{wo.customer}</p>
                    <p className="m-0 text-body text-[var(--text-body)]">{customer?.street}</p>
                    <p className="m-0 text-body text-[var(--text-body)]">{customer?.cityLine}</p>
                  </div>
                </div>
                <dl className="m-0 flex flex-col gap-2.5">
                  <IconField icon={UserCircle} label="Contact">{contact?.name ?? "—"}</IconField>
                  <IconField icon={Envelope} label="Email">{contact ? <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a> : "—"}</IconField>
                  <IconField icon={Phone} label="Phone">{contact ? <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:underline">{contact.phone}</a> : "—"}</IconField>
                  <IconField icon={ShieldCheck} label="Service plan">{customer?.plan ?? "—"}</IconField>
                  <IconField icon={MapPin} label="Service zone">{wo.zone}</IconField>
                </dl>
              </DetailCard>
              {jobCard}
              {lifecycleCard}
              {estimate && (
                <DetailCard icon={Receipt} title="Estimate" action={<EditButton icon={ArrowRight} label="Open" onClick={() => setTab("estimate")} />}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="m-0 text-label font-bold text-[var(--text-primary)]">{estimate.number}</p>
                      <p className="m-0 text-caption text-[var(--text-muted)]">{estimate.lines.length} lines · issued {fmtDate(estimate.issuedOn)}</p>
                    </div>
                    <div className="text-right">
                      <p className="m-0 text-h2 font-bold text-[var(--text-primary)]">{money(estimateTotal(estimate))}</p>
                      <Pill tone={ESTIMATE_TONE[estimate.status]}>{estimate.status}</Pill>
                    </div>
                  </div>
                </DetailCard>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═════ JOBS ═════ */}
      {tab === "jobs" && (
        <DetailCard icon={Wrench} title="Field jobs for this work order">
          {jobs.length === 0 ? (
            <EmptyState icon={Truck} text="No field jobs yet"
              action={status === "Ready to schedule" ? <Button size="small" variant="contained" onClick={() => router.push(`/dispatch?wo=${wo.id}`)}>Schedule in Dispatch</Button> : undefined} />
          ) : (
            <MiniTable head={["Job #", "Job name", "Technician", "Scheduled", "Status"]} minWidth={640}>
              {jobs.map(j => (
                <tr key={j.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${j.id}`)}>
                  <td className="px-4 text-table-cell font-semibold text-blue-600 whitespace-nowrap">{j.jobId}</td>
                  <td className="px-4 text-table-cell text-[var(--text-primary)]">{j.jobName}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{j.technician}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{j.scheduledDate}, {j.scheduledTime}</td>
                  <td className="px-4"><JobStatusPill status={j.status} /></td>
                </tr>
              ))}
            </MiniTable>
          )}
        </DetailCard>
      )}

      {/* ═════ ESTIMATE ═════ */}
      {tab === "estimate" && (
        <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
          <DetailCard icon={Receipt} title="Estimate">{estimateBody}</DetailCard>
          <DetailCard icon={Key} title="Approval">
            <p className="m-0 text-body text-[var(--text-body)]">
              {estimate?.status === "Approved" ? "Approved by the customer — work can be scheduled."
                : estimate?.status === "Sent" ? `Waiting on ${contact?.name ?? "the customer"} to approve. Scheduling is on hold until then.`
                : estimate?.status === "Declined" ? "The customer declined this estimate. Revise the scope or cancel the work order."
                : estimate?.status === "Draft" ? "Draft — review the lines, then send it to the customer."
                : "This request didn't need an estimate. Charges are captured on the job."}
            </p>
            {contact && <p className="m-0 mt-3 text-caption text-[var(--text-muted)]">Approver: {CONTACTS.find(c => c.customerId === wo.customerId && c.roles.includes("Approves estimates"))?.name ?? contact.name}</p>}
          </DetailCard>
        </div>
      )}

      {/* ═════ ATTACHMENTS ═════ */}
      {tab === "attachments" && (
        <DetailCard icon={Paperclip} title="Attachments"
          action={
            <>
              <input ref={fileInput} type="file" multiple hidden onChange={e => { onFiles(e.target.files); e.target.value = ""; }} />
              <Button size="small" variant="outlined" startIcon={<UploadSimple size={14} weight="bold" />} onClick={() => fileInput.current?.click()}>Attach</Button>
            </>
          }>
          {wo.attachments.length === 0 ? <EmptyState icon={Paperclip} text="No attachments yet" /> : (
            <div className="flex flex-col gap-1">
              {wo.attachments.map(a => (
                <div key={a.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--serviceops-tint)] transition-colors">
                  <FileText size={16} color="#EF4444" weight="duotone" className="flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-body text-[var(--text-primary)]">{a.name}</span>
                  <span className="text-caption flex-shrink-0 text-[var(--text-muted)]">{a.size}</span>
                  <Tooltip title="Remove">
                    <IconButton size="small" onClick={() => { wo.attachments = wo.attachments.filter(x => x.id !== a.id); refresh(); }}
                      sx={{ p: 0.3, opacity: 0, transition: "opacity 0.15s", ".group:hover &": { opacity: 1 } }}>
                      <Trash size={13} color="#EF4444" weight="duotone" />
                    </IconButton>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </DetailCard>
      )}

      {/* ═════ HISTORY ═════ */}
      {tab === "history" && (
        <DetailCard icon={ClockCounterClockwise} title="Activity">
          <Timeline items={history} />
        </DetailCard>
      )}

      <SideDrawer open={editOpen} onClose={() => setEditOpen(false)} icon={PencilSimple} title={`Edit ${wo.number}`} subtitle={wo.customer}
        footer={<DrawerActions onCancel={() => setEditOpen(false)} onSubmit={saveEdit} submitLabel="Save changes" />}>
        <DrawerSection title="Request">
          <div className="grid grid-cols-1 gap-3">
            <TextField label="Title" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} size="small" fullWidth sx={FX} />
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Priority</InputLabel>
              <Select label="Priority" value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value as JobPriority }))}>
                {(["High", "Medium", "Low"] as JobPriority[]).map(p => <MenuItem key={p} value={p} sx={{ fontSize: "0.84rem" }}><Flag size={12} weight="fill" style={{ marginRight: 8 }} />{p}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Description" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} size="small" fullWidth multiline rows={5} sx={FX} />
          </div>
        </DrawerSection>
      </SideDrawer>

      {toastNode}
    </PageShell>
  );
}
