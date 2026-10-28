"use client";
import { useEffect, useMemo, useState } from "react";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { ClipboardText } from "@phosphor-icons/react";
import { SideDrawer, DrawerSection, DrawerActions } from "@/components/ui/ServiceOpsUI";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { SERVICE_TYPE_ORDER, type JobPriority, type ServiceType } from "@/lib/jobsData";
import {
  CUSTOMERS, contactsFor, assetsFor, addWorkOrder, customerByName,
  type WorkOrder, type WOSource,
} from "@/lib/serviceData";

const PRIORITIES: JobPriority[] = ["High", "Medium", "Low"];
const SOURCES: WOSource[] = ["Phone", "Email", "Customer portal", "Service contract", "Technician"];
const MI = { fontSize: "0.84rem" };

const EMPTY = {
  customer: "", contactId: "", assetId: "" as number | "", title: "", serviceType: "" as ServiceType | "",
  priority: "Medium" as JobPriority, description: "", preferred: "", source: "Phone" as WOSource, needsEstimate: false,
};

/** Capture a service request. Field execution (jobs) is created later, from Dispatch or the work order. */
export default function NewWorkOrderDrawer({ open, onClose, onCreated, defaultCustomer, defaultAssetId }: {
  open: boolean; onClose: () => void; onCreated: (wo: WorkOrder) => void; defaultCustomer?: string; defaultAssetId?: number;
}) {
  const FX = useJobFieldSx();
  const [form, setForm] = useState({ ...EMPTY, customer: defaultCustomer ?? "" });
  // Each opening starts from the caller's context (customer page, asset row …).
  useEffect(() => {
    if (open) setForm({ ...EMPTY, customer: defaultCustomer ?? "", assetId: defaultAssetId ?? "" });
  }, [open, defaultCustomer, defaultAssetId]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const cust = customerByName(form.customer);
  const contacts = useMemo(() => (cust ? contactsFor(cust.id) : []), [cust]);
  const assets = useMemo(() => (cust ? assetsFor(cust.id) : []), [cust]);

  const close = () => { setForm({ ...EMPTY, customer: defaultCustomer ?? "" }); setErrors({}); onClose(); };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!cust) e.customer = "Choose a customer";
    if (!form.title.trim()) e.title = "Describe the request in a few words";
    if (!form.serviceType) e.serviceType = "Service type is required";
    setErrors(e);
    if (Object.keys(e).length) return;
    const wo = addWorkOrder({
      title: form.title, customer: form.customer, contactId: form.contactId, serviceType: form.serviceType as ServiceType,
      priority: form.priority, description: form.description, assetId: form.assetId === "" ? null : form.assetId,
      preferredDate: form.preferred ? new Date(form.preferred).getTime() : null, source: form.source, needsEstimate: form.needsEstimate,
    });
    onCreated(wo);
    close();
  };

  return (
    <SideDrawer open={open} onClose={close} icon={ClipboardText} title="New work order"
      subtitle="Log a service request — schedule the field visit from Dispatch"
      footer={<DrawerActions onCancel={close} onSubmit={submit} submitLabel="Create work order" />}>
      <DrawerSection title="Customer">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Autocomplete options={CUSTOMERS.map(c => c.name)} value={form.customer || null}
              onChange={(_, v) => { setForm(f => ({ ...f, customer: v ?? "", contactId: "", assetId: "" })); setErrors(x => { const n = { ...x }; delete n.customer; return n; }); }}
              renderInput={p => <TextField {...p} label="Customer *" size="small" error={!!errors.customer} helperText={errors.customer} sx={FX} />} />
          </div>
          <FormControl size="small" fullWidth disabled={!cust} sx={FX}>
            <InputLabel>Requested by</InputLabel>
            <Select label="Requested by" value={form.contactId} onChange={e => set("contactId", e.target.value)}>
              {contacts.map(c => <MenuItem key={c.id} value={c.id} sx={MI}>{c.name} · {c.title}</MenuItem>)}
            </Select>
            {!cust && <FormHelperText>Select a customer first</FormHelperText>}
          </FormControl>
          <FormControl size="small" fullWidth disabled={!cust} sx={FX}>
            <InputLabel>Asset</InputLabel>
            <Select label="Asset" value={form.assetId} onChange={e => set("assetId", e.target.value as number | "")}>
              <MenuItem value="" sx={{ ...MI, color: "var(--text-muted)" }}><em>Not equipment-specific</em></MenuItem>
              {assets.map(a => <MenuItem key={a.id} value={a.id} sx={MI}>{a.name} · {a.model}</MenuItem>)}
            </Select>
          </FormControl>
        </div>
      </DrawerSection>

      <DrawerSection title="Request">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <TextField label="What needs doing? *" placeholder="e.g. Hydraulic pressure loss on CNC press" value={form.title}
              onChange={e => set("title", e.target.value)} error={!!errors.title} helperText={errors.title} size="small" fullWidth sx={FX} />
          </div>
          <FormControl size="small" fullWidth error={!!errors.serviceType} sx={FX}>
            <InputLabel>Service type *</InputLabel>
            <Select label="Service type *" value={form.serviceType} onChange={e => set("serviceType", e.target.value as ServiceType)}>
              {SERVICE_TYPE_ORDER.map(t => <MenuItem key={t} value={t} sx={MI}>{t}</MenuItem>)}
            </Select>
            {errors.serviceType && <FormHelperText>{errors.serviceType}</FormHelperText>}
          </FormControl>
          <FormControl size="small" fullWidth sx={FX}>
            <InputLabel>Priority</InputLabel>
            <Select label="Priority" value={form.priority} onChange={e => set("priority", e.target.value as JobPriority)}>
              {PRIORITIES.map(p => <MenuItem key={p} value={p} sx={MI}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <div className="sm:col-span-2">
            <TextField label="Description" placeholder="Symptoms, when it started, impact on the customer" value={form.description}
              onChange={e => set("description", e.target.value)} size="small" fullWidth multiline rows={3} sx={FX} />
          </div>
          <TextField label="Preferred visit" type="datetime-local" value={form.preferred} onChange={e => set("preferred", e.target.value)}
            size="small" fullWidth InputLabelProps={{ shrink: true }} sx={FX} />
          <FormControl size="small" fullWidth sx={FX}>
            <InputLabel>Received via</InputLabel>
            <Select label="Received via" value={form.source} onChange={e => set("source", e.target.value as WOSource)}>
              {SOURCES.map(s => <MenuItem key={s} value={s} sx={MI}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <div className="sm:col-span-2">
            <FormControlLabel
              control={<Checkbox size="small" checked={form.needsEstimate} onChange={e => set("needsEstimate", e.target.checked)}
                sx={{ "&.Mui-checked": { color: "var(--serviceops-primary)" } }} />}
              label={<span className="text-body text-[var(--text-primary)]">Customer must approve an estimate before work is scheduled</span>} />
          </div>
        </div>
      </DrawerSection>
    </SideDrawer>
  );
}
