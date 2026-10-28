"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import {
  Buildings, UserCircle, Envelope, Phone, MapPin, ShieldCheck, ClipboardText, Wrench, Cube, ClockCounterClockwise,
  Receipt, Notepad, Paperclip, Plus, Key, CalendarBlank, Handshake, Users, CurrencyDollar, ArrowRight, UploadSimple,
  FileText, Pulse, Truck,
} from "@phosphor-icons/react";
import {
  PageShell, Breadcrumb, DetailTabs, DetailCard, IconField, EmptyState, MiniTable, Pill, PriorityTag, DetailPrimaryButton,
  SecondaryButton, EditButton, ActionMenu, useToast, ServiceTypeCell, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import { WO_STATUS_TONE, ESTIMATE_TONE, INVOICE_TONE, JobStatusPill } from "@/components/workorders/woShared";
import { ASSET_STATUS_TONE } from "@/components/assets/assetShared";
import NewWorkOrderDrawer from "@/components/workorders/NewWorkOrderDrawer";
import { formatFileSize } from "@/lib/jobsData";
import {
  customerById, customerStats, contactsFor, woStatus, woNextStep, assetStatus, assetNextService,
  ESTIMATES, estimateTotal, outstanding, fmtDate, fmtTime, money, relDay, datasetNow, workOrderForJob,
} from "@/lib/serviceData";

const TABS = ["overview", "contacts", "workorders", "jobs", "assets", "history", "billing", "files"] as const;
type Tab = typeof TABS[number];

const STATUS_TONE: Record<string, PillTone> = { Active: "green", "On hold": "amber", Inactive: "gray" };

// Customer-level notes/files live for the session, like the rest of the demo data.
const CUSTOMER_NOTES: Record<string, { id: string; text: string; author: string; at: string }[]> = {
  "acme-industrial-systems": [{ id: "seed", text: "New Gold AMC account (Mar 2024). Press line B is their bottleneck — treat HP-450 calls as production-down.", author: "Alex Morgan", at: "Mar 20, 2024 10:15 AM" }],
  "metro-hospital": [{ id: "seed", text: "All electrical work in the imaging wing must be coordinated with the department lead 48h in advance.", author: "Grace Liu", at: "Jul 02, 2024 02:30 PM" }],
};
const CUSTOMER_FILES: Record<string, { id: string; name: string; size: string }[]> = {};
const DEFAULT_FILES = [{ id: "f1", name: "Service agreement.pdf", size: "412 KB" }, { id: "f2", name: "Site plan.pdf", size: "1.8 MB" }];

export default function CustomerDetail({ customerId }: { customerId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>(() => (TABS as readonly string[]).includes(params.get("tab") ?? "") ? params.get("tab") as Tab : "overview");
  const [woOpen, setWoOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const c = customerById(customerId);
  const s = useMemo(() => (c ? customerStats(c) : null), [c, version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c || !s) {
    return (
      <PageShell>
        <div className="py-24 text-center">
          <p className="m-0 mb-2 text-h1 text-[var(--text-primary)]">Customer not found</p>
          <Link href="/customers" className="text-body underline text-[var(--text-primary)]">Back to Customers</Link>
        </div>
      </PageShell>
    );
  }

  const contacts = contactsFor(c.id);
  const primary = contacts.find(x => x.primary);
  const estimates = ESTIMATES.filter(e => e.customer === c.name).sort((a, b) => b.issuedOn - a.issuedOn);
  const notes = CUSTOMER_NOTES[c.id] ?? (CUSTOMER_NOTES[c.id] = []);
  const files = CUSTOMER_FILES[c.id] ?? (CUSTOMER_FILES[c.id] = DEFAULT_FILES.map(f => ({ ...f })));
  const sortedJobs = [...s.jobs].sort((a, b) => a.scheduledAt - b.scheduledAt);
  const needsAction = s.openWOs.filter(w => ["New", "Awaiting approval", "Ready to schedule"].includes(woStatus(w)));

  const tabs = [
    { key: "overview" as Tab, label: "Overview" },
    { key: "contacts" as Tab, label: "Contacts", count: contacts.length },
    { key: "workorders" as Tab, label: "Work orders", count: s.wos.length },
    { key: "jobs" as Tab, label: "Jobs", count: s.jobs.length },
    { key: "assets" as Tab, label: "Assets", count: s.assets.length },
    { key: "history" as Tab, label: "History" },
    { key: "billing" as Tab, label: "Billing" },
    { key: "files" as Tab, label: "Notes" },
  ];

  const addNote = () => {
    if (!noteDraft.trim()) return;
    notes.unshift({ id: `n-${Date.now()}`, text: noteDraft.trim(), author: "PM SDL", at: `${fmtDate(datasetNow())} ${fmtTime(datasetNow())}` });
    setNoteDraft(""); setVersion(v => v + 1);
  };

  const woTable = (list: typeof s.wos, compact = false) => list.length === 0 ? <EmptyState icon={ClipboardText} text="No work orders" /> : (
    <MiniTable head={compact ? ["Work order #", "Title", "Status", "Next step"] : ["Work order #", "Title", "Service type", "Priority", "Requested", "Status"]} minWidth={compact ? 560 : 760}>
      {list.map(w => {
        const st = woStatus(w);
        return (
          <tr key={w.id} className="cursor-pointer" onClick={() => router.push(`/work-orders/${w.id}`)}>
            <td className="px-4 text-table-cell font-semibold text-blue-600 whitespace-nowrap">{w.number}</td>
            <td className="px-4 text-table-cell text-[var(--text-primary)]">{w.title}</td>
            {compact ? (
              <>
                <td className="px-4"><Pill tone={WO_STATUS_TONE[st]}>{st}</Pill></td>
                <td className="px-4 text-table-cell text-[var(--text-body)]">{woNextStep(w).label}</td>
              </>
            ) : (
              <>
                <td className="px-4"><ServiceTypeCell type={w.serviceType} /></td>
                <td className="px-4"><PriorityTag priority={w.priority} /></td>
                <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(w.requestedAt)}</td>
                <td className="px-4"><Pill tone={WO_STATUS_TONE[st]}>{st}</Pill></td>
              </>
            )}
          </tr>
        );
      })}
    </MiniTable>
  );

  return (
    <PageShell>
      <Breadcrumb homeIcon items={[{ label: "Customers", href: "/customers" }, { label: c.name }]} />

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-h1 sm:text-[22px] font-bold text-[var(--text-primary)]">{c.name}</h1>
          <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
        </div>
        <p className="m-0 text-body text-[var(--text-body)]">{c.type} · {c.location} · {c.plan} · Customer since {c.customerSince}</p>
      </div>

      <DetailTabs label="Customer sections" tabs={tabs} active={tab} onChange={setTab}
        actions={
          <>
            <DetailPrimaryButton icon={Plus} onClick={() => setWoOpen(true)}>New work order</DetailPrimaryButton>
            {primary && <SecondaryButton icon={Phone} href={`tel:${primary.phone.replace(/\s/g, "")}`}>Call</SecondaryButton>}
            <ActionMenu variant="page" actions={[
              { label: "Contacts", icon: Users, onClick: () => setTab("contacts") },
              { label: "Add note", icon: Notepad, onClick: () => setTab("files") },
              { label: "View invoices", icon: Receipt, onClick: () => setTab("billing") },
            ]} />
          </>
        } />

      {/* ═════ OVERVIEW ═════ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            {/* What's happening now — the reason most people open a customer */}
            <DetailCard icon={Pulse} title="Open work" action={s.openWOs.length ? <EditButton icon={ArrowRight} label="All work orders" onClick={() => setTab("workorders")} /> : undefined}>
              {s.openWOs.length === 0 && s.activeJobs.length === 0
                ? <EmptyState icon={ClipboardText} text="Nothing open for this customer" action={<Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={() => setWoOpen(true)}>New work order</Button>} />
                : (
                  <div className="flex flex-col gap-4">
                    {needsAction.length > 0 && (
                      <p className="m-0 text-body text-[var(--text-body)]">
                        <span className="font-semibold text-[var(--text-primary)]">{needsAction.length} {needsAction.length === 1 ? "request needs" : "requests need"} action</span> before reaching the field.
                      </p>
                    )}
                    {woTable(s.openWOs, true)}
                  </div>
                )}
            </DetailCard>

            <DetailCard icon={CalendarBlank} title="Upcoming visits" action={s.activeJobs.length ? <EditButton icon={ArrowRight} label="All jobs" onClick={() => setTab("jobs")} /> : undefined}>
              {s.activeJobs.length === 0 ? <EmptyState icon={Truck} text="No visits scheduled" /> : (
                <MiniTable head={["Job #", "Job", "Technician", "Scheduled", "Status"]} minWidth={620}>
                  {[...s.activeJobs].sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, 5).map(j => (
                    <tr key={j.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${j.id}`)}>
                      <td className="px-4 text-table-cell font-semibold text-blue-600 whitespace-nowrap">{j.jobId}</td>
                      <td className="px-4 text-table-cell text-[var(--text-primary)] whitespace-nowrap">{j.jobName}</td>
                      <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{j.technician}</td>
                      <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{j.scheduledDate}, {j.scheduledTime}</td>
                      <td className="px-4"><JobStatusPill status={j.status} /></td>
                    </tr>
                  ))}
                </MiniTable>
              )}
            </DetailCard>

            <DetailCard icon={ClockCounterClockwise} title="Recent service" action={<EditButton icon={ArrowRight} label="Full history" onClick={() => setTab("history")} />}>
              {s.history.length === 0 ? <EmptyState icon={ClockCounterClockwise} text="No completed visits yet" /> : (
                <ul className="m-0 p-0 list-none flex flex-col">
                  {s.history.slice(0, 4).map(v => (
                    <li key={v.id} className="flex items-start justify-between gap-4 py-2.5 border-b border-[var(--border-soft)] last:border-b-0">
                      <div className="min-w-0">
                        <p className="m-0 text-body text-[var(--text-primary)]">{v.summary}</p>
                        <p className="m-0 text-caption text-[var(--text-muted)]">{v.jobRef} · {v.technician}</p>
                      </div>
                      <span className="text-caption text-[var(--text-muted)] whitespace-nowrap">{fmtDate(v.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 min-w-0">
            <DetailCard icon={Buildings} title="Customer">
              <div className="flex items-start gap-4 mb-5">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0"><Buildings size={28} weight="duotone" /></span>
                <div className="min-w-0">
                  <p className="m-0 text-label font-bold text-[var(--text-primary)]">{c.name}</p>
                  <p className="m-0 text-body text-[var(--text-body)]">{c.street}</p>
                  <p className="m-0 text-body text-[var(--text-body)]">{c.cityLine}</p>
                </div>
              </div>
              <dl className="m-0 flex flex-col gap-2.5">
                <IconField icon={UserCircle} label="Primary contact">{primary ? `${primary.name}` : "—"}</IconField>
                <IconField icon={Envelope} label="Email">{primary ? <a href={`mailto:${primary.email}`} className="hover:underline">{primary.email}</a> : "—"}</IconField>
                <IconField icon={Phone} label="Phone">{primary ? <a href={`tel:${primary.phone.replace(/\s/g, "")}`} className="hover:underline">{primary.phone}</a> : c.phone}</IconField>
                <IconField icon={MapPin} label="Service zone">{c.zone} · {c.territory}</IconField>
              </dl>
              {c.accessNotes && (
                <div className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 bg-[var(--serviceops-tint)]">
                  <Key size={16} className="mt-0.5 flex-shrink-0 text-[var(--text-muted)]" />
                  <p className="m-0 text-body text-[var(--text-body)]">{c.accessNotes}</p>
                </div>
              )}
            </DetailCard>

            <DetailCard icon={Handshake} title="Account">
              <dl className="m-0 flex flex-col gap-2.5">
                <IconField icon={ShieldCheck} label="Service plan">{c.plan}</IconField>
                <IconField icon={Receipt} label="Payment terms">{c.paymentTerms}</IconField>
                <IconField icon={UserCircle} label="Account manager">{c.accountManager}</IconField>
                <IconField icon={Cube} label="Assets on file">{s.assets.length}</IconField>
                <IconField icon={CalendarBlank} label="Last service">{s.lastService ? `${fmtDate(s.lastService)} · ${relDay(s.lastService)}` : "—"}</IconField>
              </dl>
            </DetailCard>

            <DetailCard icon={CurrencyDollar} title="Balance" action={<EditButton icon={ArrowRight} label="Invoices" onClick={() => setTab("billing")} />}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="m-0 text-caption text-[var(--text-muted)]">Outstanding</p>
                  <p className="m-0 text-h1 font-bold text-[var(--text-primary)]">{money(s.balance)}</p>
                </div>
                <div>
                  <p className="m-0 text-caption text-[var(--text-muted)]">Overdue</p>
                  <p className={`m-0 text-h1 font-bold ${s.overdue ? "text-[#EF4444]" : "text-[var(--text-primary)]"}`}>{money(s.overdue)}</p>
                </div>
              </div>
            </DetailCard>
          </div>
        </div>
      )}

      {/* ═════ CONTACTS ═════ */}
      {tab === "contacts" && (
        <DetailCard icon={Users} title="Contacts">
          <MiniTable head={["Name", "Title", "Responsible for", "Email", "Phone"]} minWidth={760}>
            {contacts.map(p => (
              <tr key={p.id}>
                <td className="px-4 text-table-cell text-[var(--text-primary)] whitespace-nowrap">
                  {p.name} {p.primary && <span className="ml-2"><Pill tone="blue" dot={false}>Primary</Pill></span>}
                </td>
                <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{p.title}</td>
                <td className="px-4 text-table-cell text-[var(--text-body)]">{p.roles.join(", ")}</td>
                <td className="px-4 text-table-cell"><a href={`mailto:${p.email}`} className="text-blue-600 hover:underline">{p.email}</a></td>
                <td className="px-4 text-table-cell whitespace-nowrap"><a href={`tel:${p.phone.replace(/\s/g, "")}`} className="hover:underline">{p.phone}</a></td>
              </tr>
            ))}
          </MiniTable>
        </DetailCard>
      )}

      {/* ═════ WORK ORDERS ═════ */}
      {tab === "workorders" && (
        <DetailCard icon={ClipboardText} title="Work orders" action={<Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={() => setWoOpen(true)}>New work order</Button>}>
          {woTable([...s.wos].sort((a, b) => b.requestedAt - a.requestedAt))}
        </DetailCard>
      )}

      {/* ═════ JOBS ═════ */}
      {tab === "jobs" && (
        <DetailCard icon={Wrench} title="Jobs">
          {sortedJobs.length === 0 ? <EmptyState icon={Wrench} text="No jobs for this customer" /> : (
            <MiniTable head={["Job #", "Job name", "Work order", "Technician", "Scheduled", "Status"]} minWidth={820}>
              {sortedJobs.map(j => (
                <tr key={j.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${j.id}`)}>
                  <td className="px-4 text-table-cell font-semibold text-blue-600 whitespace-nowrap">{j.jobId}</td>
                  <td className="px-4 text-table-cell text-[var(--text-primary)] whitespace-nowrap">{j.jobName}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{workOrderForJob(j.id)?.number ?? "—"}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{j.technician}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{j.scheduledDate}, {j.scheduledTime}</td>
                  <td className="px-4"><JobStatusPill status={j.status} /></td>
                </tr>
              ))}
            </MiniTable>
          )}
        </DetailCard>
      )}

      {/* ═════ ASSETS ═════ */}
      {tab === "assets" && (
        <DetailCard icon={Cube} title="Assets">
          {s.assets.length === 0 ? <EmptyState icon={Cube} text="No assets registered" /> : (
            <MiniTable head={["Asset #", "Asset", "Model", "Serial number", "Location", "Status", "Next service"]} minWidth={900}>
              {s.assets.map(a => {
                const st = assetStatus(a);
                return (
                  <tr key={a.id} className="cursor-pointer" onClick={() => router.push(`/assets/${a.id}`)}>
                    <td className="px-4 text-table-cell font-semibold text-blue-600 whitespace-nowrap">{a.assetNo}</td>
                    <td className="px-4 text-table-cell text-[var(--text-primary)] whitespace-nowrap">{a.name}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{a.model}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{a.serialNumber}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{a.site}</td>
                    <td className="px-4"><Pill tone={ASSET_STATUS_TONE[st]}>{st}</Pill></td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(assetNextService(a).at)}</td>
                  </tr>
                );
              })}
            </MiniTable>
          )}
        </DetailCard>
      )}

      {/* ═════ SERVICE HISTORY ═════ */}
      {tab === "history" && (
        <DetailCard icon={ClockCounterClockwise} title="Service history">
          {s.history.length === 0 ? <EmptyState icon={ClockCounterClockwise} text="No completed visits yet" /> : (
            <MiniTable head={["Date", "Job #", "Asset", "Work done", "Technician", "Outcome"]} minWidth={900}>
              {s.history.map(v => {
                const a = s.assets.find(x => x.id === v.assetId);
                return (
                  <tr key={v.id}>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(v.date)}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{v.jobRef}</td>
                    <td className="px-4 text-table-cell whitespace-nowrap">{a ? <Link href={`/assets/${a.id}`} className="text-blue-600 hover:underline">{a.name}</Link> : "—"}</td>
                    <td className="px-4 text-table-cell text-[var(--text-primary)]">{v.summary}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{v.technician}</td>
                    <td className="px-4"><Pill tone={v.outcome === "Follow-up required" ? "amber" : "green"}>{v.outcome}</Pill></td>
                  </tr>
                );
              })}
            </MiniTable>
          )}
          <p className="m-0 mt-3 px-2 text-caption text-[var(--text-muted)]">Archived visits — open the asset for its full maintenance record.</p>
        </DetailCard>
      )}

      {/* ═════ BILLING ═════ */}
      {tab === "billing" && (
        <div className="grid grid-cols-1 gap-4">
          <DetailCard icon={FileText} title="Estimates">
            {estimates.length === 0 ? <EmptyState icon={FileText} text="No estimates" /> : (
              <MiniTable head={["Estimate #", "Work order", "Issued", { label: "Amount", right: true }, "Status"]} minWidth={620}>
                {estimates.map(e => (
                  <tr key={e.id} className="cursor-pointer" onClick={() => router.push(`/work-orders/${e.woId}?tab=estimate`)}>
                    <td className="px-4 text-table-cell font-semibold text-blue-600 whitespace-nowrap">{e.number}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{s.wos.find(w => w.id === e.woId)?.number}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(e.issuedOn)}</td>
                    <td className="px-4 text-right text-table-cell font-semibold text-[var(--text-primary)]">{money(estimateTotal(e))}</td>
                    <td className="px-4"><Pill tone={ESTIMATE_TONE[e.status]}>{e.status}</Pill></td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </DetailCard>
          <DetailCard icon={Receipt} title="Invoices">
            {s.invoices.length === 0 ? <EmptyState icon={Receipt} text="No invoices" /> : (
              <MiniTable head={["Invoice #", "Job", "Issued", "Due", { label: "Amount", right: true }, { label: "Outstanding", right: true }, "Status"]} minWidth={820}>
                {s.invoices.map(i => (
                  <tr key={i.number}>
                    <td className="px-4 text-table-cell font-semibold text-[var(--text-primary)] whitespace-nowrap">{i.number}</td>
                    <td className="px-4 text-table-cell whitespace-nowrap">{i.jobId ? <Link href={`/jobs/${i.jobId}`} className="text-blue-600 hover:underline">{i.jobRef}</Link> : <span className="text-[var(--text-body)]">{i.jobRef}</span>}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(i.issuedOn)}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(i.dueOn)}</td>
                    <td className="px-4 text-right text-table-cell text-[var(--text-primary)]">{money(i.amount)}</td>
                    <td className="px-4 text-right text-table-cell font-semibold text-[var(--text-primary)]">{outstanding(i) ? money(outstanding(i)) : "—"}</td>
                    <td className="px-4"><Pill tone={INVOICE_TONE[i.status]}>{i.status}</Pill></td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </DetailCard>
        </div>
      )}

      {/* ═════ NOTES & FILES ═════ */}
      {tab === "files" && (
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <DetailCard icon={Notepad} title="Notes">
            <div className="flex flex-col gap-3">
              <div className="border border-[var(--border)] rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors">
                <InputBase fullWidth multiline minRows={2} placeholder="Add a note about this customer…" value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)} sx={{ px: 2, py: 1.5, fontSize: "14px", color: "var(--text-primary)" }} />
                {noteDraft.trim() && <div className="flex justify-end px-3 pb-2"><Button size="small" variant="contained" onClick={addNote}>Add note</Button></div>}
              </div>
              {notes.map(n => (
                <div key={n.id} className="rounded-xl px-4 py-3 border border-[var(--border-soft)] bg-[var(--serviceops-tint)]">
                  <p className="m-0 text-body text-[var(--text-primary)]">{n.text}</p>
                  <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">{n.author} · {n.at}</p>
                </div>
              ))}
            </div>
          </DetailCard>
          <DetailCard icon={Paperclip} title="Files"
            action={
              <>
                <input ref={fileInput} type="file" multiple hidden onChange={e => {
                  const fl = e.target.files; if (fl?.length) { files.push(...Array.from(fl).map((f, i) => ({ id: `u-${Date.now()}-${i}`, name: f.name, size: formatFileSize(f.size) }))); setVersion(v => v + 1); }
                  e.target.value = "";
                }} />
                <Button size="small" variant="outlined" startIcon={<UploadSimple size={14} weight="bold" />} onClick={() => fileInput.current?.click()}>Attach</Button>
              </>
            }>
            <div className="flex flex-col gap-1">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--serviceops-tint)]">
                  <FileText size={16} color="#EF4444" weight="duotone" />
                  <span className="flex-1 min-w-0 truncate text-body text-[var(--text-primary)]">{f.name}</span>
                  <span className="text-caption text-[var(--text-muted)]">{f.size}</span>
                </div>
              ))}
            </div>
          </DetailCard>
        </div>
      )}

      <NewWorkOrderDrawer open={woOpen} onClose={() => setWoOpen(false)} defaultCustomer={c.name}
        onCreated={wo => { setVersion(v => v + 1); notify(`${wo.number} created`, `/work-orders/${wo.id}`); }} />
      {toastNode}
    </PageShell>
  );
}

