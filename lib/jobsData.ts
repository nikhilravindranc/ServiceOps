/**
 * Shared Jobs (Field Service work orders) demo dataset.
 * Consumed by the Jobs list page and the Job Details page so both
 * views stay in sync when navigating from a row to its detail screen.
 */

export type JobStatus =
  | "Yet to Start" | "Scheduled" | "En route" | "On site" | "Pending" | "Incomplete" | "Completed" | "Cancelled";

export type JobPriority = "High" | "Medium" | "Low";

export type ServiceType =
  | "HVAC" | "Mechanical" | "Plumbing" | "Electrical" | "Preventive" | "Elevator";

export interface JobRecord {
  id: number;
  jobId: string;
  jobName: string;
  customer: string;
  /** "City, ST" shown under the customer name. */
  location: string;
  serviceType: ServiceType;
  technician: string;
  priority: JobPriority;
  status: JobStatus;
  /** Epoch ms — the sort key for the Scheduled date column. */
  scheduledAt: number;
  scheduledDate: string;
  scheduledTime: string;
  etaLabel: string;
  slaLabel: string;
  slaHours: number;
  slaBreached: boolean;
  region: string;
  createdAt: string;
}

// ── Status palette — one hue per meaning, matching the job list reference
//    (blue = booked/moving, green = on site/done, amber = needs attention,
//    gray = not started, red = cancelled). ──
export const STATUS_ORDER: JobStatus[] = ["Yet to Start", "Scheduled", "En route", "On site", "Pending", "Incomplete", "Completed", "Cancelled"];

export interface StatusMeta { light: string; dark: string; bgLight: string; bgDark: string; }
const GRAY:  StatusMeta = { light: "#6B7280", dark: "#A1A1AA", bgLight: "rgba(107,114,128,0.12)", bgDark: "rgba(161,161,170,0.16)" };
const BLUE:  StatusMeta = { light: "#2563EB", dark: "#60A5FA", bgLight: "rgba(37,99,235,0.10)",   bgDark: "rgba(96,165,250,0.16)" };
const GREEN: StatusMeta = { light: "#16A34A", dark: "#4ADE80", bgLight: "rgba(22,163,74,0.10)",   bgDark: "rgba(74,222,128,0.16)" };
const AMBER: StatusMeta = { light: "#F59E0B", dark: "#FBBF24", bgLight: "rgba(245,158,11,0.12)",  bgDark: "rgba(251,191,36,0.16)" };
const RED:   StatusMeta = { light: "#EF4444", dark: "#F87171", bgLight: "rgba(239,68,68,0.10)",   bgDark: "rgba(248,113,113,0.16)" };

export const STATUS_META: Record<JobStatus, StatusMeta> = {
  "Yet to Start": GRAY,
  "Scheduled":    BLUE,
  "En route":     BLUE,
  "On site":      GREEN,
  "Pending":      GRAY,
  "Incomplete":   AMBER,
  "Completed":    GREEN,
  "Cancelled":    RED,
};

/** Buckets used by the KPI tiles (list page + dashboard wording). */
export type StatusGroup = "yetToStart" | "inProgress" | "cancelled" | "incomplete" | "completed";
export const STATUS_GROUP: Record<JobStatus, StatusGroup> = {
  "Yet to Start": "yetToStart", "Scheduled": "yetToStart", "Pending": "yetToStart",
  "En route": "inProgress", "On site": "inProgress",
  "Incomplete": "incomplete", "Completed": "completed", "Cancelled": "cancelled",
};

export const SERVICE_TYPE_ORDER: ServiceType[] = ["HVAC", "Mechanical", "Plumbing", "Electrical", "Preventive", "Elevator"];
const SERVICE_HUES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const SERVICE_HUES_DARK  = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c"];

export const SERVICE_TYPE_META: Record<ServiceType, { light: string; dark: string }> = Object.fromEntries(
  SERVICE_TYPE_ORDER.map((s, i) => [s, { light: SERVICE_HUES_LIGHT[i], dark: SERVICE_HUES_DARK[i] }])
) as Record<ServiceType, { light: string; dark: string }>;

// Priority reuses the same red/amber/green ordinal pattern already
// established elsewhere in the app (Tasks, Accounts priority pills).
export const PRIORITY_META: Record<JobPriority, { bg: string; text: string; bgDark: string; textDark: string }> = {
  High:   { bg: "#FEF2F2", text: "#DC2626", bgDark: "rgba(239,68,68,0.16)",  textDark: "#F87171" },
  Medium: { bg: "#FEF3C7", text: "#D97706", bgDark: "rgba(245,158,11,0.16)", textDark: "#FBBF24" },
  Low:    { bg: "#F0FDF4", text: "#16A34A", bgDark: "rgba(16,185,129,0.16)", textDark: "#34D399" },
};

export const SLA_HOURS_BY_SERVICE: Record<ServiceType, number> = {
  HVAC: 4, Mechanical: 3, Plumbing: 2, Electrical: 2, Preventive: 4, Elevator: 3,
};

export const TECHNICIANS = [
  "Michael Thomas", "Sarah Wilson", "Ravi Kumar", "Chris Walker",
  "Emily Johnson", "Daniel Smith", "James Lee", "Robert Davis",
] as const;

export const TECHNICIAN_AVATARS: Record<string, string> = {
  "Michael Thomas": "https://randomuser.me/api/portraits/men/32.jpg",
  "Sarah Wilson":   "https://randomuser.me/api/portraits/women/44.jpg",
  "Ravi Kumar":     "https://randomuser.me/api/portraits/men/75.jpg",
  "Chris Walker":   "https://randomuser.me/api/portraits/men/46.jpg",
  "Emily Johnson":  "https://randomuser.me/api/portraits/women/65.jpg",
  "Daniel Smith":   "https://randomuser.me/api/portraits/men/22.jpg",
  "James Lee":      "https://randomuser.me/api/portraits/men/36.jpg",
  "Robert Davis":   "https://randomuser.me/api/portraits/men/58.jpg",
};

export const TECHNICIAN_PHONES: Record<string, string> = {
  "Michael Thomas": "+1 212 555 0187",
  "Sarah Wilson":   "+1 212 555 0162",
  "Ravi Kumar":     "+1 646 555 0118",
  "Chris Walker":   "+1 917 555 0173",
  "Emily Johnson":  "+1 718 555 0125",
  "Daniel Smith":   "+1 201 555 0190",
  "James Lee":      "+1 203 555 0137",
  "Robert Davis":   "+1 212 555 0154",
};

export const TECHNICIAN_TITLES: Record<string, string> = {
  "Michael Thomas": "Senior Technician",
  "Sarah Wilson":   "Senior Technician",
  "Ravi Kumar":     "Field Technician",
  "Chris Walker":   "Electrical Technician",
  "Emily Johnson":  "Lead Technician",
  "Daniel Smith":   "HVAC Technician",
  "James Lee":      "Field Technician",
  "Robert Davis":   "Elevator Technician",
};

export const technicianEmail = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@serviceops.com`;

export const TECHNICIAN_RATINGS: Record<string, { rating: number; jobs: number }> = {
  "Michael Thomas": { rating: 4.8, jobs: 128 },
  "Sarah Wilson":   { rating: 4.7, jobs: 152 },
  "Ravi Kumar":     { rating: 4.6, jobs: 96 },
  "Chris Walker":   { rating: 4.5, jobs: 83 },
  "Emily Johnson":  { rating: 4.9, jobs: 214 },
  "Daniel Smith":   { rating: 4.6, jobs: 107 },
  "James Lee":      { rating: 4.4, jobs: 71 },
  "Robert Davis":   { rating: 4.7, jobs: 139 },
};

/** Customer → "City, ST". Order matters: the first eight feed the seed rows. */
export const CUSTOMER_LOCATIONS: Record<string, string> = {
  "ABC Manufacturing":   "New York, NY",
  "Global Electronics":  "Newark, NJ",
  "City Facilities":     "New York, NY",
  "Riverside Office":    "New York, NY",
  "Metro Hospital":      "Brooklyn, NY",
  "Sunrise Retail":      "Jersey City, NJ",
  "Lakeside Resort":     "Stamford, CT",
  "Pinnacle Apartments": "New York, NY",
  "Harbor View Hotel":   "Hoboken, NJ",
  "Summit Tech Park":    "White Plains, NY",
  "Greenfield School":   "Yonkers, NY",
  "Northgate Mall":      "Paramus, NJ",
  "Brookside Clinic":    "Queens, NY",
  "Oakwood Residences":  "Greenwich, CT",
};
const CUSTOMERS = Object.keys(CUSTOMER_LOCATIONS);

// Per-customer contact block, index-aligned with CUSTOMERS.
const STREETS = [
  "123 Industrial Way", "45 Commerce St", "300 Broadway", "18 River Rd", "250 Atlantic Ave",
  "77 Journal Sq", "9 Harbor Point Dr", "410 W 42nd St", "1 Sinatra Dr", "5 Summit Blvd",
  "60 Park Ave", "100 Route 17", "88-12 Queens Blvd", "22 Oak Ridge Ln",
];
const ZIPS = ["10001", "07102", "10007", "10004", "11217", "07306", "06902", "10036", "07030", "10601", "10701", "07652", "11373", "06830"];
const CONTACTS = [
  "John Davis", "Priya Shah", "Mark Allen", "Laura Chen", "Kevin Brooks", "Angela Ruiz", "Tom Harris",
  "Nina Patel", "Oscar Grant", "Rachel Kim", "Paul Martin", "Diane Moore", "Steve Clark", "Megan Wright",
];
const TERRITORY_BY_STATE: Record<string, string> = { NY: "North East", NJ: "Mid-Atlantic", CT: "New England" };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export interface CustomerContact {
  phone: string;
  email: string;
  address: string;
  /** Structured parts — present for directory customers, absent for ad-hoc ones from the Create Job form. */
  contactPerson?: string;
  street?: string;
  cityLine?: string;
  country?: string;
  territory?: string;
}

export const CUSTOMER_DIRECTORY: Record<string, CustomerContact> = Object.fromEntries(
  CUSTOMERS.map((c, i) => {
    const [first, last] = CONTACTS[i].toLowerCase().split(" ");
    const cityLine = `${CUSTOMER_LOCATIONS[c]} ${ZIPS[i]}`;
    return [c, {
      phone: `+1 212 555 ${String(187 + i * 7).padStart(4, "0")}`,
      email: i === 0 ? "john.davis@abc-mfg.com" : `${first}.${last}@${slugify(c)}.com`,
      address: `${STREETS[i]}, ${cityLine}, United States`,
      contactPerson: CONTACTS[i],
      street: STREETS[i],
      cityLine,
      country: "United States",
      territory: TERRITORY_BY_STATE[CUSTOMER_LOCATIONS[c].slice(-2)] ?? "North East",
    }];
  })
);

export const REGIONS = ["North", "South", "East", "West", "Central"];

// Selectable equipment per service type — powers the Product Model field on
// the Create Job form and the Asset row on the Job Details screen.
export const PRODUCT_MODELS: Record<ServiceType, string[]> = {
  HVAC:       ["Carrier WeatherMaker 48TC", "Trane Voyager RTU", "Daikin VRV IV", "Lennox Energence"],
  Mechanical: ["Ingersoll Rand R-Series Compressor", "Cummins C150 Generator", "Kohler 100REOZJ", "Atlas Copco GA 30"],
  Plumbing:   ["Grundfos CR 10 Booster", "Goulds e-SV Pump", "A.O. Smith Water Heater", "Watts Backflow Preventer"],
  Electrical: ["Square D QO Panel", "Siemens P1 Panelboard", "Eaton Pow-R-Line", "ABB Tmax Breaker"],
  Preventive: ["Facility PM Kit", "Rooftop Unit PM Kit", "Custom Equipment"],
  Elevator:   ["Otis Gen2", "Schindler 3300", "KONE MonoSpace", "ThyssenKrupp Evolution"],
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const idx = (i: number, len: number) => ((i % len) + len) % len;
const pad = (n: number) => String(n).length === 1 ? `0${n}` : `${n}`;

function clock(d: Date): string {
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${pad(hours12)}:${pad(d.getMinutes())} ${hours24 >= 12 ? "PM" : "AM"}`;
}

function stamp(d: Date, withYear = true): string {
  const date = `${MONTH_NAMES[d.getMonth()]} ${pad(d.getDate())}${withYear ? `, ${d.getFullYear()}` : ","}`;
  return `${date} ${clock(d)}`;
}

/** Scheduled-date columns for a job, derived from one Date. */
function scheduleFields(d: Date) {
  return {
    scheduledAt: d.getTime(),
    scheduledDate: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    scheduledTime: clock(d),
  };
}

/** "Today" for the demo dataset — the date-range presets are relative to it. */
export const JOBS_TODAY = new Date(2024, 8, 24);

const at = (dayOffset: number, hour: number, minute = 0) =>
  new Date(JOBS_TODAY.getFullYear(), JOBS_TODAY.getMonth(), JOBS_TODAY.getDate() + dayOffset, hour, minute);

// First eight rows are transcribed verbatim from the job list reference.
type SeedRow = Pick<JobRecord, "jobName" | "customer" | "serviceType" | "technician" | "priority" | "status" | "region"> & { when: Date };
const SEED_ROWS: SeedRow[] = [
  { jobName: "HVAC maintenance",       customer: "ABC Manufacturing",   serviceType: "HVAC",       when: at(0, 9),      status: "On site",      technician: "Michael Thomas", priority: "High",   region: "North"   },
  { jobName: "Compressor inspection",  customer: "Global Electronics",  serviceType: "Mechanical", when: at(0, 10, 30), status: "En route",     technician: "Sarah Wilson",   priority: "Medium", region: "South"   },
  { jobName: "Pump repair",            customer: "City Facilities",     serviceType: "Plumbing",   when: at(0, 12),     status: "Scheduled",    technician: "Ravi Kumar",     priority: "Low",    region: "Central" },
  { jobName: "Electrical panel check", customer: "Riverside Office",    serviceType: "Electrical", when: at(0, 13),     status: "Incomplete",   technician: "Chris Walker",   priority: "High",   region: "North"   },
  { jobName: "Routine service",        customer: "Metro Hospital",      serviceType: "Preventive", when: at(0, 14, 30), status: "Pending",      technician: "Emily Johnson",  priority: "Medium", region: "East"    },
  { jobName: "AC not cooling",         customer: "Sunrise Retail",      serviceType: "HVAC",       when: at(1, 9),      status: "Yet to Start", technician: "Daniel Smith",   priority: "High",   region: "South"   },
  { jobName: "Generator service",      customer: "Lakeside Resort",     serviceType: "Mechanical", when: at(1, 11),     status: "Cancelled",    technician: "James Lee",      priority: "Low",    region: "East"    },
  { jobName: "Elevator inspection",    customer: "Pinnacle Apartments", serviceType: "Elevator",   when: at(1, 15),     status: "Completed",    technician: "Robert Davis",   priority: "Medium", region: "West"    },
];

const JOB_NAMES: Record<ServiceType, string[]> = {
  HVAC:       ["HVAC maintenance", "AC not cooling", "Thermostat replacement", "Duct cleaning"],
  Mechanical: ["Compressor inspection", "Generator service", "Boiler inspection", "Pump overhaul"],
  Plumbing:   ["Pump repair", "Leak detection", "Water heater repair"],
  Electrical: ["Electrical panel check", "Lighting retrofit", "Wiring inspection"],
  Preventive: ["Routine service", "Quarterly inspection", "Safety audit"],
  Elevator:   ["Elevator inspection", "Escalator service", "Door sensor repair"],
};

// Status mix for the generated rows. Together with the seed rows this gives
// 61 jobs: 43 yet to start, 12 in progress, 1 incomplete, 4 completed, 1 cancelled.
const EXTRA_STATUSES: JobStatus[] = [
  ...Array.from({ length: 10 }, (_, i): JobStatus => (i % 2 ? "En route" : "On site")),
  "Completed", "Completed", "Completed",
  ...Array.from({ length: 40 }, (_, i): JobStatus => (["Scheduled", "Yet to Start", "Scheduled", "Pending"] as const)[i % 4]),
];
const EXTRA_SLOTS: [number, number][] = [[8, 0], [10, 30], [13, 0], [15, 30]];

const slaLabelFor = (status: JobStatus, serviceType: ServiceType) =>
  status === "Cancelled" ? "SLA: —" : `SLA: ${SLA_HOURS_BY_SERVICE[serviceType]} hrs`;

function buildJobs(): JobRecord[] {
  const rows: JobRecord[] = SEED_ROWS.map(({ when, ...r }, i) => ({
    ...r,
    id: i + 1,
    jobId: `JOB-${10481 + i}`,
    location: CUSTOMER_LOCATIONS[r.customer],
    ...scheduleFields(when),
    etaLabel: r.status === "Cancelled" ? "—" : stamp(when, false),
    slaHours: SLA_HOURS_BY_SERVICE[r.serviceType],
    slaLabel: slaLabelFor(r.status, r.serviceType),
    slaBreached: r.status === "Incomplete",
    createdAt: stamp(new Date(when.getTime() - (2 + i) * 24 * 3600 * 1000)),
  }));

  const n = EXTRA_STATUSES.length;
  for (let i = 0; i < n; i++) {
    const id = SEED_ROWS.length + i + 1;
    const serviceType = SERVICE_TYPE_ORDER[idx(i, SERVICE_TYPE_ORDER.length)];
    const names = JOB_NAMES[serviceType];
    const customer = CUSTOMERS[idx(i * 5 + 3, CUSTOMERS.length)];
    // 37 is coprime with the row count, so this spreads the statuses evenly through the dates.
    const status = EXTRA_STATUSES[idx(i * 37, n)];
    const [h, m] = EXTRA_SLOTS[i % EXTRA_SLOTS.length];
    const when = at(2 + Math.floor(i / EXTRA_SLOTS.length), h, m);
    rows.push({
      id,
      jobId: `JOB-${10481 + id - 1}`,
      jobName: names[idx(Math.floor(i / SERVICE_TYPE_ORDER.length), names.length)],
      customer,
      location: CUSTOMER_LOCATIONS[customer],
      serviceType,
      technician: TECHNICIANS[idx(i * 3 + 1, TECHNICIANS.length)],
      priority: (["High", "Medium", "Low"] as const)[idx(i * 5, 3)],
      status,
      ...scheduleFields(when),
      etaLabel: status === "Cancelled" ? "—" : stamp(when, false),
      slaHours: SLA_HOURS_BY_SERVICE[serviceType],
      slaLabel: slaLabelFor(status, serviceType),
      slaBreached: idx(i, 17) === 5 && status !== "Completed",
      region: REGIONS[idx(i, REGIONS.length)],
      createdAt: stamp(new Date(when.getTime() - (2 + (i % 5)) * 24 * 3600 * 1000)),
    });
  }
  return rows;
}

export const ALL_JOBS: JobRecord[] = buildJobs();

export const getJobById = (id: number): JobRecord | undefined => ALL_JOBS.find(j => j.id === id);

// ─────────────────────────────────────────────
//  Job creation
//  There's no backend in this build, so a created
//  job is unshifted into ALL_JOBS — that keeps the
//  listing and the details screen (getJobById,
//  Related Jobs) resolving it for the whole session.
// ─────────────────────────────────────────────

/** Free-text detail captured on the Create Job form but not part of the list row. */
export interface JobExtras {
  jobTitle: string;
  description: string;
  scheduleStart: string;
  scheduleEnd: string;
  productModel: string;
  serialNumber: string;
  notes: string;
}

export const JOB_EXTRAS: Record<number, JobExtras> = {
  // The showcase job — transcribed from the Job Details reference.
  1: {
    jobTitle: "HVAC maintenance",
    description: "Scheduled maintenance for rooftop HVAC unit including inspection, cleaning, filter replacement and performance check. Ensure system is operating within recommended parameters.",
    scheduleStart: "2024-09-24T09:00",
    scheduleEnd: "2024-09-24T12:00",
    productModel: "Rooftop HVAC Unit - RTU-01",
    serialNumber: "A-1001",
    notes: "Customer requested to check the noise levels and update filter condition.\nPrevious maintenance completed on Jun 18, 2024.",
  },
};

export interface NewJobInput {
  customer: string;
  address: string;
  email: string;
  city: string;
  phone: string;
  state: string;
  pincode: string;
  region: string;
  serviceType: ServiceType;
  priority: JobPriority;
  status: JobStatus;
  jobTitle: string;
  description: string;
  scheduleStart: string; // datetime-local value
  scheduleEnd: string;   // datetime-local value
  technician: string;
  productModel: string;
  serialNumber: string;
  notes: string;
}

/** "2026-08-14T10:00" → "Aug 14, 10:00 AM" — matches the ETA column format. */
export function formatEtaLabel(datetimeLocal: string): string {
  if (!datetimeLocal) return "—";
  const d = new Date(datetimeLocal);
  return Number.isNaN(d.getTime()) ? "—" : stamp(d, false);
}

/** Scheduled-date fields from a datetime-local value, or null when it's empty/invalid. */
function scheduleFromInput(datetimeLocal: string) {
  if (!datetimeLocal) return null;
  const d = new Date(datetimeLocal);
  return Number.isNaN(d.getTime()) ? null : scheduleFields(d);
}

export function createJob(input: NewJobInput): JobRecord {
  const customer = input.customer.trim();
  const slaHours = SLA_HOURS_BY_SERVICE[input.serviceType];
  const id = ALL_JOBS.reduce((max, j) => Math.max(max, j.id), 0) + 1;
  const nextNumber = ALL_JOBS.reduce((max, j) => {
    const n = Number(j.jobId.replace(/\D/g, ""));
    return Number.isFinite(n) && n > max ? n : max;
  }, 10480) + 1;

  const job: JobRecord = {
    id,
    jobId: `JOB-${nextNumber}`,
    jobName: input.jobTitle.trim() || `${input.serviceType} service`,
    customer,
    location: [input.city, input.state].map(p => p.trim()).filter(Boolean).join(", ") || CUSTOMER_LOCATIONS[customer] || input.region,
    serviceType: input.serviceType,
    technician: input.technician,
    priority: input.priority,
    status: input.status,
    ...(scheduleFromInput(input.scheduleStart) ?? scheduleFields(new Date())),
    etaLabel: formatEtaLabel(input.scheduleStart),
    slaLabel: slaLabelFor(input.status, input.serviceType),
    slaHours,
    slaBreached: false,
    region: input.region,
    createdAt: stamp(new Date()),
  };

  ALL_JOBS.unshift(job);

  JOB_EXTRAS[id] = {
    jobTitle: input.jobTitle.trim(),
    description: input.description.trim(),
    scheduleStart: input.scheduleStart,
    scheduleEnd: input.scheduleEnd,
    productModel: input.productModel.trim(),
    serialNumber: input.serialNumber.trim(),
    notes: input.notes.trim(),
  };

  // Fold the contact block into the shared directory so the details screen
  // shows what was entered instead of its generated placeholder.
  const composedAddress = [input.address, input.city, input.state, input.pincode]
    .map(p => p.trim()).filter(Boolean).join(", ");
  const existing = CUSTOMER_DIRECTORY[customer];
  if (composedAddress || input.email.trim() || input.phone.trim()) {
    CUSTOMER_DIRECTORY[customer] = {
      ...existing,
      // A newly typed address supersedes the structured street/city parts.
      ...(composedAddress ? { street: undefined, cityLine: undefined, country: undefined } : {}),
      phone:   input.phone.trim()   || existing?.phone   || "—",
      email:   input.email.trim()   || existing?.email   || `facility@${slugify(customer)}.com`,
      address: composedAddress      || existing?.address || `${customer}, ${input.city.trim() || input.region}`,
    };
  }

  return job;
}

// ─────────────────────────────────────────────
//  Job workspace — everything the details screen
//  lets a user add or change after creation.
//  Same session-scoped, in-memory model as ALL_JOBS.
// ─────────────────────────────────────────────

export interface JobPhoto      { id: string; name: string; src: string; at: string }
export interface JobNote       { id: string; text: string; author: string; at: string }
export interface JobAttachment { id: string; name: string; size: string }
export interface JobPart       { item: string; qty: number; rate: number }
export interface JobActivity   { label: string; at: string }
export interface JobInvoice    { number: string; generatedAt: string }

export interface JobWorkspace {
  photos: JobPhoto[];
  /** Guards the one-time seeding of the job's pre-existing site photos. */
  photosSeeded: boolean;
  notes: JobNote[];
  attachments: JobAttachment[];
  /** Parts added on this screen, appended to the service-type defaults. */
  extraParts: JobPart[];
  /** Entries logged by user actions, appended after the derived history. */
  activity: JobActivity[];
  invoice: JobInvoice | null;
  /** Set once the invoice has been paid (recorded in the office or through a payment link). */
  paidOn?: number;
  /** null until the user ticks something — then it owns the checklist. */
  checklist: boolean[] | null;
}

const DEFAULT_ATTACHMENTS: JobAttachment[] = [
  { id: "seed-1", name: "Work Order.pdf",         size: "245 KB" },
  { id: "seed-2", name: "Customer Complaint.jpg", size: "1.2 MB" },
  { id: "seed-3", name: "Quotation.pdf",          size: "180 KB" },
];

const WORKSPACES: Record<number, JobWorkspace> = {};
/** Exposed so the workspace snapshot can save and restore per-job notes, photos, parts and invoices. */
export const WORKSPACE_STORE = WORKSPACES;

export function getWorkspace(id: number): JobWorkspace {
  if (!WORKSPACES[id]) {
    WORKSPACES[id] = {
      photos: [], photosSeeded: false, notes: [],
      attachments: DEFAULT_ATTACHMENTS.map(a => ({ ...a })),
      extraParts: [], activity: [], invoice: null, checklist: null,
    };
  }
  return WORKSPACES[id];
}

/**
 * Materialise the job's pre-existing on-site photos once, so uploads and
 * deletions operate on a single list. Seeded entries carry no src and render
 * as placeholder tiles.
 */
export function seedJobPhotos(id: number, count: number): void {
  const ws = getWorkspace(id);
  if (ws.photosSeeded) return;
  ws.photosSeeded = true;
  for (let i = 0; i < count; i++) {
    ws.photos.push({ id: uid("photo"), name: `Site photo ${i + 1}.jpg`, src: "", at: "" });
  }
}

let seq = 0;
const uid = (prefix: string) => `${prefix}-${++seq}`;

/** Timestamp in the same format as JobRecord.createdAt. */
export const nowStamp = (): string => stamp(new Date());

export function logActivity(id: number, label: string): void {
  getWorkspace(id).activity.push({ label, at: nowStamp() });
}

/** Patch a job in place. SLA and ETA are re-derived from the new values. */
export function updateJob(id: number, patch: Partial<Omit<JobRecord, "id" | "jobId">>): JobRecord | undefined {
  const job = ALL_JOBS.find(j => j.id === id);
  if (!job) return undefined;

  Object.assign(job, patch);

  if (patch.serviceType) job.slaHours = SLA_HOURS_BY_SERVICE[patch.serviceType];
  if (patch.serviceType || patch.status) {
    job.slaLabel = slaLabelFor(job.status, job.serviceType);
  }
  if (job.status === "Completed" || job.status === "Cancelled") job.slaBreached = false;

  return job;
}

/** Edit-form counterpart of NewJobInput — the fields the edit drawer owns. */
export interface EditJobInput {
  customer: string;
  serviceType: ServiceType;
  priority: JobPriority;
  status: JobStatus;
  technician: string;
  region: string;
  jobTitle: string;
  description: string;
  scheduleStart: string;
  scheduleEnd: string;
  productModel: string;
  serialNumber: string;
  notes: string;
  phone: string;
  email: string;
  address: string;
}

export function editJob(id: number, input: EditJobInput): JobRecord | undefined {
  const customer = input.customer.trim();
  const schedule = scheduleFromInput(input.scheduleStart);
  const job = updateJob(id, {
    customer,
    serviceType: input.serviceType,
    priority: input.priority,
    status: input.status,
    technician: input.technician,
    region: input.region,
    ...(input.jobTitle.trim() ? { jobName: input.jobTitle.trim() } : {}),
    ...(CUSTOMER_LOCATIONS[customer] ? { location: CUSTOMER_LOCATIONS[customer] } : {}),
    ...(schedule ? { ...schedule, etaLabel: formatEtaLabel(input.scheduleStart) } : {}),
  });
  if (!job) return undefined;

  JOB_EXTRAS[id] = {
    ...(JOB_EXTRAS[id] ?? { jobTitle: "", description: "", scheduleStart: "", scheduleEnd: "", productModel: "", serialNumber: "", notes: "" }),
    jobTitle: input.jobTitle.trim(),
    description: input.description.trim(),
    scheduleStart: input.scheduleStart,
    scheduleEnd: input.scheduleEnd,
    productModel: input.productModel.trim(),
    serialNumber: input.serialNumber.trim(),
    notes: input.notes.trim(),
  };

  if (input.phone.trim() || input.email.trim() || input.address.trim()) {
    const existing = CUSTOMER_DIRECTORY[job.customer];
    const addressChanged = !!input.address.trim() && input.address.trim() !== existing?.address;
    CUSTOMER_DIRECTORY[job.customer] = {
      ...existing,
      ...(addressChanged ? { street: undefined, cityLine: undefined, country: undefined } : {}),
      phone:   input.phone.trim()   || existing?.phone   || "—",
      email:   input.email.trim()   || existing?.email   || `facility@${slugify(job.customer)}.com`,
      address: input.address.trim() || existing?.address || job.customer,
    };
  }

  logActivity(id, `Job ${job.jobId} details updated`);
  return job;
}

export function addJobPhotos(id: number, files: { name: string; src: string }[]): JobPhoto[] {
  const ws = getWorkspace(id);
  const added = files.map(f => ({ id: uid("photo"), name: f.name, src: f.src, at: nowStamp() }));
  ws.photos.push(...added);
  logActivity(id, `${added.length} photo${added.length > 1 ? "s" : ""} uploaded`);
  return added;
}

export function removeJobPhoto(id: number, photoId: string): void {
  const ws = getWorkspace(id);
  const photo = ws.photos.find(p => p.id === photoId);
  ws.photos = ws.photos.filter(p => p.id !== photoId);
  if (photo) logActivity(id, `Photo "${photo.name}" removed`);
}

export function addJobNote(id: number, text: string, author = "Admin"): JobNote {
  const note = { id: uid("note"), text: text.trim(), author, at: nowStamp() };
  getWorkspace(id).notes.unshift(note);
  logActivity(id, "Internal note added");
  return note;
}

export function removeJobNote(id: number, noteId: string): void {
  const ws = getWorkspace(id);
  ws.notes = ws.notes.filter(n => n.id !== noteId);
}

export function addJobAttachments(id: number, files: { name: string; size: string }[]): void {
  const ws = getWorkspace(id);
  ws.attachments.push(...files.map(f => ({ id: uid("att"), name: f.name, size: f.size })));
  logActivity(id, `${files.length} file${files.length > 1 ? "s" : ""} attached`);
}

export function removeJobAttachment(id: number, attachmentId: string): void {
  const ws = getWorkspace(id);
  ws.attachments = ws.attachments.filter(a => a.id !== attachmentId);
}

export function addJobPart(id: number, part: JobPart): void {
  getWorkspace(id).extraParts.push(part);
  logActivity(id, `Part added — ${part.item} × ${part.qty}`);
}

export function removeJobPart(id: number, index: number): void {
  const ws = getWorkspace(id);
  ws.extraParts = ws.extraParts.filter((_, i) => i !== index);
}

export function generateInvoice(id: number): JobInvoice {
  const ws = getWorkspace(id);
  const job = ALL_JOBS.find(j => j.id === id);
  ws.invoice = { number: `INV-${job?.jobId.replace(/^\D+-/, "") ?? id}`, generatedAt: nowStamp() };
  logActivity(id, `Invoice ${ws.invoice.number} generated`);
  return ws.invoice;
}

export function setJobChecklist(id: number, checklist: boolean[]): void {
  getWorkspace(id).checklist = checklist;
}

/** Human-readable size for an uploaded File. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pre-fills the edit drawer from whatever the job currently holds. */
export function toEditInput(job: JobRecord): EditJobInput {
  const extras = JOB_EXTRAS[job.id];
  const contact = CUSTOMER_DIRECTORY[job.customer];
  return {
    customer: job.customer,
    serviceType: job.serviceType,
    priority: job.priority,
    status: job.status,
    technician: job.technician,
    region: job.region,
    jobTitle: extras?.jobTitle ?? job.jobName,
    description: extras?.description ?? "",
    scheduleStart: extras?.scheduleStart ?? "",
    scheduleEnd: extras?.scheduleEnd ?? "",
    productModel: extras?.productModel ?? "",
    serialNumber: extras?.serialNumber ?? "",
    notes: extras?.notes ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    address: contact?.address ?? "",
  };
}
