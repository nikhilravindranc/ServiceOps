"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import { Tray, User, Wrench, ListChecks } from "@phosphor-icons/react";
import { PageShell, Breadcrumb, DetailCard, Segmented, useToast } from "@/components/ui/ServiceOpsUI";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { SERVICE_TYPE_ORDER, type JobPriority } from "@/lib/jobsData";
import { CUSTOMERS, primaryContact } from "@/lib/serviceData";
import { WORK_TYPES, WORK_TYPE_INFO, missingDetails, type DetailField, type WorkType } from "@/lib/workTypes";

const SOURCES = ["Phone", "Email", "Web form", "Online booking", "Customer portal", "Technician"];
const EMPTY = {
  customerName: "", contactName: "", phone: "", email: "", site: "", source: "Phone", serviceType: "HVAC", priority: "Medium" as JobPriority,
  title: "", description: "", preferredDate: "", campaign: "",
};

/** The full-page "New request" form. The questions under "Work details" change with the work type. */
export default function RequestForm() {
  const router = useRouter();
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [workType, setWorkType] = useState<WorkType>("Repair");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const names = useMemo(() => CUSTOMERS.map(c => c.name), []);

  const set = (k: keyof typeof EMPTY, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(x => { const n = { ...x }; delete n[k]; return n; }); };
  const setDetail = (k: string, v: string) => { setDetails(d => ({ ...d, [k]: v })); setErrors(x => { const n = { ...x }; delete n[`d:${k}`]; return n; }); };

  /** Picking an existing customer fills in who to contact and where the work is. */
  const pickCustomer = (name: string) => {
    const c = CUSTOMERS.find(x => x.name === name);
    if (!c) { set("customerName", name); return; }
    const p = primaryContact(c.id);
    setForm(f => ({
      ...f, customerName: name, contactName: f.contactName || p?.name || "", phone: f.phone || p?.phone || c.phone || "",
      email: f.email || p?.email || c.email || "", site: f.site || [c.street, c.cityLine].filter(Boolean).join(", "),
    }));
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.customerName.trim().length < 2) e.customerName = "Choose or enter the customer";
    if (form.contactName.trim().length < 2) e.contactName = "Who should we contact?";
    if (!form.phone.trim() && !form.email.trim()) { e.phone = "Add a phone number or an email"; e.email = "Add a phone number or an email"; }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email address";
    if (form.site.trim().length < 3) e.site = "Where is the work? Enter the site address";
    if (form.title.trim().length < 3) e.title = "Summarise the request in a few words";
    for (const label of missingDetails(workType, details)) {
      const f = WORK_TYPE_INFO[workType].fields.find(x => x.label === label)!;
      e[`d:${f.key}`] = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) { notify("Fix the highlighted fields to log the request", undefined, "info"); return; }
    setSaving(true);
    const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, workType, details }) });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { notify(body.error ?? "Could not save the request", undefined, "info"); return; }
    router.push(`/requests/${body.number}`);
  };

  const renderDetail = (f: DetailField) => {
    const err = errors[`d:${f.key}`];
    const label = `${f.label}${f.required ? " *" : ""}`;
    if (f.kind === "select") return (
      <FormControl key={f.key} size="small" fullWidth sx={FX} error={!!err}><InputLabel>{label}</InputLabel>
        <Select label={label} value={details[f.key] ?? ""} onChange={e => setDetail(f.key, String(e.target.value))}>
          {f.options!.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}</Select>
        {err && <FormHelperText>{err}</FormHelperText>}</FormControl>);
    return (
      <div key={f.key} className={f.kind === "textarea" ? "sm:col-span-2" : ""}>
        <TextField label={label} value={details[f.key] ?? ""} onChange={e => setDetail(f.key, e.target.value)}
          type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"} multiline={f.kind === "textarea"} rows={f.kind === "textarea" ? 3 : undefined}
          InputLabelProps={f.kind === "date" ? { shrink: true } : undefined} error={!!err} helperText={err ?? f.hint} size="small" fullWidth sx={FX} />
      </div>);
  };

  return (
    <PageShell>
      <Breadcrumb homeIcon items={[{ label: "Requests", href: "/requests" }, { label: "New request" }]} />
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 sm:text-[22px] font-bold text-[var(--text-primary)]">New request</h1>
        <p className="m-0 text-body text-[var(--text-body)]">Log a call, email or walk-in. Fields marked * are needed before the request can be saved.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <DetailCard icon={User} title="Customer and site">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Autocomplete freeSolo options={names} value={form.customerName} onChange={(_, v) => pickCustomer(v ?? "")} onInputChange={(_, v) => set("customerName", v)}
                  renderInput={p => <TextField {...p} label="Customer *" error={!!errors.customerName} helperText={errors.customerName ?? "Pick an existing customer to fill in their details, or type a new name"} size="small" sx={FX} />} />
              </div>
              <TextField label="Contact person *" value={form.contactName} onChange={e => set("contactName", e.target.value)} error={!!errors.contactName} helperText={errors.contactName} size="small" fullWidth sx={FX} />
              <TextField label="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} error={!!errors.phone} helperText={errors.phone} size="small" fullWidth sx={FX} />
              <div className="sm:col-span-2"><TextField label="Email" type="email" value={form.email} onChange={e => set("email", e.target.value)} error={!!errors.email} helperText={errors.email} size="small" fullWidth sx={FX} /></div>
              <div className="sm:col-span-2"><TextField label="Site address *" value={form.site} onChange={e => set("site", e.target.value)} error={!!errors.site} helperText={errors.site} size="small" fullWidth sx={FX} /></div>
            </div>
          </DetailCard>

          <DetailCard icon={Wrench} title="Type of work">
            <div className="mb-4 overflow-x-auto"><Segmented value={workType} onChange={v => { setWorkType(v); setDetails({}); setErrors({}); }} options={WORK_TYPES.map(t => ({ value: t, label: t }))} /></div>
            <p className="m-0 mb-4 text-body text-[var(--text-muted)]">{WORK_TYPE_INFO[workType].blurb}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><TextField label="Summary *" value={form.title} onChange={e => set("title", e.target.value)} error={!!errors.title} helperText={errors.title ?? "One line, for example: Rooftop unit not cooling on 3rd floor"} size="small" fullWidth sx={FX} /></div>
              <FormControl size="small" fullWidth sx={FX}><InputLabel>Trade</InputLabel>
                <Select label="Trade" value={form.serviceType} onChange={e => set("serviceType", String(e.target.value))}>
                  {SERVICE_TYPE_ORDER.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
              <TextField label="Preferred date" type="date" value={form.preferredDate} onChange={e => set("preferredDate", e.target.value)} InputLabelProps={{ shrink: true }} size="small" fullWidth sx={FX} />
            </div>
          </DetailCard>

          <DetailCard icon={ListChecks} title={`${workType} details`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{WORK_TYPE_INFO[workType].fields.map(renderDetail)}</div>
          </DetailCard>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <DetailCard icon={Tray} title="Handling">
            <div className="grid grid-cols-1 gap-3">
              <FormControl size="small" fullWidth sx={FX}><InputLabel>Priority</InputLabel>
                <Select label="Priority" value={form.priority} onChange={e => set("priority", String(e.target.value))}>
                  {["High", "Medium", "Low"].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
              <FormControl size="small" fullWidth sx={FX}><InputLabel>Received via</InputLabel>
                <Select label="Received via" value={form.source} onChange={e => set("source", String(e.target.value))}>
                  {SOURCES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
              <TextField label="Campaign (optional)" value={form.campaign} onChange={e => set("campaign", e.target.value)} size="small" fullWidth sx={FX} />
              <TextField label="Notes" value={form.description} onChange={e => set("description", e.target.value)} size="small" fullWidth multiline rows={4} sx={FX} />
            </div>
          </DetailCard>
          <div className="flex items-center justify-end gap-2">
            <Button variant="text" onClick={() => router.push("/requests")} sx={{ color: "var(--text-muted)", fontWeight: 600, borderRadius: "9px", px: 2.5 }}>Cancel</Button>
            <Button variant="contained" onClick={submit} disabled={saving}
              sx={{ bgcolor: "var(--serviceops-primary)", color: "#3B1F00", borderRadius: "9px", fontWeight: 700, px: 3, boxShadow: "0 1px 8px 0 rgba(245,158,11,0.35)", "&:hover": { bgcolor: "var(--serviceops-hover)" } }}>
              {saving ? "Saving…" : "Log request"}
            </Button>
          </div>
        </div>
      </div>
      {toastNode}
    </PageShell>
  );
}
