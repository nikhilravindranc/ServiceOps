"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@mui/material/Button";
import {
  Cube, Buildings, ClockCounterClockwise, Wrench, Package, Paperclip, CalendarBlank, ShieldCheck, MapPin, Key, Gauge,
  ClipboardText, Plus, UploadSimple, FileText, ArrowRight, Pulse, CheckCircle, WarningCircle, Clock, Phone, UserCircle,
} from "@phosphor-icons/react";
import {
  PageShell, Breadcrumb, DetailTabs, DetailCard, Field, IconField, EmptyState, MiniTable, Pill, DetailPrimaryButton,
  SecondaryButton, EditButton, ActionMenu, useToast, PriorityTag,
} from "@/components/ui/ServiceOpsUI";
import { ASSET_STATUS_TONE, WARRANTY_TONE, STOCK_TONE } from "@/components/assets/assetShared";
import { WO_STATUS_TONE, JobStatusPill } from "@/components/workorders/woShared";
import NewWorkOrderDrawer from "@/components/workorders/NewWorkOrderDrawer";
import { ALL_JOBS, formatFileSize, type JobRecord } from "@/lib/jobsData";
import {
  assetById, assetStatus, assetLastService, assetNextService, warrantyState, historyForAsset, customerById, primaryContact,
  WORK_ORDERS, woStatus, SERVICE_PRICING, partByName, available, techStockTotal, stockState, fmtDate, relDay, money,
  JOBS_TODAY_TS, DAY_MS,
} from "@/lib/serviceData";

const TABS = ["overview", "history", "jobs", "parts", "files"] as const;
type Tab = typeof TABS[number];

const ASSET_FILES: Record<number, { id: string; name: string; size: string }[]> = {};

export default function AssetDetail({ assetId }: { assetId: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>(() => (TABS as readonly string[]).includes(params.get("tab") ?? "") ? params.get("tab") as Tab : "overview");
  const [woOpen, setWoOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const a = useMemo(() => assetById(assetId), [assetId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) {
    return (
      <PageShell>
        <div className="py-24 text-center">
          <p className="m-0 mb-2 text-h1 text-[var(--text-primary)]">Asset not found</p>
          <Link href="/assets" className="text-body underline text-[var(--text-primary)]">Back to Assets</Link>
        </div>
      </PageShell>
    );
  }

  const status = assetStatus(a);
  const warranty = warrantyState(a);
  const last = assetLastService(a);
  const next = assetNextService(a);
  const visits = historyForAsset(a.id);
  const customer = customerById(a.customerId);
  const contact = primaryContact(a.customerId);
  const jobs = a.jobIds.map(id => ALL_JOBS.find(j => j.id === id)).filter((j): j is JobRecord => !!j).sort((x, y) => y.scheduledAt - x.scheduledAt);
  const openJobs = jobs.filter(j => !["Completed", "Cancelled"].includes(j.status));
  const wos = WORK_ORDERS.filter(w => w.assetId === a.id);
  const openWOs = wos.filter(w => !["Completed", "Cancelled", "Scheduled", "In progress"].includes(woStatus(w)));
  const yearVisits = visits.filter(v => v.date > JOBS_TODAY_TS - 365 * DAY_MS);
  const ftf = yearVisits.length ? Math.round((yearVisits.filter(v => v.firstTimeFix).length / yearVisits.length) * 100) : null;
  const overdue = next.at < JOBS_TODAY_TS - DAY_MS / 2;
  const files = ASSET_FILES[a.id] ?? (ASSET_FILES[a.id] = [
    { id: "m", name: `${a.model} — service manual.pdf`, size: "4.2 MB" },
    { id: "w", name: "Warranty certificate.pdf", size: "180 KB" },
    { id: "c", name: "Commissioning report.pdf", size: "640 KB" },
  ]);

  // Parts: what this asset has consumed, and what its type usually needs.
  const used = new Map<string, number>();
  visits.forEach(v => v.partsUsed.forEach(p => used.set(p.item, (used.get(p.item) ?? 0) + p.qty)));
  const typical = SERVICE_PRICING[a.category].parts.map(p => p.item);
  const extraForPress = a.name === "CNC Hydraulic Press" ? ["Hydraulic Pump Assembly", "Hydraulic Seal Kit", "Hydraulic Oil ISO VG 46 (20L)"] : [];
  const partNames = Array.from(new Set([...extraForPress, ...typical, ...Array.from(used.keys())]));

  // A single chronological strip: upcoming visit, open requests, then history.
  const timeline = [
    ...openJobs.map(j => ({ key: `j${j.id}`, date: j.scheduledAt, title: `${j.jobName}`, meta: `${j.jobId} · ${j.technician}`, href: `/jobs/${j.id}`, tone: "blue" as const, tag: j.status })),
    ...openWOs.map(w => ({ key: `w${w.id}`, date: w.requestedAt, title: w.title, meta: `${w.number} · requested`, href: `/work-orders/${w.id}`, tone: "amber" as const, tag: woStatus(w) })),
    ...visits.slice(0, 6).map(v => ({ key: v.id, date: v.date, title: v.summary, meta: `${v.jobRef} · ${v.technician}`, href: "", tone: (v.outcome === "Follow-up required" ? "amber" : "green") as "amber" | "green", tag: v.outcome })),
  ].sort((x, y) => y.date - x.date);

  const tabs = [
    { key: "overview" as Tab, label: "Overview" },
    { key: "history" as Tab, label: "Service history", count: visits.length },
    { key: "jobs" as Tab, label: "Jobs & requests", count: jobs.length + openWOs.length },
    { key: "parts" as Tab, label: "Parts" },
    { key: "files" as Tab, label: "Attachments", count: files.length },
  ];

  return (
    <PageShell>
      <Breadcrumb homeIcon items={[{ label: "Assets", href: "/assets" }, { label: a.assetNo }]} />

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-h1 sm:text-[22px] font-bold text-[var(--text-primary)]">{a.name}</h1>
          <Pill tone={ASSET_STATUS_TONE[status]}>{status}</Pill>
        </div>
        <p className="m-0 text-body text-[var(--text-body)]">
          {a.assetNo} · {a.manufacturer !== a.model.split(" ")[0] ? `${a.manufacturer} ` : ""}{a.model} · S/N {a.serialNumber} · <Link href={`/customers/${a.customerId}`} className="hover:text-blue-600 hover:underline">{a.customer}</Link>
        </p>
      </div>

      <DetailTabs label="Asset sections" tabs={tabs} active={tab} onChange={setTab}
        actions={
          <>
            <DetailPrimaryButton icon={Plus} onClick={() => setWoOpen(true)}>Raise work order</DetailPrimaryButton>
            {next.jobId && <SecondaryButton icon={Wrench} href={`/jobs/${next.jobId}`}>Next visit</SecondaryButton>}
            <ActionMenu variant="page" actions={[
              { label: "Service history", icon: ClockCounterClockwise, onClick: () => setTab("history") },
              { label: "Parts for this asset", icon: Package, onClick: () => setTab("parts") },
              { label: "Attach document", icon: Paperclip, onClick: () => { setTab("files"); setTimeout(() => fileInput.current?.click(), 50); } },
            ]} />
          </>
        } />

      {/* ═════ OVERVIEW ═════ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            {/* Condition at a glance — the four facts a service lead asks first */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Last service", value: last ? fmtDate(last) : "—", meta: last ? relDay(last) : "No visits yet", alert: false },
                { label: "Next service", value: fmtDate(next.at), meta: next.jobId ? "Visit booked" : overdue ? "PM overdue" : `PM every ${a.pmIntervalDays} days`, alert: overdue },
                { label: "Visits · 12 months", value: String(yearVisits.length), meta: `${openJobs.length} open job${openJobs.length === 1 ? "" : "s"}`, alert: false },
                { label: "First-time fix", value: ftf === null ? "—" : `${ftf}%`, meta: "last 12 months", alert: ftf !== null && ftf < 75 },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-3" style={{ boxShadow: "0 1px 2px rgba(17,17,17,0.04)" }}>
                  <p className="m-0 text-caption text-[var(--text-muted)]">{s.label}</p>
                  <p className={`m-0 text-h1 font-bold ${s.alert ? "text-[#EF4444]" : "text-[var(--text-primary)]"}`}>{s.value}</p>
                  <p className="m-0 text-caption text-[var(--text-muted)]">{s.meta}</p>
                </div>
              ))}
            </div>

            <DetailCard icon={Cube} title="Asset details">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-y-5">
                <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[135px_minmax(0,1fr)] gap-x-4 gap-y-4 items-start sm:pl-2 lg:pr-6">
                  <Field label="Asset #">{a.assetNo}</Field>
                  <Field label="Equipment">{a.name} · {a.category}</Field>
                  <Field label="Manufacturer">{a.manufacturer}</Field>
                  <Field label="Model">{a.model}</Field>
                  <Field label="Serial number"><span className="text-[13px]">{a.serialNumber}</span></Field>
                  <Field label="Asset tag">{a.tag}</Field>
                </dl>
                <dl className="m-0 flex flex-col gap-5 border-t border-[var(--border-soft)] pt-5 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6 sm:pl-2">
                  <IconField icon={MapPin} label="Location" labelClass="text-caption">{a.site}</IconField>
                  <IconField icon={CalendarBlank} label="Installed" labelClass="text-caption">{fmtDate(a.installedOn)}</IconField>
                  <IconField icon={ShieldCheck} label="Warranty" labelClass="text-caption"><Pill tone={WARRANTY_TONE[warranty]}>{warranty === "Expired" ? `Expired ${fmtDate(a.warrantyUntil)}` : `Until ${fmtDate(a.warrantyUntil)}`}</Pill></IconField>
                  <IconField icon={Gauge} label="Service plan" labelClass="text-caption">{a.plan}</IconField>
                  <IconField icon={Pulse} label="Status" labelClass="text-caption"><Pill tone={ASSET_STATUS_TONE[status]}>{status}</Pill></IconField>
                </dl>
              </div>
            </DetailCard>

            <DetailCard icon={ClockCounterClockwise} title="Service timeline" action={<EditButton icon={ArrowRight} label="Full history" onClick={() => setTab("history")} />}>
              {timeline.length === 0 ? <EmptyState icon={ClockCounterClockwise} text="No service recorded yet" /> : (
                <ol className="m-0 p-0 list-none">
                  {timeline.map((t, i) => {
                    const upcoming = t.date >= JOBS_TODAY_TS - DAY_MS / 2;
                    const body = (
                      <>
                        <p className="m-0 text-body text-[var(--text-primary)]">{t.title}</p>
                        <p className="m-0 text-caption text-[var(--text-muted)]">{t.meta}</p>
                      </>
                    );
                    return (
                      <li key={t.key} className="flex gap-3 sm:gap-4">
                        <span className="w-20 sm:w-24 flex-shrink-0 text-right pt-0.5 text-caption text-[var(--text-muted)]">{fmtDate(t.date).replace(/, \d{4}$/, "")}<br />{new Date(t.date).getFullYear()}</span>
                        <span className="flex flex-col items-center flex-shrink-0">
                          <span className={`w-3 h-3 mt-1 rounded-full border-2 ${upcoming ? "border-blue-600 bg-[var(--bg-card)]" : t.tone === "amber" ? "border-[#F59E0B] bg-[#F59E0B]" : "border-[#16A34A] bg-[#16A34A]"}`} />
                          {i < timeline.length - 1 && <span className="w-px flex-1 my-1 min-h-[22px] bg-[var(--border)]" />}
                        </span>
                        <div className="pb-4 flex-1 min-w-0 flex items-start justify-between gap-3">
                          <div className="min-w-0">{t.href ? <Link href={t.href} className="block hover:[&_p:first-child]:text-blue-600">{body}</Link> : body}</div>
                          <Pill tone={t.tone === "blue" ? "blue" : t.tone} dot={false}>{t.tag}</Pill>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </DetailCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 min-w-0">
            <DetailCard icon={Buildings} title="Customer & site" action={<EditButton icon={ArrowRight} label="View" onClick={() => router.push(`/customers/${a.customerId}`)} />}>
              <p className="m-0 text-label font-bold text-[var(--text-primary)]">{a.customer}</p>
              <p className="m-0 text-body text-[var(--text-body)]">{customer?.street}, {customer?.cityLine}</p>
              <dl className="m-0 mt-4 flex flex-col gap-2.5">
                <IconField icon={MapPin} label="On site">{a.site}</IconField>
                <IconField icon={UserCircle} label="Contact">{contact?.name ?? "—"}</IconField>
                <IconField icon={Phone} label="Phone">{contact ? <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:underline">{contact.phone}</a> : "—"}</IconField>
              </dl>
              {customer?.accessNotes && (
                <div className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 bg-[var(--serviceops-tint)]">
                  <Key size={16} className="mt-0.5 flex-shrink-0 text-[var(--text-muted)]" />
                  <p className="m-0 text-body text-[var(--text-body)]">{customer.accessNotes}</p>
                </div>
              )}
            </DetailCard>

            <DetailCard icon={Pulse} title="Open work">
              {openJobs.length === 0 && openWOs.length === 0 ? (
                <EmptyState icon={CheckCircle} text="Nothing open on this asset" action={<Button size="small" variant="outlined" startIcon={<Plus size={14} />} onClick={() => setWoOpen(true)}>Raise work order</Button>} />
              ) : (
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {openWOs.map(w => (
                    <li key={`w${w.id}`}>
                      <Link href={`/work-orders/${w.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-soft)] px-3 py-2.5 hover:border-[var(--serviceops-primary)]">
                        <span className="min-w-0"><span className="block text-caption font-semibold text-blue-600">{w.number}</span><span className="block text-body text-[var(--text-primary)]">{w.title}</span></span>
                        <Pill tone={WO_STATUS_TONE[woStatus(w)]}>{woStatus(w)}</Pill>
                      </Link>
                    </li>
                  ))}
                  {openJobs.map(j => (
                    <li key={`j${j.id}`}>
                      <Link href={`/jobs/${j.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-soft)] px-3 py-2.5 hover:border-[var(--serviceops-primary)]">
                        <span className="min-w-0"><span className="block text-caption font-semibold text-blue-600">{j.jobId}</span><span className="block text-body text-[var(--text-primary)]">{j.jobName}</span><span className="block text-caption text-[var(--text-muted)]">{j.scheduledDate} · {j.technician}</span></span>
                        <JobStatusPill status={j.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DetailCard>

            {(warranty !== "In warranty" || status === "Needs attention") && (
              <DetailCard icon={WarningCircle} title="Watch">
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {status === "Needs attention" && <li className="flex items-start gap-2 rounded-xl px-3 py-2 bg-[rgba(245,158,11,0.10)]"><WarningCircle size={16} weight="fill" color="#F59E0B" className="mt-0.5" /><span className="text-body text-[var(--text-primary)]">Reported fault awaiting a field visit.</span></li>}
                  {warranty === "Expiring soon" && <li className="flex items-start gap-2 rounded-xl px-3 py-2 bg-[rgba(245,158,11,0.10)]"><ShieldCheck size={16} weight="fill" color="#F59E0B" className="mt-0.5" /><span className="text-body text-[var(--text-primary)]">Warranty ends {fmtDate(a.warrantyUntil)} — raise any claims before then.</span></li>}
                  {warranty === "Expired" && <li className="flex items-start gap-2 rounded-xl px-3 py-2 bg-[var(--serviceops-tint)]"><Clock size={16} className="mt-0.5 text-[var(--text-muted)]" /><span className="text-body text-[var(--text-body)]">Out of warranty — parts and labour are billable{a.plan !== "Pay per visit" ? ` unless covered by ${a.plan}` : ""}.</span></li>}
                </ul>
              </DetailCard>
            )}
          </div>
        </div>
      )}

      {/* ═════ HISTORY ═════ */}
      {tab === "history" && (
        <DetailCard icon={ClockCounterClockwise} title="Maintenance & service history">
          {visits.length === 0 ? <EmptyState icon={ClockCounterClockwise} text="No completed visits yet" /> : (
            <MiniTable head={["Date", "Job #", "Work done", "Technician", "Parts used", { label: "Labour", right: true }, "Outcome"]} minWidth={980}>
              {visits.map(v => (
                <tr key={v.id}>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(v.date)}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{v.jobRef}</td>
                  <td className="px-4 text-table-cell text-[var(--text-primary)]">{v.summary}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{v.technician}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)]">{v.partsUsed.length ? v.partsUsed.map(p => `${p.item} × ${p.qty}`).join(", ") : "—"}</td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-body)] whitespace-nowrap">{v.labourHrs} h</td>
                  <td className="px-4"><Pill tone={v.outcome === "Follow-up required" ? "amber" : "green"}>{v.outcome}</Pill></td>
                </tr>
              ))}
            </MiniTable>
          )}
        </DetailCard>
      )}

      {/* ═════ JOBS & REQUESTS ═════ */}
      {tab === "jobs" && (
        <div className="grid grid-cols-1 gap-4">
          <DetailCard icon={Wrench} title="Jobs">
            {jobs.length === 0 ? <EmptyState icon={Wrench} text="No jobs in the current schedule" /> : (
              <MiniTable head={["Job #", "Job name", "Technician", "Scheduled", "Status"]} minWidth={640}>
                {jobs.map(j => (
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
          <DetailCard icon={ClipboardText} title="Work orders" action={<Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={() => setWoOpen(true)}>Raise work order</Button>}>
            {wos.length === 0 ? <EmptyState icon={ClipboardText} text="No work orders reference this asset" /> : (
              <MiniTable head={["Work order #", "Title", "Priority", "Requested", "Status"]} minWidth={640}>
                {wos.map(w => (
                  <tr key={w.id} className="cursor-pointer" onClick={() => router.push(`/work-orders/${w.id}`)}>
                    <td className="px-4 text-table-cell font-semibold text-blue-600 whitespace-nowrap">{w.number}</td>
                    <td className="px-4 text-table-cell text-[var(--text-primary)]">{w.title}</td>
                    <td className="px-4"><PriorityTag priority={w.priority} /></td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(w.requestedAt)}</td>
                    <td className="px-4"><Pill tone={WO_STATUS_TONE[woStatus(w)]}>{woStatus(w)}</Pill></td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </DetailCard>
        </div>
      )}

      {/* ═════ PARTS ═════ */}
      {tab === "parts" && (
        <DetailCard icon={Package} title="Parts for this asset">
          <MiniTable head={["Part", "Part number", { label: "Used on this asset", right: true }, { label: "Available", right: true }, { label: "In vans", right: true }, "Stock", { label: "Unit cost", right: true }]} minWidth={860}>
            {partNames.map(name => {
              const p = partByName(name);
              const st = p ? stockState(p) : null;
              return (
                <tr key={name} className={p ? "cursor-pointer" : ""} onClick={() => p && router.push(`/inventory?part=${encodeURIComponent(p.partNo)}`)}>
                  <td className="px-4 text-table-cell text-[var(--text-primary)]">{name}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{p?.partNo ?? "—"}</td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{used.get(name) ?? 0}</td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-primary)] font-semibold">{p ? available(p) : "—"}</td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{p ? techStockTotal(p) : "—"}</td>
                  <td className="px-4">{st && <Pill tone={STOCK_TONE[st]}>{st}</Pill>}</td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{p ? money(p.unitCost) : "—"}</td>
                </tr>
              );
            })}
          </MiniTable>
          <p className="m-0 mt-3 px-2 text-caption text-[var(--text-muted)]">Typical parts for {a.category.toLowerCase()} equipment plus anything fitted on past visits. Select a part to see stock and open requests in Inventory.</p>
        </DetailCard>
      )}

      {/* ═════ ATTACHMENTS ═════ */}
      {tab === "files" && (
        <DetailCard icon={Paperclip} title="Attachments"
          action={
            <>
              <input ref={fileInput} type="file" multiple hidden onChange={e => {
                const fl = e.target.files;
                if (fl?.length) { files.push(...Array.from(fl).map((f, i) => ({ id: `u${Date.now()}${i}`, name: f.name, size: formatFileSize(f.size) }))); setVersion(v => v + 1); notify(`${fl.length} file${fl.length > 1 ? "s" : ""} attached`); }
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
      )}

      <NewWorkOrderDrawer open={woOpen} onClose={() => setWoOpen(false)} defaultCustomer={a.customer} defaultAssetId={a.id}
        onCreated={wo => { setVersion(v => v + 1); notify(`${wo.number} raised for ${a.name}`, `/work-orders/${wo.id}`); }} />
      {toastNode}
    </PageShell>
  );
}
