/**
 * ServiceOps domain dataset — Customers, Contacts, Assets, Work Orders,
 * service history, Parts and Billing — layered on top of the Jobs dataset in
 * `jobsData.ts` so every record links to the same customers, technicians and
 * jobs the Jobs list and Job Details screens already show.
 *
 * Like `jobsData`, everything is session-scoped and in memory: no backend.
 */
import {
  ALL_JOBS, CUSTOMER_DIRECTORY, CUSTOMER_LOCATIONS, JOBS_TODAY, JOB_EXTRAS, PRODUCT_MODELS, TECHNICIANS,
  TECHNICIAN_AVATARS, TECHNICIAN_PHONES, TECHNICIAN_TITLES, SLA_HOURS_BY_SERVICE, createJob, updateJob,
  getWorkspace, logActivity, technicianEmail,
  type JobRecord, type JobPriority, type ServiceType, type JobStatus,
} from "@/lib/jobsData";

// ─────────────────────────────────────────────
//  Formatting + deterministic helpers
// ─────────────────────────────────────────────
export const DAY_MS = 24 * 3600 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TODAY = JOBS_TODAY.getTime();
/** The dataset's "today" (shared with the Jobs list date presets). */
export const JOBS_TODAY_TS = TODAY;

/** "Sep 24, 2024" */
export const fmtDate = (t: number | Date) => {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
/** "Sep 24" */
export const fmtDay = (t: number | Date) => {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
/** "09:30 AM" — same clock format as the Jobs list. */
export const fmtTime = (t: number | Date) => {
  const d = new Date(t);
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
};
/** "Today", "Tomorrow", "3 days ago", "in 5 days" relative to the dataset's today. */
export const relDay = (t: number) => {
  const start = new Date(t); start.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - TODAY) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
};
export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Stable pseudo-random integer in [0, mod) for a seed. */
const rnd = (seed: number, mod: number) => Math.abs(Math.imul(seed * 2654435761 + 1013904223, 1597334677) >> 3) % mod;
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const day = (offset: number, hour = 9, minute = 0) =>
  new Date(JOBS_TODAY.getFullYear(), JOBS_TODAY.getMonth(), JOBS_TODAY.getDate() + offset, hour, minute).getTime();
/** The dataset's clock: 10:15 AM on its "today" — the moment the seeded job statuses describe
    (one technician on site since 9:00, another en route to a 10:30 visit). Each call ticks a
    second forward so actions logged in one session keep their order. */
export const DATASET_CLOCK = day(0, 10, 15);
let clockTicks = 0;
export const datasetNow = () => DATASET_CLOCK + (clockTicks++) * 1000;

/** datetime-local value ("2024-09-24T13:30") for the Jobs dataset's create/edit inputs. */
export const toLocalInput = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const SERVICE_ZONES = ["North", "South", "East", "West", "Central"] as const;
export type ServiceZone = typeof SERVICE_ZONES[number];

// ─────────────────────────────────────────────
//  Pricing — mirrors the per-service-type templates
//  on Job Details so amounts agree across screens.
// ─────────────────────────────────────────────
export interface PriceLine { item: string; qty: number; rate: number }
export const SERVICE_PRICING: Record<ServiceType, { labor: number; durationHrs: number; parts: PriceLine[] }> = {
  HVAC:       { labor: 2200, durationHrs: 3, parts: [{ item: "Air Filter (Set)", qty: 2, rate: 600 }, { item: "Duct Sealant", qty: 1, rate: 450 }, { item: "Fan Belt", qty: 1, rate: 750 }] },
  Mechanical: { labor: 1800, durationHrs: 3, parts: [{ item: "Engine Oil (4L)", qty: 1, rate: 1400 }, { item: "Air Filter", qty: 1, rate: 900 }, { item: "Battery Terminal", qty: 2, rate: 350 }] },
  Plumbing:   { labor: 800,  durationHrs: 2, parts: [{ item: "PVC Pipe (5ft)", qty: 2, rate: 300 }, { item: "Pipe Joint", qty: 4, rate: 120 }, { item: "Sealant Tape", qty: 2, rate: 80 }] },
  Electrical: { labor: 1000, durationHrs: 2, parts: [{ item: "MCB Switch", qty: 2, rate: 850 }, { item: "Wiring Cable (10m)", qty: 1, rate: 1100 }, { item: "Circuit Breaker", qty: 1, rate: 1600 }] },
  Preventive: { labor: 900,  durationHrs: 2, parts: [{ item: "Service Kit", qty: 1, rate: 1500 }] },
  Elevator:   { labor: 2000, durationHrs: 3, parts: [{ item: "Door Sensor", qty: 1, rate: 1800 }, { item: "Guide Shoe Liner", qty: 4, rate: 250 }, { item: "Lubricant", qty: 1, rate: 400 }] },
};

/** Job total exactly as Job Details computes it (labour + parts + 18% tax − discount). */
export function jobCharges(job: JobRecord) {
  const p = SERVICE_PRICING[job.serviceType];
  const parts = [...p.parts, ...getWorkspace(job.id).extraParts];
  const partsTotal = parts.reduce((s, x) => s + x.qty * x.rate, 0);
  const labor = job.id === 1 ? 1200 : p.labor;
  const discount = job.id === 1 ? 325 : job.id % 4 === 0 ? 150 : 0;
  const tax = Math.round((labor + partsTotal) * 0.18);
  return { labor, partsTotal, tax, discount, total: labor + partsTotal + tax - discount, parts };
}

// ─────────────────────────────────────────────
//  Customers + contacts
// ─────────────────────────────────────────────
export type CustomerType = "Industrial" | "Commercial" | "Healthcare" | "Hospitality" | "Retail" | "Residential" | "Education" | "Public sector";
export type CustomerStatus = "Active" | "On hold" | "Inactive";
export type ServicePlan = "Gold AMC" | "Silver AMC" | "Pay per visit";

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  status: CustomerStatus;
  plan: ServicePlan;
  location: string;
  street: string;
  cityLine: string;
  territory: string;
  zone: ServiceZone;
  phone: string;
  email: string;
  customerSince: string;
  paymentTerms: "Net 15" | "Net 30" | "Net 45";
  accountManager: string;
  accessNotes: string;
}

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  primary: boolean;
  /** What this person is responsible for on the service relationship. */
  roles: string[];
}

const CUSTOMER_PROFILE: Record<string, { type: CustomerType; plan: ServicePlan; since: string; status: CustomerStatus; zone: ServiceZone; access: string }> = {
  "ABC Manufacturing":       { type: "Industrial",    plan: "Gold AMC",      since: "Mar 2019", status: "Active",  zone: "North",   access: "Check in at Gate 2. Hard hat and safety glasses required on the plant floor." },
  "Global Electronics":      { type: "Industrial",    plan: "Silver AMC",    since: "Jan 2021", status: "Active",  zone: "South",   access: "Visitor badge from main reception. ESD footwear in assembly areas." },
  "City Facilities":         { type: "Public sector", plan: "Gold AMC",      since: "Aug 2017", status: "Active",  zone: "Central", access: "Service entrance on Chambers St. Escort required above level 3." },
  "Riverside Office":        { type: "Commercial",    plan: "Silver AMC",    since: "Jun 2020", status: "Active",  zone: "North",   access: "Loading dock open 7 AM – 6 PM. Building engineer on site." },
  "Metro Hospital":          { type: "Healthcare",    plan: "Gold AMC",      since: "Feb 2016", status: "Active",  zone: "East",    access: "Report to Facilities office B1. No work in OR corridors without clearance." },
  "Sunrise Retail":          { type: "Retail",        plan: "Pay per visit", since: "Oct 2022", status: "Active",  zone: "South",   access: "Work before 10 AM store opening where possible." },
  "Lakeside Resort":         { type: "Hospitality",   plan: "Silver AMC",    since: "May 2018", status: "On hold", zone: "East",    access: "Park in staff lot. Contact duty manager on arrival." },
  "Pinnacle Apartments":     { type: "Residential",   plan: "Gold AMC",      since: "Sep 2019", status: "Active",  zone: "West",    access: "Super has machine-room keys. Notify residents 24h before elevator outages." },
  "Harbor View Hotel":       { type: "Hospitality",   plan: "Silver AMC",    since: "Apr 2021", status: "Active",  zone: "South",   access: "Use service elevator only. Quiet hours 10 PM – 7 AM." },
  "Summit Tech Park":        { type: "Commercial",    plan: "Gold AMC",      since: "Nov 2018", status: "Active",  zone: "North",   access: "Badge issued at Building A security desk." },
  "Greenfield School":       { type: "Education",     plan: "Silver AMC",    since: "Jul 2020", status: "Active",  zone: "North",   access: "Background-checked staff only during school hours." },
  "Northgate Mall":          { type: "Retail",        plan: "Gold AMC",      since: "Mar 2017", status: "Active",  zone: "West",    access: "Mall operations office, lower level near Entrance C." },
  "Brookside Clinic":        { type: "Healthcare",    plan: "Pay per visit", since: "Jan 2023", status: "Active",  zone: "East",    access: "Patient areas — minimise noise, coordinate with front desk." },
  "Oakwood Residences":      { type: "Residential",   plan: "Pay per visit", since: "Aug 2023", status: "Inactive",zone: "Central", access: "Gate code issued per visit by property manager." },
  "Acme Industrial Systems": { type: "Industrial",    plan: "Gold AMC",      since: "Mar 2024", status: "Active",  zone: "South",   access: "Plant 2 receiving dock. Lock-out/tag-out mandatory on press line." },
};

const ACCOUNT_MANAGERS = ["Alex Morgan", "Grace Liu"];
const EXTRA_CONTACT_NAMES = [
  "Hannah Brooks", "Victor Alvarez", "Sandra Liu", "Owen Fitzgerald", "Carla Mendes", "Jamal Wright", "Erin Walsh",
  "Philip Osei", "Monica Reyes", "Gavin Price", "Tara Singh", "Leo Martins", "Ruth Coleman", "Ian Doyle",
];
const EXTRA_CONTACT_TITLES = [
  { title: "Accounts Payable",     roles: ["Billing", "Invoices"] },
  { title: "Site Supervisor",      roles: ["Site access", "Sign-off"] },
  { title: "Operations Director",  roles: ["Approves estimates", "Escalations"] },
];

function buildCustomers() {
  const customers: Customer[] = [];
  const contacts: Contact[] = [];

  const names = [...Object.keys(CUSTOMER_LOCATIONS), "Acme Industrial Systems"];
  names.forEach((name, i) => {
    const id = slugify(name);
    const profile = CUSTOMER_PROFILE[name];
    const dir = CUSTOMER_DIRECTORY[name];
    const isAcme = name === "Acme Industrial Systems";
    const location = isAcme ? "Edison, NJ" : CUSTOMER_LOCATIONS[name];
    customers.push({
      id, name,
      type: profile.type, status: profile.status, plan: profile.plan,
      location,
      street: isAcme ? "2200 Route 1 South, Plant 2" : dir?.street ?? "",
      cityLine: isAcme ? "Edison, NJ 08817" : dir?.cityLine ?? location,
      territory: isAcme ? "Mid-Atlantic" : dir?.territory ?? "North East",
      zone: profile.zone,
      phone: isAcme ? "+1 732 555 0148" : dir?.phone ?? "—",
      email: isAcme ? "maintenance@acme-industrial.com" : dir?.email ?? "",
      customerSince: profile.since,
      paymentTerms: profile.plan === "Pay per visit" ? "Net 15" : i % 3 === 0 ? "Net 45" : "Net 30",
      accountManager: ACCOUNT_MANAGERS[i % 2],
      accessNotes: profile.access,
    });

    // Primary contact (the person already shown on Job Details), then 1–2 more.
    const primaryName = isAcme ? "Michael Carter" : dir?.contactPerson ?? "Facilities desk";
    const domain = (isAcme ? "maintenance@acme-industrial.com" : dir?.email ?? `x@${id}.com`).split("@")[1];
    contacts.push({
      id: `${id}-c1`, customerId: id, name: primaryName,
      title: isAcme ? "Maintenance Manager" : "Facilities Manager",
      email: isAcme ? "michael.carter@acme-industrial.com" : dir?.email ?? "",
      phone: isAcme ? "+1 732 555 0148" : dir?.phone ?? "—",
      primary: true, roles: ["Service requests", "Site access"],
    });
    const extras = isAcme ? 2 : 1 + (i % 2);
    for (let k = 0; k < extras; k++) {
      const cname = isAcme ? (k === 0 ? "Lisa Romero" : "Raj Patel") : EXTRA_CONTACT_NAMES[(i + k * 5) % EXTRA_CONTACT_NAMES.length];
      const t = EXTRA_CONTACT_TITLES[(i + k) % EXTRA_CONTACT_TITLES.length];
      const [first, last] = cname.toLowerCase().split(" ");
      contacts.push({
        id: `${id}-c${k + 2}`, customerId: id, name: cname, title: t.title,
        email: `${first}.${last}@${domain}`,
        phone: `+1 ${isAcme ? "732" : "212"} 555 ${String(310 + i * 11 + k * 3).padStart(4, "0")}`,
        primary: false, roles: t.roles,
      });
    }
  });
  return { customers, contacts };
}

const built = buildCustomers();
export const CUSTOMERS: Customer[] = built.customers;
export const CONTACTS: Contact[] = built.contacts;
export const customerById = (id: string) => CUSTOMERS.find(c => c.id === id);
export const customerByName = (name: string) => CUSTOMERS.find(c => c.name === name);
export const customerHref = (name: string) => `/customers/${slugify(name)}`;
export const contactsFor = (customerId: string) => CONTACTS.filter(c => c.customerId === customerId);
export const primaryContact = (customerId: string) => CONTACTS.find(c => c.customerId === customerId && c.primary);

// ─────────────────────────────────────────────
//  Assets
// ─────────────────────────────────────────────
export type AssetStatus = "Operational" | "Needs attention" | "Under service" | "Out of service";
export type AssetCategory = Exclude<ServiceType, "Preventive">;

export interface Asset {
  id: number;
  assetNo: string;
  name: string;
  category: AssetCategory;
  customerId: string;
  customer: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  tag: string;
  site: string;
  installedOn: number;
  warrantyUntil: number;
  plan: ServicePlan;
  /** Preventive-maintenance interval in days. */
  pmIntervalDays: number;
  statusOverride?: AssetStatus;
  jobIds: number[];
}

const PRODUCT_SITES = ["Roof", "Basement", "Level 2", "Mechanical Room"];
const MAKERS = ["A.O. Smith", "Square D", "Ingersoll Rand", "Atlas Copco"];

function assetKind(category: AssetCategory, model: string): { name: string; prefix: string } {
  if (category === "HVAC") return { name: "Rooftop HVAC Unit", prefix: "RTU" };
  if (category === "Elevator") return { name: "Passenger Elevator", prefix: "ELV" };
  if (category === "Electrical") return model.includes("Breaker") ? { name: "Main Breaker", prefix: "MB" } : { name: "Distribution Panel", prefix: "DP" };
  if (category === "Plumbing") {
    if (model.includes("Heater")) return { name: "Water Heater", prefix: "WH" };
    if (model.includes("Backflow")) return { name: "Backflow Preventer", prefix: "BFP" };
    return { name: "Booster Pump", prefix: "PMP" };
  }
  return model.includes("Generator") || model.includes("Kohler") ? { name: "Standby Generator", prefix: "GEN" } : { name: "Air Compressor", prefix: "CMP" };
}

/** Job Details' "Location" row for a job — reused so an asset reads the same on both screens. */
const jobSite = (jobId: number) => jobId === 1 ? "Building A - Roof" : `Building ${"ABCD"[jobId % 4]} - ${PRODUCT_SITES[jobId % PRODUCT_SITES.length]}`;

function buildAssets(): Asset[] {
  const assets: Asset[] = [];
  const byKey: Record<string, Asset> = {};
  let n = 0;

  const make = (customer: string, category: AssetCategory, firstJobId: number | null, seed: number): Asset => {
    const models = PRODUCT_MODELS[category];
    const model = models[rnd(seed * 7 + category.length, models.length)];
    const kind = assetKind(category, model);
    n += 1;
    const installedOn = day(-(400 + rnd(seed * 13, 2200)));
    const plan = CUSTOMER_PROFILE[customer]?.plan ?? "Pay per visit";
    const asset: Asset = {
      id: n,
      assetNo: `AST-${String(1000 + n)}`,
      name: kind.name,
      category,
      customerId: slugify(customer),
      customer,
      manufacturer: MAKERS.find(m => model.startsWith(m)) ?? model.split(" ")[0],
      model,
      serialNumber: `${kind.prefix}${model.replace(/[^A-Z0-9]/g, "").slice(0, 3)}-${21 + rnd(seed, 4)}${String(1000 + rnd(seed * 31, 8999))}`,
      tag: `${kind.prefix}-${String(1 + (n % 9)).padStart(2, "0")}`,
      site: firstJobId ? jobSite(firstJobId) : `Building ${"ABCD"[seed % 4]} - ${PRODUCT_SITES[seed % 4]}`,
      installedOn,
      warrantyUntil: installedOn + (2 + rnd(seed * 3, 3)) * 365 * DAY_MS,
      plan,
      pmIntervalDays: category === "Elevator" ? 30 : category === "HVAC" ? 90 : 180,
      jobIds: [],
    };
    assets.push(asset);
    return asset;
  };

  // Equipment jobs first so preventive visits can attach to a real asset.
  const ordered = [...ALL_JOBS].sort((a, b) => Number(a.serviceType === "Preventive") - Number(b.serviceType === "Preventive") || a.id - b.id);
  for (const job of ordered) {
    let asset: Asset | undefined;
    if (job.serviceType === "Preventive") {
      asset = assets.find(a => a.customer === job.customer);
      if (!asset) asset = byKey[`${job.customer}|HVAC`] = make(job.customer, "HVAC", job.id, job.id);
    } else {
      const key = `${job.customer}|${job.serviceType}`;
      asset = byKey[key] ?? (byKey[key] = make(job.customer, job.serviceType as AssetCategory, job.id, job.id));
    }
    asset.jobIds.push(job.id);
  }

  // The showcase job keeps the exact product identity Job Details was authored with.
  const showcase = assets.find(a => a.jobIds.includes(1));
  if (showcase) {
    Object.assign(showcase, { model: "Carrier WeatherMaker 48TC", manufacturer: "Carrier", serialNumber: "A-1001", tag: "RTU-01", site: "Building A - Roof" });
  }

  // Acme Industrial Systems — new customer, no field visits yet this season.
  const acme = "Acme Industrial Systems";
  const press = make(acme, "Mechanical", null, 482);
  Object.assign(press, {
    name: "CNC Hydraulic Press", manufacturer: "Brennan Hydraulics", model: "HP-450", serialNumber: "HP450-240318",
    tag: "PRS-02", site: "Plant 2 - Press Line B", installedOn: new Date(2024, 2, 18).getTime(),
    warrantyUntil: new Date(2026, 2, 18).getTime(), pmIntervalDays: 90, statusOverride: "Needs attention" as AssetStatus,
  });
  const hpu = make(acme, "Mechanical", null, 483);
  Object.assign(hpu, { name: "Hydraulic Power Unit", manufacturer: "Brennan Hydraulics", model: "HPU-30", serialNumber: "HPU30-240322", tag: "HPU-01", site: "Plant 2 - Press Line B", installedOn: new Date(2024, 2, 22).getTime(), warrantyUntil: new Date(2026, 2, 22).getTime() });
  const comp = make(acme, "Mechanical", null, 484);
  Object.assign(comp, { name: "Plant Air Compressor", manufacturer: "Atlas", model: "Atlas Copco GA 30", tag: "CMP-01", site: "Plant 2 - Utility Room" });

  // A few assets with no jobs this period, so the register isn't just "things with jobs".
  const idle: [string, AssetCategory][] = [
    ["Metro Hospital", "Electrical"], ["Summit Tech Park", "Elevator"], ["Harbor View Hotel", "HVAC"],
    ["Northgate Mall", "Plumbing"], ["Greenfield School", "Electrical"], ["City Facilities", "Elevator"],
  ];
  idle.forEach(([c, cat], i) => {
    const key = `${c}|${cat}`;
    if (!byKey[key]) byKey[key] = make(c, cat, null, 600 + i * 17);
  });
  const oos = assets.find(a => a.customer === "Lakeside Resort");
  if (oos) oos.statusOverride = "Out of service";

  return assets;
}

export const ASSETS: Asset[] = buildAssets();
export const assetById = (id: number) => ASSETS.find(a => a.id === id);

export function addAsset(input: {
  customer: string; name: string; category: AssetCategory; manufacturer: string; model: string; serialNumber: string;
  site: string; installedOn: number; warrantyUntil: number;
}): Asset {
  const id = ASSETS.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  const asset: Asset = {
    id, assetNo: `AST-${1000 + id}`, name: input.name.trim(), category: input.category,
    customerId: slugify(input.customer), customer: input.customer,
    manufacturer: input.manufacturer.trim(), model: input.model.trim(), serialNumber: input.serialNumber.trim(),
    tag: `${input.category.slice(0, 3).toUpperCase()}-${String(id % 100).padStart(2, "0")}`,
    site: input.site.trim(), installedOn: input.installedOn, warrantyUntil: input.warrantyUntil,
    plan: CUSTOMER_PROFILE[input.customer]?.plan ?? "Pay per visit",
    pmIntervalDays: input.category === "Elevator" ? 30 : input.category === "HVAC" ? 90 : 180, jobIds: [],
  };
  ASSETS.unshift(asset);
  return asset;
}
export const assetForJob = (jobId: number) => ASSETS.find(a => a.jobIds.includes(jobId));
export const assetsFor = (customerId: string) => ASSETS.filter(a => a.customerId === customerId);

// Job Details reads product model/serial from JOB_EXTRAS when present — seed
// them from the asset register so both screens name the same equipment.
for (const job of ALL_JOBS) {
  if (JOB_EXTRAS[job.id]) continue;
  const a = assetForJob(job.id);
  if (!a) continue;
  JOB_EXTRAS[job.id] = { jobTitle: "", description: "", scheduleStart: "", scheduleEnd: "", productModel: a.model, serialNumber: a.serialNumber, notes: "" };
}

// ─────────────────────────────────────────────
//  Service history (completed visits before the
//  current scheduling window — archived jobs).
// ─────────────────────────────────────────────
export type VisitOutcome = "Resolved" | "Parts replaced" | "Follow-up required";
export interface ServiceVisit {
  id: string;
  jobRef: string;
  assetId: number;
  customer: string;
  date: number;
  serviceType: ServiceType;
  summary: string;
  technician: string;
  outcome: VisitOutcome;
  firstTimeFix: boolean;
  responseHrs: number;
  labourHrs: number;
  partsUsed: { item: string; qty: number }[];
  amount: number;
}

const VISIT_SUMMARY: Record<AssetCategory, string[]> = {
  HVAC:       ["Quarterly PM — filters, belts and coil clean", "Compressor short-cycling — contactor replaced", "Refrigerant top-up and leak test", "Thermostat recalibrated, airflow balanced"],
  Mechanical: ["Oil and filter service, belt tension adjusted", "Pressure switch replaced", "Load test passed — logged readings", "Seal leak on cylinder — kit replaced"],
  Plumbing:   ["Pump seal replaced, pressure normalised", "Leak traced to joint — re-sealed", "Annual backflow certification", "Anode rod and thermostat replaced"],
  Electrical: ["Thermal scan — two hot joints re-torqued", "Breaker tripping — faulty MCB replaced", "Annual panel inspection", "Emergency lighting test"],
  Elevator:   ["Monthly safety inspection", "Door sensor realigned", "Guide shoes replaced, rails lubricated", "Leveling adjustment after callout"],
};

function buildHistory(): ServiceVisit[] {
  const visits: ServiceVisit[] = [];
  let ref = 10120;
  for (const a of ASSETS) {
    const count = a.customer === "Acme Industrial Systems" ? (a.name === "CNC Hydraulic Press" ? 2 : 1) : 2 + rnd(a.id * 5, 3);
    for (let k = 0; k < count; k++) {
      const seed = a.id * 17 + k * 7;
      const offset = -(4 + k * Math.max(30, Math.round(a.pmIntervalDays * 0.9)) + rnd(seed, 25));
      if (a.customer === "Acme Industrial Systems" && offset < -190) continue;
      const pricing = SERVICE_PRICING[a.category];
      const partsUsed = pricing.parts.filter((_, i) => rnd(seed + i, 3) !== 0).map(p => ({ item: p.item, qty: p.qty }));
      const partsCost = partsUsed.reduce((s, p) => s + p.qty * (pricing.parts.find(x => x.item === p.item)?.rate ?? 0), 0);
      const isPress = a.name === "CNC Hydraulic Press";
      const outcome: VisitOutcome = isPress ? "Resolved" : rnd(seed, 9) === 0 ? "Follow-up required" : partsUsed.length ? "Parts replaced" : "Resolved";
      const summaries = VISIT_SUMMARY[a.category];
      ref += 1 + rnd(seed, 3);
      visits.push({
        id: `v-${a.id}-${k}`,
        jobRef: `JOB-${ref}`,
        assetId: a.id,
        customer: a.customer,
        date: day(offset, 9 + rnd(seed, 6)),
        serviceType: a.category,
        summary: isPress ? (k === 0 ? "Quarterly PM — pressure 205 bar nominal, seals OK" : "Commissioning check after installation") : summaries[rnd(seed * 3, summaries.length)],
        technician: TECHNICIANS[rnd(seed * 11, TECHNICIANS.length)],
        outcome,
        firstTimeFix: outcome !== "Follow-up required",
        responseHrs: 1 + rnd(seed * 19, 6),
        labourHrs: pricing.durationHrs - (rnd(seed, 2) ? 0.5 : 0),
        partsUsed: isPress ? [] : partsUsed,
        amount: Math.round((pricing.labor * 0.6 + partsCost) * 1.18),
      });
    }
  }
  return visits.sort((x, y) => y.date - x.date);
}

export const SERVICE_HISTORY: ServiceVisit[] = buildHistory();
export const historyForAsset = (assetId: number) => SERVICE_HISTORY.filter(v => v.assetId === assetId);
export const historyForCustomer = (name: string) => SERVICE_HISTORY.filter(v => v.customer === name);

export function assetLastService(a: Asset): number | null {
  // Some seeded "Completed" jobs sit after the dataset's today — only past work counts as service done.
  const done = a.jobIds.map(id => ALL_JOBS.find(j => j.id === id)).filter((j): j is JobRecord => !!j && j.status === "Completed" && j.scheduledAt <= TODAY + DAY_MS).map(j => j.scheduledAt);
  const past = historyForAsset(a.id).map(v => v.date);
  const all = [...done, ...past];
  return all.length ? Math.max(...all) : null;
}

export function assetNextService(a: Asset): { at: number; jobId?: number } {
  const upcoming = a.jobIds
    .map(id => ALL_JOBS.find(j => j.id === id))
    .filter((j): j is JobRecord => !!j && !["Completed", "Cancelled"].includes(j.status))
    .sort((x, y) => x.scheduledAt - y.scheduledAt)[0];
  if (upcoming) return { at: upcoming.scheduledAt, jobId: upcoming.id };
  const last = assetLastService(a) ?? a.installedOn;
  return { at: last + a.pmIntervalDays * DAY_MS };
}

export function assetStatus(a: Asset): AssetStatus {
  if (a.statusOverride) return a.statusOverride;
  const jobs = a.jobIds.map(id => ALL_JOBS.find(j => j.id === id)).filter((j): j is JobRecord => !!j);
  if (jobs.some(j => j.status === "Incomplete" || j.slaBreached)) return "Needs attention";
  if (jobs.some(j => j.status === "On site" || j.status === "En route")) return "Under service";
  return "Operational";
}

export type WarrantyState = "In warranty" | "Expiring soon" | "Expired";
export function warrantyState(a: Asset): WarrantyState {
  if (a.warrantyUntil < TODAY) return "Expired";
  if (a.warrantyUntil - TODAY < 90 * DAY_MS) return "Expiring soon";
  return "In warranty";
}

// ─────────────────────────────────────────────
//  Work orders
// ─────────────────────────────────────────────
export type WOStatus = "New" | "Awaiting approval" | "Ready to schedule" | "Scheduled" | "In progress" | "Completed" | "Cancelled";
export const WO_STATUS_ORDER: WOStatus[] = ["New", "Awaiting approval", "Ready to schedule", "Scheduled", "In progress", "Completed", "Cancelled"];
export type WOSource = "Phone" | "Email" | "Customer portal" | "Service contract" | "Technician";

export interface WorkOrder {
  id: number;
  number: string;
  title: string;
  customer: string;
  customerId: string;
  contactId: string;
  serviceType: ServiceType;
  priority: JobPriority;
  /** Only used while no job exists — once jobs are linked, status follows them. */
  baseStatus: WOStatus;
  source: WOSource;
  requestedAt: number;
  preferredDate: number | null;
  description: string;
  assetId: number | null;
  site: string;
  zone: ServiceZone;
  jobIds: number[];
  createdBy: string;
  notes: { id: string; text: string; author: string; at: string }[];
  attachments: { id: string; name: string; size: string }[];
  activity: { label: string; at: number }[];
}

const REQUEST_TEXT: Record<ServiceType, string[]> = {
  HVAC:       ["Rooftop unit running but space temperature holding at 78°F on upper floors. Tenants reporting discomfort since Monday.", "Scheduled seasonal maintenance under the service agreement: filters, belts, coil cleaning and performance check."],
  Mechanical: ["Compressor tripping on high temperature during the afternoon shift. Production impacted for ~40 minutes per trip.", "Annual generator service and load test required before insurance inspection."],
  Plumbing:   ["Water pooling near the booster pump skid; suspected seal or joint leak. Area cordoned off.", "Low water pressure reported on upper floors during peak hours."],
  Electrical: ["Breaker on sub-panel DP-2 tripping intermittently under load. Lighting circuits affected.", "Annual electrical safety inspection and thermal scan required for compliance."],
  Preventive: ["Contracted preventive maintenance visit — inspect, clean, test and report per checklist.", "Quarterly PM visit under AMC. Customer asked for a condition report on all major equipment."],
  Elevator:   ["Car doors reopening repeatedly on floor 3. Residents reporting delays.", "Monthly statutory safety inspection due. Certificate renewal in 45 days."],
};

const WO_SOURCES: WOSource[] = ["Phone", "Email", "Customer portal", "Service contract", "Technician"];

function woStatusFromJob(s: JobStatus): WOStatus {
  if (s === "Completed") return "Completed";
  if (s === "Cancelled") return "Cancelled";
  if (s === "En route" || s === "On site" || s === "Incomplete") return "In progress";
  return "Scheduled";
}

const parseStamp = (stamp: string) => {
  const t = Date.parse(stamp);
  return Number.isNaN(t) ? TODAY : t;
};

function buildWorkOrders(): WorkOrder[] {
  const wos: WorkOrder[] = [];
  const jobs = [...ALL_JOBS].sort((a, b) => a.id - b.id);
  jobs.forEach((job, i) => {
    const asset = assetForJob(job.id);
    const cust = customerByName(job.customer);
    const text = REQUEST_TEXT[job.serviceType];
    const requestedAt = parseStamp(job.createdAt) - (1 + (i % 3)) * 3600 * 1000;
    wos.push({
      id: i + 1,
      number: `WO-2024-${String(410 + i).padStart(5, "0")}`,
      title: job.jobName.charAt(0).toUpperCase() + job.jobName.slice(1),
      customer: job.customer,
      customerId: slugify(job.customer),
      contactId: `${slugify(job.customer)}-c1`,
      serviceType: job.serviceType,
      priority: job.priority,
      baseStatus: "Scheduled",
      source: job.serviceType === "Preventive" ? "Service contract" : WO_SOURCES[rnd(job.id * 3, 3)],
      requestedAt,
      preferredDate: job.scheduledAt,
      description: job.id === 1 ? (JOB_EXTRAS[1]?.description ?? text[0]) : text[job.id % text.length],
      assetId: asset?.id ?? null,
      site: asset?.site ?? (cust ? `${cust.street}, ${cust.cityLine}` : job.location),
      zone: (job.region as ServiceZone) ?? "Central",
      jobIds: [job.id],
      createdBy: i % 3 === 0 ? "Grace Liu" : i % 3 === 1 ? "Priya Raman" : "Alex Morgan",
      notes: [],
      attachments: [{ id: `wa-${i}-1`, name: "Service request.pdf", size: "212 KB" }],
      activity: [],
    });
  });

  // Requests that haven't reached the field yet — they feed Dispatch.
  type Pending = Pick<WorkOrder, "title" | "customer" | "serviceType" | "priority" | "baseStatus" | "source" | "description"> & { daysAgo: number; preferred: number | null; assetName?: string };
  const pending: Pending[] = [
    { title: "Low hot water pressure — guest floors 6–8", customer: "Harbor View Hotel", serviceType: "Plumbing", priority: "High", baseStatus: "New", source: "Phone", daysAgo: 0, preferred: 1, description: "Front desk reports guests on floors 6–8 getting lukewarm water at low pressure since 6 AM. Boiler room readings not yet taken." },
    { title: "Emergency lighting test failed — Building C", customer: "Summit Tech Park", serviceType: "Electrical", priority: "Medium", baseStatus: "New", source: "Email", daysAgo: 1, preferred: 3, description: "Monthly self-test flagged 6 fittings in Building C stairwells with failed batteries." },
    { title: "Exam room 4 thermostat not responding", customer: "Brookside Clinic", serviceType: "HVAC", priority: "Low", baseStatus: "New", source: "Customer portal", daysAgo: 0, preferred: null, description: "Thermostat display blank. Room is usable but warm in the afternoon." },
    { title: "Escalator E2 handrail drive replacement", customer: "Northgate Mall", serviceType: "Elevator", priority: "Medium", baseStatus: "Awaiting approval", source: "Technician", daysAgo: 6, preferred: 9, description: "Handrail lagging the step band by ~4%. Drive chain stretched beyond tolerance at last inspection — replacement quoted." },
    { title: "Replace failed condenser fan motor — Gym AHU", customer: "Greenfield School", serviceType: "HVAC", priority: "High", baseStatus: "Awaiting approval", source: "Phone", daysAgo: 3, preferred: 2, description: "Condenser fan seized; unit locked out on high head pressure. Gym unusable for afternoon classes until repaired." },
    { title: "Water heater replacement — Unit 12B", customer: "Oakwood Residences", serviceType: "Plumbing", priority: "Low", baseStatus: "Awaiting approval", source: "Email", daysAgo: 8, preferred: null, description: "50-gal heater leaking from tank seam. Isolated by property manager; temporary supply from neighbouring unit." },
    { title: "UPS battery bank inspection — Imaging wing", customer: "Metro Hospital", serviceType: "Electrical", priority: "High", baseStatus: "Ready to schedule", source: "Service contract", daysAgo: 2, preferred: 0, description: "UPS reporting two weak strings. Inspection and load test required; coordinate with imaging department downtime." },
    { title: "Air compressor oil leak — Line 2", customer: "ABC Manufacturing", serviceType: "Mechanical", priority: "Medium", baseStatus: "Ready to schedule", source: "Customer portal", daysAgo: 2, preferred: 1, description: "Oil weeping from the compressor sump gasket. Unit still running; operators topping up daily." },
    { title: "Quarterly filter change — Floors 1–6", customer: "Riverside Office", serviceType: "Preventive", priority: "Low", baseStatus: "Ready to schedule", source: "Service contract", daysAgo: 4, preferred: 2, description: "Quarterly PM under Silver AMC. Filters, condensate drains and belt check across six floors." },
    { title: "Car 2 doors reopening intermittently", customer: "Pinnacle Apartments", serviceType: "Elevator", priority: "Medium", baseStatus: "Ready to schedule", source: "Phone", daysAgo: 1, preferred: 1, description: "Superintendent reports Car 2 doors cycling 3–4 times before closing, mostly on lobby level." },
    { title: "Parking lot lighting circuit tripping", customer: "Sunrise Retail", serviceType: "Electrical", priority: "Low", baseStatus: "Ready to schedule", source: "Email", daysAgo: 3, preferred: 4, description: "Lot lighting circuit 4 trips after rain. Likely moisture ingress in a pole junction box." },
    { title: "Hydraulic pressure loss on CNC press", customer: "Acme Industrial Systems", serviceType: "Mechanical", priority: "High", baseStatus: "Ready to schedule", source: "Phone", daysAgo: 1, preferred: 0, assetName: "CNC Hydraulic Press", description: "Press HP-450 on Line B losing pressure under load (205 → 160 bar within 10 min). Operators report pump noise. Line B down — customer requests same-day visit." },
  ];

  pending.forEach((p, k) => {
    const id = wos.length + 1;
    const custId = slugify(p.customer);
    const asset = p.assetName
      ? ASSETS.find(a => a.customer === p.customer && a.name === p.assetName)
      : ASSETS.find(a => a.customer === p.customer && (a.category === p.serviceType || p.serviceType === "Preventive"));
    const cust = customerById(custId);
    wos.push({
      id,
      number: `WO-2024-${String(410 + ALL_JOBS.length + k).padStart(5, "0")}`,
      title: p.title, customer: p.customer, customerId: custId, contactId: `${custId}-c1`,
      serviceType: p.serviceType, priority: p.priority, baseStatus: p.baseStatus, source: p.source,
      requestedAt: day(-p.daysAgo, 8 + (k % 6), (k * 13) % 60),
      preferredDate: p.preferred === null ? null : day(p.preferred, 9),
      description: p.description,
      assetId: asset?.id ?? null,
      site: asset?.site ?? (cust ? `${cust.street}, ${cust.cityLine}` : ""),
      zone: cust?.zone ?? "Central",
      jobIds: [],
      createdBy: k % 2 ? "Priya Raman" : "Grace Liu",
      notes: p.customer === "Acme Industrial Systems"
        ? [{ id: "n-acme", text: "Michael Carter confirmed lock-out/tag-out will be in place from 1 PM. Pump assembly HP-450-PUMP-02 reserved from main warehouse.", author: "Priya Raman", at: "Sep 23, 2024 04:40 PM" }]
        : [],
      attachments: p.customer === "Acme Industrial Systems"
        ? [{ id: "a-acme-1", name: "Press HP-450 pressure log.csv", size: "38 KB" }, { id: "a-acme-2", name: "Pump noise recording.m4a", size: "1.4 MB" }]
        : [],
      activity: [],
    });
  });
  return wos;
}

export const WORK_ORDERS: WorkOrder[] = buildWorkOrders();
export const workOrderById = (id: number) => WORK_ORDERS.find(w => w.id === id);
export const workOrderForJob = (jobId: number) => WORK_ORDERS.find(w => w.jobIds.includes(jobId));
export const workOrdersFor = (customerName: string) => WORK_ORDERS.filter(w => w.customer === customerName);

export function woJobs(wo: WorkOrder): JobRecord[] {
  return wo.jobIds.map(id => ALL_JOBS.find(j => j.id === id)).filter((j): j is JobRecord => !!j);
}

/** Live status — a work order follows its most recent job once one exists. */
export function woStatus(wo: WorkOrder): WOStatus {
  const jobs = woJobs(wo);
  if (!jobs.length) return wo.baseStatus;
  const latest = [...jobs].sort((a, b) => b.scheduledAt - a.scheduledAt)[0];
  return woStatusFromJob(latest.status);
}

/** The next step a coordinator should take — shown on list + detail. */
export function woNextStep(wo: WorkOrder): { label: string; tone: "amber" | "blue" | "green" | "gray" | "red" } {
  const s = woStatus(wo);
  const est = estimateForWO(wo.id);
  switch (s) {
    case "New": return { label: "Review request and confirm scope", tone: "amber" };
    case "Awaiting approval": return { label: est ? `Follow up on ${est.number} with customer` : "Send estimate for approval", tone: "amber" };
    case "Ready to schedule": return { label: "Assign a technician in Dispatch", tone: "amber" };
    case "Scheduled": return { label: "Visit booked — no action needed", tone: "blue" };
    case "In progress": {
      const j = woJobs(wo).find(x => x.status === "Incomplete" || x.slaBreached);
      return j ? { label: `${j.jobId} needs a return visit`, tone: "red" } : { label: "Technician working — monitor progress", tone: "blue" };
    }
    case "Completed": return { label: billingStateForJob(woJobs(wo)[0]?.id) === "Ready to invoice" ? "Raise the invoice" : "Closed out", tone: "green" };
    default: return { label: "No further action", tone: "gray" };
  }
}

let woSeq = 0;
export function addWorkOrder(input: {
  title: string; customer: string; contactId?: string; serviceType: ServiceType; priority: JobPriority;
  description: string; assetId: number | null; preferredDate: number | null; source: WOSource; needsEstimate: boolean;
}): WorkOrder {
  const cust = customerByName(input.customer);
  const asset = input.assetId ? assetById(input.assetId) : undefined;
  const maxNo = WORK_ORDERS.reduce((m, w) => Math.max(m, Number(w.number.slice(-5))), 0);
  const wo: WorkOrder = {
    id: WORK_ORDERS.reduce((m, w) => Math.max(m, w.id), 0) + 1,
    number: `WO-2024-${String(maxNo + 1).padStart(5, "0")}`,
    title: input.title.trim(),
    customer: input.customer,
    customerId: slugify(input.customer),
    contactId: input.contactId || `${slugify(input.customer)}-c1`,
    serviceType: input.serviceType,
    priority: input.priority,
    baseStatus: input.needsEstimate ? "Awaiting approval" : "Ready to schedule",
    source: input.source,
    requestedAt: datasetNow(),
    preferredDate: input.preferredDate,
    description: input.description.trim(),
    assetId: input.assetId,
    site: asset?.site ?? (cust ? `${cust.street}, ${cust.cityLine}` : ""),
    zone: cust?.zone ?? "Central",
    jobIds: [],
    createdBy: "PM SDL",
    notes: [], attachments: [],
    activity: [{ label: `Work order created${input.needsEstimate ? " — estimate required" : ""}`, at: datasetNow() + ++woSeq }],
  };
  WORK_ORDERS.unshift(wo);
  return wo;
}

export function logWO(wo: WorkOrder, label: string) {
  wo.activity.push({ label, at: datasetNow() });
}

// ─────────────────────────────────────────────
//  Technicians — dispatch view of the field team
// ─────────────────────────────────────────────
export type Availability = "Available" | "On job" | "Off today" | "On leave";
export interface TechProfile {
  name: string;
  title: string;
  avatar: string;
  phone: string;
  email: string;
  zone: ServiceZone;
  skills: ServiceType[];
  shift: [number, number];
  offToday: boolean;
  onLeave: boolean;
  /** Van stock location name. */
  van: string;
}

const TECH_SKILLS: Record<string, { skills: ServiceType[]; zone: ServiceZone; off?: boolean; leave?: boolean }> = {
  "Michael Thomas": { skills: ["HVAC", "Preventive", "Mechanical"], zone: "North" },
  "Sarah Wilson":   { skills: ["Mechanical", "HVAC", "Preventive"], zone: "South" },
  "Ravi Kumar":     { skills: ["Plumbing", "Preventive"],            zone: "Central" },
  "Chris Walker":   { skills: ["Electrical", "Preventive"],          zone: "North" },
  "Emily Johnson":  { skills: ["Preventive", "HVAC", "Electrical"],  zone: "East" },
  "Daniel Smith":   { skills: ["HVAC", "Mechanical"],                zone: "South" },
  "James Lee":      { skills: ["Mechanical", "Plumbing"],            zone: "East", leave: true },
  "Robert Davis":   { skills: ["Elevator", "Electrical"],            zone: "West" },
};

export const TECH_PROFILES: TechProfile[] = TECHNICIANS.map((name, i) => ({
  name,
  title: TECHNICIAN_TITLES[name] ?? "Field Technician",
  avatar: TECHNICIAN_AVATARS[name],
  phone: TECHNICIAN_PHONES[name] ?? "—",
  email: technicianEmail(name),
  zone: TECH_SKILLS[name]?.zone ?? "Central",
  skills: TECH_SKILLS[name]?.skills ?? ["Preventive"],
  shift: i % 3 === 2 ? [9, 18] : [8, 17],
  offToday: !!TECH_SKILLS[name]?.off,
  onLeave: !!TECH_SKILLS[name]?.leave,
  van: `VAN-${String(11 + i * 3)}`,
}));
export const techProfile = (name: string) => TECH_PROFILES.find(t => t.name === name);

export const JOB_DURATION_HRS: Record<ServiceType, number> = Object.fromEntries(
  Object.entries(SERVICE_PRICING).map(([k, v]) => [k, v.durationHrs])
) as Record<ServiceType, number>;

/** Start/end of a job's visit, honouring an explicit end time from the Create/Edit forms. */
export function jobWindow(job: JobRecord): { start: number; end: number } {
  const extras = JOB_EXTRAS[job.id];
  const start = extras?.scheduleStart ? new Date(extras.scheduleStart).getTime() : job.scheduledAt;
  const endFromForm = extras?.scheduleEnd ? new Date(extras.scheduleEnd).getTime() : 0;
  const end = endFromForm > start ? endFromForm : start + JOB_DURATION_HRS[job.serviceType] * 3600 * 1000;
  return { start, end };
}

/** Same travel estimate the Trip details card on Job Details shows. */
export const travelMinutes = (job: JobRecord) => job.id === 1 ? 30 : 20 + ((job.id * 7) % 40);

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
export const jobsOnDay = (t: number) => ALL_JOBS.filter(j => sameDay(j.scheduledAt, t));

export function techAvailability(name: string, dayTs: number): Availability {
  const p = techProfile(name);
  // Leave covers the current week only — later days show the technician back on shift.
  if (p?.onLeave && dayTs >= TODAY - DAY_MS / 2 && dayTs < TODAY + 4 * DAY_MS) return "On leave";
  if (p?.offToday) return "Off today";
  if (sameDay(dayTs, TODAY)) {
    const busy = ALL_JOBS.some(j => j.technician === name && (j.status === "On site" || j.status === "En route") && sameDay(j.scheduledAt, dayTs));
    if (busy) return "On job";
  }
  return "Available";
}

const HOUR_MS = 3600 * 1000;
const SLOT_MS = HOUR_MS / 2;
export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** A technician's booked windows on a day, each widened by its travel lead-in. */
export function techBusy(name: string, dayTs: number, exceptJobId?: number) {
  return jobsOnDay(dayTs)
    .filter(j => j.technician === name && j.status !== "Cancelled" && j.id !== exceptJobId)
    .map(j => { const w = jobWindow(j); return { start: w.start - travelMinutes(j) * 60000, end: w.end, job: j }; });
}

/** First half-hour slot (with 30 min travel) that fits inside the shift without overlapping other work. */
export function nextFreeSlot(name: string, dayTs: number, durationMs: number, exceptJobId?: number): number | null {
  const p = techProfile(name);
  if (!p) return null;
  const day0 = startOfDay(dayTs);
  let t = day0 + p.shift[0] * HOUR_MS + SLOT_MS;
  if (day0 === startOfDay(TODAY)) t = Math.max(t, Math.ceil(DATASET_CLOCK / SLOT_MS) * SLOT_MS + SLOT_MS);
  const end = day0 + p.shift[1] * HOUR_MS;
  const busy = techBusy(name, dayTs, exceptJobId);
  for (; t + durationMs <= end; t += SLOT_MS) {
    const s = t - SLOT_MS, e = t + durationMs;
    if (!busy.some(b => s < b.end && e > b.start)) return t;
  }
  return null;
}

export function bookedHours(name: string, dayTs: number) {
  return jobsOnDay(dayTs).filter(j => j.technician === name && j.status !== "Cancelled")
    .reduce((s, j) => { const w = jobWindow(j); return s + (w.end - w.start) / HOUR_MS; }, 0);
}

export interface Suggestion { tech: TechProfile; slot: number | null; skill: boolean; zone: boolean; hours: number; score: number }
/** Rank technicians for a work order: skill first, then zone, then earliest free slot and lightest load. */
export function suggestTechnicians(wo: WorkOrder, dayTs: number): Suggestion[] {
  const dur = JOB_DURATION_HRS[wo.serviceType] * HOUR_MS;
  return TECH_PROFILES
    .filter(t => !["On leave", "Off today"].includes(techAvailability(t.name, dayTs)))
    .map(t => {
      const slot = nextFreeSlot(t.name, dayTs, dur);
      const skill = t.skills.includes(wo.serviceType);
      const zone = t.zone === wo.zone;
      const hours = bookedHours(t.name, dayTs);
      const score = (skill ? 50 : 0) + (zone ? 20 : 0) + (slot ? 30 - (slot - startOfDay(dayTs)) / HOUR_MS : -100) - hours * 2;
      return { tech: t, slot, skill, zone, hours, score };
    })
    .sort((a, b) => b.score - a.score);
}

/** Things a dispatcher should act on: SLA breaches, incomplete visits, jobs booked on technicians who are away. */
export function dispatchAlerts(fromDay: number, days = 4) {
  const out: { job: JobRecord; reason: string; tone: "red" | "amber" }[] = [];
  const end = startOfDay(fromDay) + days * DAY_MS;
  for (const j of ALL_JOBS) {
    if (j.scheduledAt < startOfDay(fromDay) || j.scheduledAt >= end || ["Completed", "Cancelled"].includes(j.status)) continue;
    const away = techAvailability(j.technician, j.scheduledAt);
    if (away === "On leave" || away === "Off today") out.push({ job: j, reason: `${j.technician} is ${away.toLowerCase()} — reassign`, tone: "red" });
    else if (j.slaBreached) out.push({ job: j, reason: "SLA breached — escalate or expedite", tone: "red" });
    else if (j.status === "Incomplete") out.push({ job: j, reason: "Incomplete — book a return visit", tone: "amber" });
  }
  return out.sort((a, b) => a.job.scheduledAt - b.job.scheduledAt);
}

/** Move a job to a technician and/or start time (keeping its duration). */
export function rescheduleJob(jobId: number, technician: string, start: number) {
  const job = ALL_JOBS.find(j => j.id === jobId);
  if (!job) return;
  const { start: oldStart, end: oldEnd } = jobWindow(job);
  const changedTech = technician !== job.technician;
  const changedTime = start !== oldStart;
  updateJob(jobId, {
    technician,
    scheduledAt: start,
    scheduledDate: fmtDate(start),
    scheduledTime: fmtTime(start),
    etaLabel: `${fmtDay(start)}, ${fmtTime(start)}`,
  });
  const extras = JOB_EXTRAS[jobId];
  if (extras?.scheduleStart) {
    extras.scheduleStart = toLocalInput(start);
    if (extras.scheduleEnd) extras.scheduleEnd = toLocalInput(start + (oldEnd - oldStart));
  }
  if (changedTech) logActivity(jobId, `Reassigned to ${technician} from Dispatch`);
  if (changedTime) logActivity(jobId, `Rescheduled to ${fmtDay(start)}, ${fmtTime(start)} from Dispatch`);
  const wo = workOrderForJob(jobId);
  if (wo && (changedTech || changedTime)) logWO(wo, `${job.jobId} ${changedTech ? `assigned to ${technician}` : "rescheduled"} — ${fmtDay(start)}, ${fmtTime(start)}`);
}

/** Turn a work order into a scheduled field job. */
export function dispatchWorkOrder(woId: number, technician: string, start: number): JobRecord | undefined {
  const wo = workOrderById(woId);
  if (!wo) return undefined;
  const cust = customerByName(wo.customer);
  const contact = CONTACTS.find(c => c.id === wo.contactId);
  const asset = wo.assetId ? assetById(wo.assetId) : undefined;
  const [city, state] = (cust?.location ?? "").split(", ");
  const durationMs = JOB_DURATION_HRS[wo.serviceType] * 3600 * 1000;
  const job = createJob({
    customer: wo.customer,
    // createJob composes street, city, state and ZIP itself — pass them separately so nothing repeats.
    address: cust?.street ?? wo.site,
    email: contact?.email ?? cust?.email ?? "",
    city: city ?? "", phone: contact?.phone ?? cust?.phone ?? "", state: state ?? "",
    pincode: cust?.cityLine.match(/\d{5}$/)?.[0] ?? "",
    region: wo.zone,
    serviceType: wo.serviceType, priority: wo.priority, status: "Scheduled",
    jobTitle: wo.title,
    description: wo.description,
    scheduleStart: toLocalInput(start), scheduleEnd: toLocalInput(start + durationMs),
    technician,
    productModel: asset?.model ?? "", serialNumber: asset?.serialNumber ?? "",
    notes: `Raised from ${wo.number}.`,
  });
  wo.jobIds.push(job.id);
  if (asset) asset.jobIds.push(job.id);
  logActivity(job.id, `Created from ${wo.number} in Dispatch`);
  logWO(wo, `${job.jobId} scheduled with ${technician} — ${fmtDay(start)}, ${fmtTime(start)}`);
  return job;
}

// ─────────────────────────────────────────────
//  Estimates + invoices
// ─────────────────────────────────────────────
export type EstimateStatus = "Draft" | "Sent" | "Approved" | "Declined";
export interface Estimate {
  id: string;
  number: string;
  woId: number;
  customer: string;
  issuedOn: number;
  validUntil: number;
  status: EstimateStatus;
  lines: PriceLine[];
  /** Good / better / best choices offered to the customer. `lines` always holds the lines that count toward the total. */
  options?: EstimateOption[];
  /** Share of the total collected when the estimate is approved. */
  depositPct?: number;
  chosenOption?: string;
  /** Deposit collected through the customer link (test mode until a processor is connected). */
  depositPaid?: number;
  approval?: { name: string; at: number; via: "customer link" | "office" };
  sentAt?: number;
  followUps?: number;
}
export interface EstimateOption { key: string; label: string; lines: PriceLine[] }
export const estimateTotal = (e: Estimate) => Math.round(e.lines.reduce((s, l) => s + l.qty * l.rate, 0) * 1.18);

const SPECIAL_LINES: Record<string, PriceLine[]> = {
  "Hydraulic pressure loss on CNC press": [{ item: "Hydraulic Pump Assembly", qty: 1, rate: 4850 }, { item: "Hydraulic Seal Kit", qty: 1, rate: 320 }, { item: "Hydraulic Oil ISO VG 46 (20L)", qty: 2, rate: 210 }, { item: "Labour — 4 hrs", qty: 1, rate: 2400 }],
  "Escalator E2 handrail drive replacement": [{ item: "Handrail Drive Chain", qty: 1, rate: 1250 }, { item: "Lubricant", qty: 2, rate: 400 }, { item: "Labour — 6 hrs", qty: 1, rate: 3600 }],
  "Replace failed condenser fan motor — Gym AHU": [{ item: "Condenser Fan Motor 1/2 HP", qty: 1, rate: 640 }, { item: "Run Capacitor", qty: 1, rate: 85 }, { item: "Labour — 3 hrs", qty: 1, rate: 1650 }],
  "Water heater replacement — Unit 12B": [{ item: "Water Heater 50 gal", qty: 1, rate: 1180 }, { item: "PVC Pipe (5ft)", qty: 2, rate: 300 }, { item: "Labour — 4 hrs", qty: 1, rate: 1600 }],
  "UPS battery bank inspection — Imaging wing": [{ item: "UPS Battery 12V 100Ah", qty: 4, rate: 290 }, { item: "Labour — 3 hrs", qty: 1, rate: 1500 }],
};

function buildEstimates(): Estimate[] {
  const out: Estimate[] = [];
  let n = 310;
  for (const wo of WORK_ORDERS) {
    const special = SPECIAL_LINES[wo.title];
    const pending = wo.jobIds.length === 0;
    let status: EstimateStatus | null = null;
    if (special) status = wo.baseStatus === "Awaiting approval" ? "Sent" : "Approved";
    else if (pending && wo.baseStatus === "Awaiting approval") status = "Sent";
    else if (!pending && wo.priority === "High" && wo.id % 2 === 1) status = "Approved";
    else if (!pending && wo.id % 11 === 0) status = "Declined";
    if (!status) continue;
    const p = SERVICE_PRICING[wo.serviceType];
    n += 1;
    out.push({
      id: `est-${wo.id}`,
      number: `EST-2024-${String(n).padStart(4, "0")}`,
      woId: wo.id,
      customer: wo.customer,
      issuedOn: wo.requestedAt + DAY_MS / 2,
      validUntil: wo.requestedAt + 30 * DAY_MS,
      status,
      lines: special ?? [...p.parts, { item: `Labour — ${p.durationHrs} hrs`, qty: 1, rate: p.labor }],
    });
  }
  // One draft being prepared for a new request.
  const draftFor = WORK_ORDERS.find(w => w.title.startsWith("Emergency lighting"));
  if (draftFor) out.push({ id: `est-${draftFor.id}`, number: `EST-2024-${String(++n).padStart(4, "0")}`, woId: draftFor.id, customer: draftFor.customer, issuedOn: TODAY, validUntil: TODAY + 30 * DAY_MS, status: "Draft", lines: [{ item: "Emergency Light Battery Pack", qty: 6, rate: 48 }, { item: "Labour — 2 hrs", qty: 1, rate: 900 }] });
  return out;
}

export const ESTIMATES: Estimate[] = buildEstimates();
export const estimateForWO = (woId: number) => ESTIMATES.find(e => e.woId === woId);

export function setEstimateStatus(e: Estimate, status: EstimateStatus) {
  e.status = status;
  const wo = workOrderById(e.woId);
  if (!wo) return;
  if (status === "Approved" && wo.baseStatus === "Awaiting approval") wo.baseStatus = "Ready to schedule";
  if (status === "Sent" && wo.baseStatus === "New") wo.baseStatus = "Awaiting approval";
  logWO(wo, `Estimate ${e.number} ${status.toLowerCase()}`);
}

export type InvoiceStatus = "Draft" | "Sent" | "Partially paid" | "Paid" | "Overdue";
export interface Invoice {
  number: string;
  customer: string;
  jobRef: string;
  /** Set when the job is in the live Jobs dataset (navigable). */
  jobId?: number;
  woNumber?: string;
  issuedOn: number;
  dueOn: number;
  amount: number;
  paid: number;
  status: InvoiceStatus;
}

const TERMS_DAYS: Record<Customer["paymentTerms"], number> = { "Net 15": 15, "Net 30": 30, "Net 45": 45 };

function buildInvoices(): Invoice[] {
  const out: Invoice[] = [];
  for (const v of SERVICE_HISTORY) {
    const cust = customerByName(v.customer);
    const terms = TERMS_DAYS[cust?.paymentTerms ?? "Net 30"];
    const issued = v.date + DAY_MS;
    const due = issued + terms * DAY_MS;
    const seed = Number(v.jobRef.slice(4));
    let status: InvoiceStatus = "Paid";
    let paid = v.amount;
    if (due > TODAY) {
      const r = rnd(seed, 4);
      status = r === 0 ? "Paid" : r === 1 ? "Partially paid" : "Sent";
      paid = status === "Paid" ? v.amount : status === "Partially paid" ? Math.round(v.amount * 0.5) : 0;
    } else if (rnd(seed, 7) === 0 || (cust?.status === "On hold" && due > TODAY - 120 * DAY_MS)) {
      status = "Overdue"; paid = 0;
    }
    out.push({ number: `INV-${seed}`, customer: v.customer, jobRef: v.jobRef, issuedOn: issued, dueOn: due, amount: v.amount, paid, status });
  }
  return out;
}

const HISTORIC_INVOICES: Invoice[] = buildInvoices();
export const HISTORIC_INVOICE_STORE = HISTORIC_INVOICES;

export type BillingState = "Not billable yet" | "Ready to invoice" | "Invoiced" | "Paid" | "Not billable";

/** Billing state for a live job — reads the Job Details workspace so a generated invoice shows up here. */
export function billingStateForJob(jobId?: number): BillingState {
  const job = jobId ? ALL_JOBS.find(j => j.id === jobId) : undefined;
  if (!job) return "Not billable";
  if (job.status === "Cancelled") return "Not billable";
  if (job.status !== "Completed") return "Not billable yet";
  if (getWorkspace(job.id).invoice) return getWorkspace(job.id).paidOn ? "Paid" : "Invoiced";
  return job.id % 3 === 0 ? "Ready to invoice" : "Paid";
}

/** All invoices — historic ones plus any raised against live jobs. */
export function allInvoices(): Invoice[] {
  const live: Invoice[] = [];
  for (const job of ALL_JOBS) {
    const state = billingStateForJob(job.id);
    if (state !== "Invoiced" && state !== "Paid") continue;
    const cust = customerByName(job.customer);
    const total = jobCharges(job).total;
    const issued = job.scheduledAt + DAY_MS / 2;
    live.push({
      number: getWorkspace(job.id).invoice?.number ?? `INV-${job.jobId.replace(/\D/g, "")}`,
      customer: job.customer, jobRef: job.jobId, jobId: job.id, woNumber: workOrderForJob(job.id)?.number,
      issuedOn: issued, dueOn: issued + TERMS_DAYS[cust?.paymentTerms ?? "Net 30"] * DAY_MS,
      amount: total, paid: state === "Paid" ? total : 0, status: state === "Paid" ? "Paid" : "Sent",
    });
  }
  return [...live, ...HISTORIC_INVOICES].sort((a, b) => b.issuedOn - a.issuedOn);
}

export const invoicesFor = (customer: string) => allInvoices().filter(i => i.customer === customer);
export const outstanding = (i: Invoice) => i.amount - i.paid;

export function recordPayment(inv: Invoice) {
  const h = HISTORIC_INVOICES.find(x => x.number === inv.number);
  if (h) { h.paid = h.amount; h.status = "Paid"; }
  if (inv.jobId) getWorkspace(inv.jobId).paidOn = Date.now();
}

// ─────────────────────────────────────────────
//  Parts + inventory (field-service view)
// ─────────────────────────────────────────────
export interface Part {
  partNo: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  /** Main warehouse on-hand quantity. */
  onHand: number;
  reserved: number;
  reorderPoint: number;
  /** Quantity carried in each technician's van. */
  techStock: Record<string, number>;
}

const PART_NUMBERS: Record<string, { partNo: string; category: string; unit: string }> = {
  "Air Filter (Set)":   { partNo: "AF-SET-20",     category: "HVAC",       unit: "set" },
  "Duct Sealant":       { partNo: "DS-QT-01",      category: "HVAC",       unit: "qt" },
  "Fan Belt":           { partNo: "FB-A42",        category: "HVAC",       unit: "ea" },
  "Engine Oil (4L)":    { partNo: "EO-4L-15W40",   category: "Mechanical", unit: "can" },
  "Air Filter":         { partNo: "AF-CMP-01",     category: "Mechanical", unit: "ea" },
  "Battery Terminal":   { partNo: "BT-TERM-02",    category: "Mechanical", unit: "ea" },
  "PVC Pipe (5ft)":     { partNo: "PVC-5FT-1IN",   category: "Plumbing",   unit: "length" },
  "Pipe Joint":         { partNo: "PJ-1IN-04",     category: "Plumbing",   unit: "ea" },
  "Sealant Tape":       { partNo: "ST-PTFE-12",    category: "Plumbing",   unit: "roll" },
  "MCB Switch":         { partNo: "MCB-20A-1P",    category: "Electrical", unit: "ea" },
  "Wiring Cable (10m)": { partNo: "WC-10M-12G",    category: "Electrical", unit: "coil" },
  "Circuit Breaker":    { partNo: "CB-60A-3P",     category: "Electrical", unit: "ea" },
  "Service Kit":        { partNo: "PMK-STD-01",    category: "Preventive", unit: "kit" },
  "Door Sensor":        { partNo: "DS-ELV-IR",     category: "Elevator",   unit: "ea" },
  "Guide Shoe Liner":   { partNo: "GSL-ELV-04",    category: "Elevator",   unit: "ea" },
  "Lubricant":          { partNo: "LUB-ELV-1L",    category: "Elevator",   unit: "L" },
};

const EXTRA_PARTS: { name: string; partNo: string; category: string; unit: string; cost: number }[] = [
  { name: "Hydraulic Pump Assembly",       partNo: "HP-450-PUMP-02", category: "Mechanical", unit: "ea",   cost: 4850 },
  { name: "Hydraulic Seal Kit",            partNo: "HP-450-SK-01",   category: "Mechanical", unit: "kit",  cost: 320 },
  { name: "Hydraulic Oil ISO VG 46 (20L)", partNo: "HO-46-20",       category: "Mechanical", unit: "drum", cost: 210 },
  { name: "Condenser Fan Motor 1/2 HP",    partNo: "CFM-050-1PH",    category: "HVAC",       unit: "ea",   cost: 640 },
  { name: "Run Capacitor",                 partNo: "RC-45-5UF",      category: "HVAC",       unit: "ea",   cost: 85 },
  { name: "Handrail Drive Chain",          partNo: "ESC-HDC-90",     category: "Elevator",   unit: "ea",   cost: 1250 },
  { name: "Water Heater 50 gal",           partNo: "AOS-WH-50",      category: "Plumbing",   unit: "ea",   cost: 1180 },
  { name: "UPS Battery 12V 100Ah",         partNo: "UPS-B12-100",    category: "Electrical", unit: "ea",   cost: 290 },
  { name: "Emergency Light Battery Pack",  partNo: "ELB-NI-36",      category: "Electrical", unit: "ea",   cost: 48 },
];

function buildParts(): Part[] {
  const parts: Part[] = [];
  const seen = new Set<string>();
  Object.values(SERVICE_PRICING).forEach(p => p.parts.forEach(line => {
    if (seen.has(line.item)) return;
    seen.add(line.item);
    const meta = PART_NUMBERS[line.item];
    parts.push({ partNo: meta.partNo, name: line.item, category: meta.category, unit: meta.unit, unitCost: line.rate, onHand: 0, reserved: 0, reorderPoint: 0, techStock: {} });
  }));
  EXTRA_PARTS.forEach(x => parts.push({ partNo: x.partNo, name: x.name, category: x.category, unit: x.unit, unitCost: x.cost, onHand: 0, reserved: 0, reorderPoint: 0, techStock: {} }));

  parts.forEach((p, i) => {
    const cheap = p.unitCost < 500;
    p.onHand = cheap ? 34 + rnd(i * 7, 40) : 6 + rnd(i * 7, 8);
    p.reorderPoint = cheap ? 20 : 3;
    p.reserved = Math.min(p.onHand, rnd(i * 13, cheap ? 10 : 3));
    for (const t of TECH_PROFILES) {
      if (!t.skills.includes(p.category as ServiceType) && !(p.category === "Preventive")) continue;
      const q = (cheap ? 2 : 1) + rnd(i * 5 + t.name.length, cheap ? 5 : 2);
      if (q) p.techStock[t.name] = q;
    }
  });
  // Shape a few stories into the data.
  const set = (no: string, patch: Partial<Part>) => Object.assign(parts.find(p => p.partNo === no) ?? {}, patch);
  set("HP-450-PUMP-02", { onHand: 1, reserved: 1, reorderPoint: 1, techStock: {} });
  set("DS-ELV-IR", { onHand: 1, reserved: 0, reorderPoint: 3 });
  set("AF-SET-20", { onHand: 18, reserved: 6, reorderPoint: 20 });
  set("CB-60A-3P", { onHand: 2, reserved: 1, reorderPoint: 3 });
  set("ESC-HDC-90", { onHand: 0, reserved: 0, reorderPoint: 1, techStock: {} });
  return parts;
}

export const PARTS: Part[] = buildParts();
export const partByName = (name: string) => PARTS.find(p => p.name === name);
export const techStockTotal = (p: Part) => Object.values(p.techStock).reduce((s, q) => s + q, 0);
export const available = (p: Part) => Math.max(0, p.onHand - p.reserved);

/** Parts the next 7 days of open jobs will need, with the jobs that need them. */
export function partDemand(p: Part): { required: number; jobs: { jobId: number; qty: number }[] } {
  const horizon = TODAY + 8 * DAY_MS;
  const jobs: { jobId: number; qty: number }[] = [];
  for (const j of ALL_JOBS) {
    if (["Completed", "Cancelled"].includes(j.status) || j.scheduledAt >= horizon) continue;
    const line = SERVICE_PRICING[j.serviceType].parts.find(l => l.item === p.name);
    if (line) jobs.push({ jobId: j.id, qty: line.qty });
  }
  return { required: jobs.reduce((s, x) => s + x.qty, 0), jobs };
}

/** Units consumed over the last 30 days (archived visits + completed live jobs). */
export function partUsed30(p: Part): number {
  const from = TODAY - 30 * DAY_MS;
  const fromHistory = SERVICE_HISTORY.filter(v => v.date >= from).reduce((s, v) => s + (v.partsUsed.find(x => x.item === p.name)?.qty ?? 0), 0);
  const fromJobs = ALL_JOBS.filter(j => j.status === "Completed").reduce((s, j) => s + (SERVICE_PRICING[j.serviceType].parts.find(l => l.item === p.name)?.qty ?? 0), 0);
  return fromHistory + fromJobs;
}

export type StockState = "In stock" | "Low stock" | "Short for jobs" | "Out of stock";
export function stockState(p: Part): StockState {
  if (p.onHand === 0 && techStockTotal(p) === 0) return "Out of stock";
  if (partDemand(p).required > available(p) + techStockTotal(p)) return "Short for jobs";
  if (p.onHand <= p.reorderPoint) return "Low stock";
  return "In stock";
}

export type PartRequestStatus = "Requested" | "Approved" | "Picked" | "Delivered" | "Back-ordered";
export interface PartRequest { id: string; partNo: string; qty: number; technician: string; jobId: number | null; woId: number | null; neededBy: number; status: PartRequestStatus; raisedAt: number }

export type ReturnReason = "Unused" | "Defective" | "Core return" | "Wrong part";
export type ReturnStatus = "Pending inspection" | "Restocked" | "Sent to vendor";
export interface PartReturn { id: string; partNo: string; qty: number; technician: string; jobRef: string; reason: ReturnReason; status: ReturnStatus; at: number }

function buildRequests(): PartRequest[] {
  const acme = WORK_ORDERS.find(w => w.customer === "Acme Industrial Systems");
  const upcoming = ALL_JOBS.filter(j => !["Completed", "Cancelled"].includes(j.status)).sort((a, b) => a.scheduledAt - b.scheduledAt);
  const statuses: PartRequestStatus[] = ["Requested", "Approved", "Picked", "Delivered", "Requested", "Back-ordered", "Approved", "Delivered"];
  const out: PartRequest[] = [];
  if (acme) out.push({ id: "PR-0418", partNo: "HP-450-PUMP-02", qty: 1, technician: "Sarah Wilson", jobId: null, woId: acme.id, neededBy: TODAY, status: "Approved", raisedAt: TODAY - DAY_MS / 3 });
  upcoming.slice(0, 9).forEach((j, i) => {
    const line = SERVICE_PRICING[j.serviceType].parts[i % SERVICE_PRICING[j.serviceType].parts.length];
    out.push({
      id: `PR-${String(417 - i).padStart(4, "0")}`, partNo: PART_NUMBERS[line.item].partNo, qty: line.qty,
      technician: j.technician, jobId: j.id, woId: workOrderForJob(j.id)?.id ?? null,
      neededBy: j.scheduledAt, status: statuses[i % statuses.length], raisedAt: j.scheduledAt - (2 + i % 3) * DAY_MS,
    });
  });
  const esc = WORK_ORDERS.find(w => w.title.startsWith("Escalator E2"));
  if (esc) out.push({ id: "PR-0405", partNo: "ESC-HDC-90", qty: 1, technician: "Robert Davis", jobId: null, woId: esc.id, neededBy: TODAY + 9 * DAY_MS, status: "Back-ordered", raisedAt: TODAY - 5 * DAY_MS });
  return out;
}

export const PART_REQUESTS: PartRequest[] = buildRequests();

export const PART_RETURNS: PartReturn[] = [
  { id: "RT-0091", partNo: "FB-A42",       qty: 1, technician: "Daniel Smith",   jobRef: SERVICE_HISTORY[2]?.jobRef ?? "JOB-10420", reason: "Unused",      status: "Restocked",          at: TODAY - 2 * DAY_MS },
  { id: "RT-0092", partNo: "MCB-20A-1P",   qty: 2, technician: "Chris Walker",   jobRef: "JOB-10484",                               reason: "Defective",   status: "Pending inspection", at: TODAY - DAY_MS },
  { id: "RT-0093", partNo: "DS-ELV-IR",    qty: 1, technician: "Robert Davis",   jobRef: SERVICE_HISTORY[5]?.jobRef ?? "JOB-10433", reason: "Core return", status: "Sent to vendor",     at: TODAY - 6 * DAY_MS },
  { id: "RT-0094", partNo: "PJ-1IN-04",    qty: 4, technician: "Ravi Kumar",     jobRef: SERVICE_HISTORY[8]?.jobRef ?? "JOB-10441", reason: "Wrong part",  status: "Restocked",          at: TODAY - 8 * DAY_MS },
  { id: "RT-0095", partNo: "EO-4L-15W40",  qty: 1, technician: "Sarah Wilson",   jobRef: "JOB-10482",                               reason: "Unused",      status: "Pending inspection", at: TODAY },
];

// ─────────────────────────────────────────────
//  Users (operational identity + access)
// ─────────────────────────────────────────────
export type UserRole = "Administrator" | "Service manager" | "Dispatcher" | "Service coordinator" | "Technician";
export type UserStatus = "Active" | "Invited" | "Deactivated";
export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  team: string;
  territory: string;
  status: UserStatus;
  lastActive: string;
  avatar?: string;
}

const TEAM_FOR: Record<string, string> = {
  "Michael Thomas": "HVAC & Mechanical", "Sarah Wilson": "HVAC & Mechanical", "Daniel Smith": "HVAC & Mechanical",
  "Ravi Kumar": "Plumbing", "James Lee": "Plumbing", "Chris Walker": "Electrical", "Emily Johnson": "General service",
  "Robert Davis": "Vertical transport",
};

export const USERS: AppUser[] = [
  { id: "u-pm",    name: "PM SDL",       email: "dmops@socialdnalabs.com",       phone: "+1 212 555 0100", role: "Administrator",       team: "Operations",        territory: "All territories", status: "Active", lastActive: "Now",           avatar: "https://randomuser.me/api/portraits/men/18.jpg" },
  { id: "u-alex",  name: "Alex Morgan",  email: "alex.morgan@serviceops.com",    phone: "+1 212 555 0104", role: "Service manager",     team: "Operations",        territory: "North East",      status: "Active", lastActive: "12 min ago",    avatar: "https://randomuser.me/api/portraits/men/41.jpg" },
  { id: "u-priya", name: "Priya Raman",  email: "priya.raman@serviceops.com",    phone: "+1 212 555 0109", role: "Dispatcher",          team: "Dispatch desk",     territory: "North East",      status: "Active", lastActive: "Now",           avatar: "https://randomuser.me/api/portraits/women/52.jpg" },
  { id: "u-marco", name: "Marco Silva",  email: "marco.silva@serviceops.com",    phone: "+1 201 555 0111", role: "Dispatcher",          team: "Dispatch desk",     territory: "Mid-Atlantic",    status: "Active", lastActive: "1 hr ago",      avatar: "https://randomuser.me/api/portraits/men/64.jpg" },
  { id: "u-grace", name: "Grace Liu",    email: "grace.liu@serviceops.com",      phone: "+1 212 555 0116", role: "Service coordinator", team: "Customer service",  territory: "North East",      status: "Active", lastActive: "35 min ago",    avatar: "https://randomuser.me/api/portraits/women/24.jpg" },
  { id: "u-nora",  name: "Nora Bennett", email: "nora.bennett@serviceops.com",   phone: "+1 203 555 0120", role: "Service coordinator", team: "Customer service",  territory: "New England",     status: "Deactivated", lastActive: "Aug 30, 2024", avatar: "https://randomuser.me/api/portraits/women/12.jpg" },
  ...TECH_PROFILES.map((t, i): AppUser => ({
    id: `u-t${i}`, name: t.name, email: t.email, phone: t.phone, role: "Technician",
    team: TEAM_FOR[t.name] ?? "General service", territory: `${t.zone} zone`,
    status: "Active", lastActive: t.onLeave ? "Sep 20, 2024" : i % 2 ? "Today, 08:12 AM" : "Today, 07:54 AM", avatar: t.avatar,
  })),
  { id: "u-dc",    name: "Daniel Carter", email: "daniel.carter@serviceops.com", phone: "+1 732 555 0133", role: "Technician",          team: "HVAC & Mechanical", territory: "South zone",      status: "Invited", lastActive: "—",              avatar: "https://randomuser.me/api/portraits/men/11.jpg" },
];

// ─────────────────────────────────────────────
//  Customer roll-up (list columns + detail overview)
// ─────────────────────────────────────────────
export function customerStats(c: Customer) {
  const wos = workOrdersFor(c.name);
  const openWOs = wos.filter(w => !["Completed", "Cancelled"].includes(woStatus(w)));
  const jobs = ALL_JOBS.filter(j => j.customer === c.name);
  const activeJobs = jobs.filter(j => !["Completed", "Cancelled"].includes(j.status));
  const assets = assetsFor(c.id);
  const history = historyForCustomer(c.name);
  const doneDates = [...history.map(v => v.date), ...jobs.filter(j => j.status === "Completed" && j.scheduledAt <= TODAY + DAY_MS).map(j => j.scheduledAt)];
  const lastService = doneDates.length ? Math.max(...doneDates) : null;
  const nextVisit = activeJobs.map(j => j.scheduledAt).sort((a, b) => a - b)[0] ?? null;
  const invoices = invoicesFor(c.name);
  const balance = invoices.reduce((s, i) => s + outstanding(i), 0);
  const overdue = invoices.filter(i => i.status === "Overdue").reduce((s, i) => s + outstanding(i), 0);
  return { wos, openWOs, jobs, activeJobs, assets, history, lastService, nextVisit, invoices, balance, overdue };
}

export function addCustomer(input: {
  name: string; type: CustomerType; plan: ServicePlan; street: string; city: string; state: string; zip: string; phone: string; email: string;
  contactName: string; contactTitle: string; contactEmail: string; contactPhone: string; zone: ServiceZone;
}): Customer {
  const id = slugify(input.name);
  const c: Customer = {
    id, name: input.name.trim(), type: input.type, status: "Active", plan: input.plan,
    location: `${input.city.trim()}, ${input.state.trim().toUpperCase()}`,
    street: input.street.trim(), cityLine: `${input.city.trim()}, ${input.state.trim().toUpperCase()} ${input.zip.trim()}`.trim(),
    territory: input.state.toUpperCase() === "NJ" ? "Mid-Atlantic" : input.state.toUpperCase() === "CT" ? "New England" : "North East",
    zone: input.zone, phone: input.phone.trim() || "—", email: input.email.trim(), customerSince: `${MONTHS[JOBS_TODAY.getMonth()]} ${JOBS_TODAY.getFullYear()}`,
    paymentTerms: input.plan === "Pay per visit" ? "Net 15" : "Net 30", accountManager: "Alex Morgan", accessNotes: "",
  };
  CUSTOMERS.unshift(c);
  if (input.contactName.trim()) {
    CONTACTS.push({ id: `${id}-c1`, customerId: id, name: input.contactName.trim(), title: input.contactTitle.trim() || "Facilities Manager", email: input.contactEmail.trim(), phone: input.contactPhone.trim() || "—", primary: true, roles: ["Service requests", "Site access"] });
  }
  return c;
}

// ─────────────────────────────────────────────
//  Global search
// ─────────────────────────────────────────────
export interface SearchHit { kind: "Work order" | "Job" | "Customer" | "Asset" | "Part"; label: string; meta: string; href: string }
export function searchAll(q: string, limit = 4): SearchHit[] {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  const has = (...v: string[]) => v.some(x => x.toLowerCase().includes(s));
  const take = <T,>(arr: T[], f: (x: T) => boolean) => arr.filter(f).slice(0, limit);
  return [
    ...take(WORK_ORDERS, w => has(w.number, w.title, w.customer)).map(w => ({ kind: "Work order" as const, label: `${w.number} · ${w.title}`, meta: w.customer, href: `/work-orders/${w.id}` })),
    ...take(ALL_JOBS, j => has(j.jobId, j.jobName, j.customer, j.technician)).map(j => ({ kind: "Job" as const, label: `${j.jobId} · ${j.jobName}`, meta: `${j.customer} · ${j.technician}`, href: `/jobs/${j.id}` })),
    ...take(CUSTOMERS, c => has(c.name, c.location)).map(c => ({ kind: "Customer" as const, label: c.name, meta: c.location, href: `/customers/${c.id}` })),
    ...take(ASSETS, a => has(a.assetNo, a.name, a.model, a.serialNumber, a.customer)).map(a => ({ kind: "Asset" as const, label: `${a.assetNo} · ${a.name}`, meta: `${a.customer} · ${a.serialNumber}`, href: `/assets/${a.id}` })),
    ...take(PARTS, p => has(p.partNo, p.name)).map(p => ({ kind: "Part" as const, label: p.name, meta: p.partNo, href: `/inventory?part=${encodeURIComponent(p.partNo)}` })),
  ];
}

export { SLA_HOURS_BY_SERVICE };
