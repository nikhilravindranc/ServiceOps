"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, WarningCircle, Crown, Medal, ClipboardText } from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, KpiTile, KpiRow, ListCard, DataTable, Pill, Stack, ActionMenu, useToast, Segmented, type Column,
} from "@/components/ui/ServiceOpsUI";
import { dueVisits, generateMaintenance, type DueVisit } from "@/lib/recurring";
import { CUSTOMERS, fmtDay, JOBS_TODAY_TS, DAY_MS } from "@/lib/serviceData";

const HORIZONS = [{ value: "30", label: "Next 30 days" }, { value: "60", label: "Next 60 days" }, { value: "90", label: "Next 90 days" }];

export default function PlansPage() {
  const router = useRouter();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const [horizon, setHorizon] = useState("30");
  const [open, setOpen] = useState<"all" | "todo">("todo");

  const all = useMemo(() => dueVisits(Number(horizon)), [horizon, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = open === "todo" ? all.filter(v => !v.existing) : all;
  const overdue = all.filter(v => v.daysLate > 0);
  const gold = CUSTOMERS.filter(c => c.plan === "Gold AMC").length;
  const silver = CUSTOMERS.filter(c => c.plan === "Silver AMC").length;

  const generate = (visits: DueVisit[]) => {
    const made = generateMaintenance(visits);
    setVersion(v => v + 1);
    notify(made.length ? `${made.length} scheduled-maintenance work order${made.length === 1 ? "" : "s"} raised` : "Nothing to raise: every due asset already has a work order", made.length === 1 ? `/work-orders/${made[0].id}` : undefined, made.length ? "success" : "info");
  };

  const columns: Column<DueVisit>[] = [
    { key: "asset", header: "Asset", sortValue: v => v.asset.name, cell: v => <Stack top={v.asset.name} bottom={`${v.asset.assetNo} · ${v.asset.site}`} /> },
    { key: "customer", header: "Customer", sortValue: v => v.asset.customer, cell: v => <span className="text-table-cell">{v.asset.customer}</span> },
    { key: "plan", header: "Plan", cell: v => <Pill tone={v.plan === "Gold AMC" ? "amber" : "gray"} dot={false}>{v.plan}</Pill> },
    { key: "last", header: "Last service", hideBelow: "xl", cell: v => <span className="text-table-cell">{v.lastService ? fmtDay(v.lastService) : "Never"}</span> },
    { key: "due", header: "Due", sortValue: v => v.dueOn, cell: v => <Stack top={fmtDay(v.dueOn)} bottom={v.daysLate > 0 ? `${v.daysLate} days overdue` : `in ${-v.daysLate} days`} /> },
    { key: "state", header: "Work order", cell: v => v.existing
      ? <button type="button" className="text-table-cell font-semibold text-blue-600" onClick={() => router.push(`/work-orders/${v.existing!.id}`)}>{v.existing.number}</button>
      : <Pill tone="amber">Not raised</Pill> },
    { key: "actions", header: "Actions", align: "right", cell: v => (
      <span onClick={e => e.stopPropagation()}>
        <ActionMenu label={`Actions for ${v.asset.name}`} actions={[
          { label: "Raise work order", icon: ClipboardText, disabled: !!v.existing, onClick: () => generate([v]) },
          { label: "Open asset", icon: CalendarCheck, onClick: () => router.push(`/assets/${v.asset.id}`) },
        ]} />
      </span>) },
  ];

  return (
    <PageShell>
      <PageHeader title="Service plans" subtitle="Scheduled maintenance generated from Gold and Silver plans." crumbs={[{ label: "Records" }, { label: "Service plans" }]}
        actions={<PrimaryButton icon={ClipboardText} onClick={() => generate(rows)}>Raise all due ({rows.filter(v => !v.existing).length})</PrimaryButton>} />
      <KpiRow cols="xl:grid-cols-4">
        <KpiTile label="Gold customers" value={gold} tone="amber" icon={Crown} />
        <KpiTile label="Silver customers" value={silver} tone="gray" icon={Medal} />
        <KpiTile label="Due in window" value={all.length} tone="blue" icon={CalendarCheck} />
        <KpiTile label="Overdue" value={overdue.length} tone="red" icon={WarningCircle} />
      </KpiRow>
      <div className="flex flex-wrap gap-3 mb-3">
        <Segmented value={horizon} onChange={setHorizon} options={HORIZONS} />
        <Segmented value={open} onChange={setOpen} options={[{ value: "todo", label: "Not raised", count: all.filter(v => !v.existing).length }, { value: "all", label: "All due", count: all.length }]} />
      </div>
      <ListCard>
        <DataTable columns={columns} rows={rows} pageSize={10} noun="visits" rowKey={v => v.asset.id} minWidth={900}
          empty={{ icon: CalendarCheck, title: "No maintenance due", hint: "Assets on Gold or Silver plans appear here as their next visit approaches" }} />
      </ListCard>
      <p className="mt-3 text-caption text-[var(--text-muted)]">Gold plans visit each asset at its maintenance interval; Silver plans at twice that interval. Today in the sample data is {fmtDay(JOBS_TODAY_TS)}; window ends {fmtDay(JOBS_TODAY_TS + Number(horizon) * DAY_MS)}.</p>
      {toastNode}
    </PageShell>
  );
}
