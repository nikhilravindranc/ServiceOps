"use client";
import { useEffect, useState, type ReactNode } from "react";
import Switch from "@mui/material/Switch";
import { UploadSimple, DownloadSimple, ArrowsClockwise, Trash } from "@phosphor-icons/react";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { slugify, addCustomer, addAsset, CUSTOMERS, ASSETS, PARTS, SERVICE_ZONES, JOBS_TODAY_TS, DAY_MS, customerByName, type CustomerType, type ServicePlan, type ServiceZone, type AssetCategory } from "@/lib/serviceData";

const TYPES: CustomerType[] = ["Industrial", "Commercial", "Healthcare", "Hospitality", "Retail", "Residential", "Education", "Public sector"];
const PLANS: ServicePlan[] = ["Gold AMC", "Silver AMC", "Pay per visit"];
const CATS: AssetCategory[] = ["HVAC", "Mechanical", "Plumbing", "Electrical", "Elevator"];

type Kind = "customers" | "assets" | "parts";
const SPEC: Record<Kind, { label: string; headers: string[]; required: string[]; example: string[] }> = {
  customers: { label: "Customers", headers: ["name", "type", "plan", "street", "city", "state", "zip", "phone", "email", "contact name", "contact email", "contact phone", "zone"], required: ["name"], example: ["Riverside Library", "Public sector", "Pay per visit", "12 Main St", "Albany", "NY", "12207", "518-555-0100", "ops@riverside.example", "Sam Lee", "sam@riverside.example", "518-555-0101", "North"] },
  assets: { label: "Assets", headers: ["customer", "name", "category", "manufacturer", "model", "serial", "site", "installed", "warranty until"], required: ["customer", "name", "category"], example: ["Riverside Library", "Rooftop unit 1", "HVAC", "Carrier", "48TC", "SN-1001", "Roof", "2022-05-01", "2027-05-01"] },
  parts: { label: "Parts", headers: ["part no", "name", "category", "unit", "unit cost", "on hand", "reorder point"], required: ["part no", "name"], example: ["AF-SET-30", "Air Filter (Set 30)", "HVAC", "set", "42.5", "20", "5"] },
};

const pill = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-semibold border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--serviceops-tint)]";
const primary = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] hover:bg-[var(--serviceops-hover)] disabled:opacity-50";
const inputCls = "h-9 px-3 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-[var(--serviceops-primary)]";

const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? NaN : Number(v));
const date = (v: string, fallback: number) => { const t = Date.parse(v); return Number.isNaN(t) ? fallback : t; };

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] p-4 mb-4">
      <h3 className="m-0 text-label font-bold text-[var(--text-primary)]">{title}</h3>
      {hint && <p className="m-0 mt-0.5 mb-3 text-caption text-[var(--text-muted)]">{hint}</p>}
      {children}
    </div>
  );
}

export default function DataPanel({ notify }: { notify: (msg: string, href?: string, severity?: "success" | "info") => void }) {
  // ── CSV import
  const [kind, setKind] = useState<Kind>("customers");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const validate = (k: Kind, data: Record<string, string>[]) => {
    const errs: string[] = [];
    data.forEach((r, i) => {
      const line = i + 2;
      for (const c of SPEC[k].required) if (!r[c]) errs.push(`Row ${line}: "${c}" is required`);
      if (k === "assets") {
        if (r.customer && !customerByName(r.customer)) errs.push(`Row ${line}: customer "${r.customer}" does not exist. Import customers first.`);
        if (r.category && !CATS.includes(r.category as AssetCategory)) errs.push(`Row ${line}: category must be one of ${CATS.join(", ")}`);
      }
      if (k === "parts") {
        if (r["unit cost"] && Number.isNaN(num(r["unit cost"]))) errs.push(`Row ${line}: unit cost must be a number`);
        if (r["on hand"] && Number.isNaN(num(r["on hand"]))) errs.push(`Row ${line}: on hand must be a number`);
        if (r["part no"] && PARTS.some(p => p.partNo === r["part no"])) errs.push(`Row ${line}: part ${r["part no"]} already exists`);
      }
      if (k === "customers" && r.name && CUSTOMERS.some(c => c.id === slugify(r.name))) errs.push(`Row ${line}: customer "${r.name}" already exists`);
    });
    return errs;
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    const { headers, rows: data } = parseCsv(await file.text());
    const missing = SPEC[kind].required.filter(c => !headers.includes(c));
    if (missing.length) { setRows([]); setProblems([`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template for the expected columns.`]); return; }
    if (data.length > 2000) { setRows([]); setProblems(["Import up to 2,000 rows at a time."]); return; }
    setRows(data); setProblems(validate(kind, data));
  };

  const reset = () => { setRows([]); setProblems([]); setFileName(""); };

  const runImport = () => {
    setBusy(true);
    let n = 0;
    for (const r of rows) {
      if (kind === "customers") {
        addCustomer({
          name: r.name, type: TYPES.includes(r.type as CustomerType) ? (r.type as CustomerType) : "Commercial",
          plan: PLANS.includes(r.plan as ServicePlan) ? (r.plan as ServicePlan) : "Pay per visit",
          street: r.street ?? "", city: r.city ?? "", state: r.state ?? "", zip: r.zip ?? "", phone: r.phone ?? "", email: r.email ?? "",
          contactName: r["contact name"] ?? "", contactTitle: "", contactEmail: r["contact email"] ?? "", contactPhone: r["contact phone"] ?? "",
          zone: (SERVICE_ZONES as readonly string[]).includes(r.zone) ? (r.zone as ServiceZone) : "Central",
        });
      } else if (kind === "assets") {
        addAsset({
          customer: customerByName(r.customer)!.name, name: r.name, category: r.category as AssetCategory, manufacturer: r.manufacturer ?? "", model: r.model ?? "",
          serialNumber: r.serial ?? "", site: r.site ?? "", installedOn: date(r.installed, JOBS_TODAY_TS - 365 * DAY_MS), warrantyUntil: date(r["warranty until"], JOBS_TODAY_TS + 365 * DAY_MS),
        });
      } else {
        PARTS.unshift({ partNo: r["part no"], name: r.name, category: r.category || "General", unit: r.unit || "ea", unitCost: Number.isNaN(num(r["unit cost"])) ? 0 : num(r["unit cost"]), onHand: Number.isNaN(num(r["on hand"])) ? 0 : num(r["on hand"]), reserved: 0, reorderPoint: Number.isNaN(num(r["reorder point"])) ? 0 : num(r["reorder point"]), techStock: {} });
      }
      n++;
    }
    notify(`Imported ${n} ${SPEC[kind].label.toLowerCase()}. They are saved with your workspace.`);
    reset(); setBusy(false);
  };

  const importable = rows.length > 0 && problems.length === 0;

  // ── Workspace data
  const resetWorkspace = async (mode: "sample" | "empty") => {
    const msg = mode === "empty"
      ? "Remove all customers, work orders, jobs, assets, parts and invoices? Requests, catalog and users are kept. This cannot be undone."
      : "Replace your current data with the built-in sample data? Your own changes to customers, work orders and jobs will be lost.";
    if (!window.confirm(msg)) return;
    const res = await fetch("/api/workspace/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    if (!res.ok) { notify(res.status === 403 ? "Only administrators can reset the workspace" : "Could not reset the workspace", undefined, "info"); return; }
    window.location.reload();
  };

  // ── Online booking
  const [org, setOrg] = useState<{ slug: string | null; bookingEnabled: boolean; arrivalWindowMins: number } | null>(null);
  const [slug, setSlug] = useState("");
  const [win, setWin] = useState("120");
  const [geo, setGeo] = useState({ lat: "", lng: "", radius: "200" });
  useEffect(() => { fetch("/api/org").then(r => r.json()).then(o => { setOrg(o); setSlug(o.slug ?? ""); setWin(String(o.arrivalWindowMins ?? 120)); setGeo({ lat: o.geoLat != null ? String(o.geoLat) : "", lng: o.geoLng != null ? String(o.geoLng) : "", radius: String(o.geoRadiusM ?? 200) }); }).catch(() => {}); }, []);
  const saveOrg = async (patch: object) => {
    const res = await fetch("/api/org", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { notify(data.error ?? "Could not save", undefined, "info"); return; }
    setOrg(data); setSlug(data.slug ?? ""); notify("Saved");
  };
  const saveGeo = (clear = false) => {
    if (clear) { setGeo({ lat: "", lng: "", radius: "200" }); saveOrg({ geoLat: null, geoLng: null, geoRadiusM: null }); return; }
    const lat = Number(geo.lat), lng = Number(geo.lng), radius = Number(geo.radius);
    if (geo.lat === "" || geo.lng === "" || Number.isNaN(lat) || Number.isNaN(lng) || !(radius >= 50)) { notify("Enter a latitude, a longitude and a radius of at least 50 metres", undefined, "info"); return; }
    saveOrg({ geoLat: lat, geoLng: lng, geoRadiusM: Math.round(radius) });
  };
  const useHere = () => navigator.geolocation?.getCurrentPosition(p => setGeo(g => ({ ...g, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) })), () => notify("Could not read your location", undefined, "info"));
  const bookingUrl = org?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/book/${org.slug}` : "";

  return (
    <div>
      <Card title="Online booking" hint="A public page where customers request service. Each booking arrives in Requests as an online booking to verify.">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Switch checked={!!org?.bookingEnabled} disabled={!org?.slug} onChange={(_, v) => saveOrg({ bookingEnabled: v })} inputProps={{ "aria-label": "Online booking enabled" }}
            sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#F59E0B" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#F59E0B" } }} />
          <span className="text-body">{org?.bookingEnabled ? "Accepting bookings" : org?.slug ? "Turned off" : "Choose a page address first"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-caption text-[var(--text-muted)]">/book/</span>
          <input aria-label="Booking page address" className={`${inputCls} w-[220px]`} value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="your-company" />
          <button type="button" className={pill} onClick={() => saveOrg({ slug })}>Save address</button>
          {bookingUrl && org?.bookingEnabled && <a className="text-[13px] font-semibold text-blue-600" href={bookingUrl} target="_blank" rel="noreferrer">Open page</a>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="arrival-win" className="text-body">Arrival window</label>
          <select id="arrival-win" className={inputCls} value={win} onChange={e => setWin(e.target.value)}>{[60, 90, 120, 180, 240].map(m => <option key={m} value={m}>{m / 60} hour{m === 60 ? "" : "s"}</option>)}</select>
          <button type="button" className={pill} onClick={() => saveOrg({ arrivalWindowMins: Number(win) })}>Save</button>
          <span className="text-caption text-[var(--text-muted)]">Length of the window promised to customers, e.g. 9:00 to 11:00</span>
        </div>
      </Card>

      <Card title="Time clock work area" hint="Optional. Clock-ins and clock-outs from outside this circle are flagged for a manager. People can still clock in.">
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Latitude" className={`${inputCls} w-[130px]`} placeholder="Latitude" value={geo.lat} onChange={e => setGeo({ ...geo, lat: e.target.value })} />
          <input aria-label="Longitude" className={`${inputCls} w-[130px]`} placeholder="Longitude" value={geo.lng} onChange={e => setGeo({ ...geo, lng: e.target.value })} />
          <input aria-label="Radius in metres" className={`${inputCls} w-[110px]`} placeholder="Radius (m)" value={geo.radius} onChange={e => setGeo({ ...geo, radius: e.target.value })} />
          <button type="button" className={pill} onClick={useHere}>Use my location</button>
          <button type="button" className={primary} onClick={() => saveGeo()}>Save</button>
          <button type="button" className={pill} onClick={() => saveGeo(true)}>Turn off</button>
        </div>
      </Card>

      <Card title="Import from CSV" hint="Bring customers, assets and parts from a spreadsheet. Import customers before their assets.">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select aria-label="What to import" className={inputCls} value={kind} onChange={e => { setKind(e.target.value as Kind); reset(); }}>
            {(Object.keys(SPEC) as Kind[]).map(k => <option key={k} value={k}>{SPEC[k].label}</option>)}
          </select>
          <button type="button" className={pill} onClick={() => downloadCsv(`${kind}-template.csv`, SPEC[kind].headers, SPEC[kind].example)}><DownloadSimple size={15} />Template</button>
          <label className={`${pill} cursor-pointer`}><UploadSimple size={15} />Choose CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
          {fileName && <span className="text-caption text-[var(--text-muted)]">{fileName} · {rows.length} row{rows.length === 1 ? "" : "s"}</span>}
        </div>
        {problems.length > 0 && (
          <ul className="m-0 mb-3 pl-5 text-[12.5px] text-red-600 max-h-40 overflow-auto">{problems.slice(0, 20).map(p => <li key={p}>{p}</li>)}{problems.length > 20 && <li>…and {problems.length - 20} more</li>}</ul>
        )}
        {importable && (
          <div className="mb-3 text-[12.5px] text-[var(--text-body)]">
            Ready to import {rows.length}. First rows: {rows.slice(0, 3).map(r => r.name || r["part no"]).join(", ")}{rows.length > 3 ? "…" : ""}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className={primary} disabled={!importable || busy} onClick={runImport}>Import {importable ? rows.length : ""}</button>
          {(rows.length > 0 || problems.length > 0) && <button type="button" className={pill} onClick={reset}>Clear</button>}
        </div>
      </Card>

      <Card title="Workspace data" hint="Controls the customers, work orders, jobs, assets, parts and invoices in this workspace.">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={pill} onClick={() => resetWorkspace("sample")}><ArrowsClockwise size={15} />Reset to sample data</button>
          <button type="button" className={`${pill} !text-red-600`} onClick={() => resetWorkspace("empty")}><Trash size={15} />Remove all sample data</button>
        </div>
        <p className="m-0 mt-2 text-caption text-[var(--text-muted)]">The technician roster and service-type settings are built in and are not removed.</p>
      </Card>
    </div>
  );
}
