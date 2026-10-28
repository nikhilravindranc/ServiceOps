"use client";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/ThemeContext";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Checkbox from "@mui/material/Checkbox";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import InputBase from "@mui/material/InputBase";
import {
  House, CaretRight, PencilSimple, DotsThree, Printer, Phone, Star, PhoneCall, NavigationArrow,
  Plus, Image as ImageIcon, Camera, UserSwitch, ClipboardText, FileText, CalendarPlus, XCircle,
  CheckCircle, Sparkle, Trash, UploadSimple, Note, Paperclip, WarningCircle, Info, CurrencyDollar,
  Copy, ArrowSquareOut, Buildings, Wrench, LinkSimple, ClockCounterClockwise, GridFour, List,
  Package, Notepad, ShieldCheck, User, Path, Flag, Globe, Clock, CalendarBlank, HourglassHigh,
  Pulse, Envelope, MapPin, UserCircle, Car, FlagCheckered, Ruler, Timer,
} from "@phosphor-icons/react";
import EditJobDrawer from "@/components/jobs/EditJobDrawer";
import JobActionDialogs, { type JobDialogKind } from "@/components/jobs/JobActionDialogs";
import JobPrintSheet, { type PrintKind, type PrintPayload } from "@/components/jobs/JobPrintSheet";
import { CARD_SHADOW, type Tone } from "@/components/dashboard/DashboardSection";
import DonutWithLegend from "@/components/dashboard/DonutWithLegend";
import {
  getJobById, STATUS_META, PRIORITY_META, TECHNICIAN_AVATARS, TECHNICIAN_PHONES, TECHNICIAN_TITLES,
  TECHNICIAN_RATINGS, CUSTOMER_DIRECTORY, ALL_JOBS, JOB_EXTRAS, technicianEmail,
  getWorkspace, seedJobPhotos, editJob, updateJob, logActivity, createJob,
  addJobPhotos, removeJobPhoto, addJobNote, removeJobNote,
  addJobAttachments, removeJobAttachment, addJobPart, removeJobPart,
  generateInvoice, setJobChecklist, toEditInput, formatFileSize, nowStamp,
  type JobRecord, type ServiceType, type JobStatus, type EditJobInput, type JobPart,
} from "@/lib/jobsData";
import { workOrderForJob, assetForJob, customerHref } from "@/lib/serviceData";

// ─────────────────────────────────────────────
//  Per-service-type template data (drives the
//  Service Information / Parts / AI panels for
//  every job that isn't the hand-authored JOB-10481)
// ─────────────────────────────────────────────
interface ServiceTemplate {
  problem: string; category: string; jobType: string; asset: string; durationHrs: number;
  laborCharge: number; parts: { item: string; qty: number; rate: number }[];
  recommendations: string[];
}
const SERVICE_TEMPLATES: Record<ServiceType, ServiceTemplate> = {
  HVAC: {
    problem: "Reduced Airflow", category: "Ventilation Issue", jobType: "Preventive Maintenance", asset: "Rooftop HVAC Unit", durationHrs: 3, laborCharge: 2200,
    parts: [{ item: "Air Filter (Set)", qty: 2, rate: 600 }, { item: "Duct Sealant", qty: 1, rate: 450 }, { item: "Fan Belt", qty: 1, rate: 750 }],
    recommendations: ["Duct pressure below optimal range.", "Filter change overdue by 2 weeks.", "Recommend full duct cleaning in 20 days.", "Energy usage up 9% vs last quarter."],
  },
  Mechanical: {
    problem: "Equipment Not Starting", category: "Mechanical Fault", jobType: "Inspection", asset: "Air Compressor", durationHrs: 3, laborCharge: 1800,
    parts: [{ item: "Engine Oil (4L)", qty: 1, rate: 1400 }, { item: "Air Filter", qty: 1, rate: 900 }, { item: "Battery Terminal", qty: 2, rate: 350 }],
    recommendations: ["Fuel filter nearing service interval.", "Battery health at 72% — replace soon.", "Recommend load test within 30 days.", "AMC renewal due next quarter."],
  },
  Plumbing: {
    problem: "Pipe Leakage", category: "Plumbing Issue", jobType: "Corrective Repair", asset: "Booster Pump", durationHrs: 2, laborCharge: 800,
    parts: [{ item: "PVC Pipe (5ft)", qty: 2, rate: 300 }, { item: "Pipe Joint", qty: 4, rate: 120 }, { item: "Sealant Tape", qty: 2, rate: 80 }],
    recommendations: ["Similar leak reported on same line.", "Water pressure above recommended range.", "Recommend line inspection in 30 days.", "Fixture warranty expires soon."],
  },
  Electrical: {
    problem: "Power Fluctuation", category: "Electrical Fault", jobType: "Inspection", asset: "Distribution Panel", durationHrs: 2, laborCharge: 1000,
    parts: [{ item: "MCB Switch", qty: 2, rate: 850 }, { item: "Wiring Cable (10m)", qty: 1, rate: 1100 }, { item: "Circuit Breaker", qty: 1, rate: 1600 }],
    recommendations: ["Repeat fault logged in last 60 days.", "Panel load nearing rated capacity.", "Recommend thermal scan in 15 days.", "Insulation resistance trending down."],
  },
  Preventive: {
    problem: "Scheduled Preventive Maintenance", category: "Preventive Maintenance", jobType: "Preventive Maintenance", asset: "Facility Equipment", durationHrs: 2, laborCharge: 900,
    parts: [{ item: "Service Kit", qty: 1, rate: 1500 }],
    recommendations: ["No prior history for this asset.", "Recommend condition audit next cycle.", "Next preventive visit not yet scheduled."],
  },
  Elevator: {
    problem: "Periodic Safety Inspection", category: "Vertical Transport", jobType: "Inspection", asset: "Passenger Elevator", durationHrs: 3, laborCharge: 2000,
    parts: [{ item: "Door Sensor", qty: 1, rate: 1800 }, { item: "Guide Shoe Liner", qty: 4, rate: 250 }, { item: "Lubricant", qty: 1, rate: 400 }],
    recommendations: ["Door re-open events up 12% this month.", "Rope wear within tolerance.", "Recommend load test before next certification.", "Inspection certificate renews in 45 days."],
  },
};

const STEP_ORDER = ["Job Created", "Technician Assigned", "Technician Accepted", "On the Way", "Reached Site", "Work Started", "Work Completed", "Invoice Generated"];
const STEP_DONE_COUNT: Record<JobStatus, number> = {
  "Yet to Start": 1, Scheduled: 2, Pending: 2, "En route": 3, "On site": 6, Incomplete: 6, Completed: 8, Cancelled: 1,
};
const CHECKLIST_ITEMS = ["Inspection", "Diagnose Issue", "Replace / Repair", "Testing", "Customer Sign", "Close Job"];

// Job progress is tracked as four field tasks per visit.
const TASK_COUNT = 4;
const TASKS_DONE: Record<JobStatus, number> = {
  "Yet to Start": 0, Scheduled: 0, Pending: 0, "En route": 1, "On site": 2, Incomplete: 3, Completed: 4, Cancelled: 0,
};

type TripStatus = "Not started" | "En route" | "Arrived" | "Cancelled";
const TRIP_STATUS: Record<JobStatus, TripStatus> = {
  "Yet to Start": "Not started", Scheduled: "Not started", Pending: "Not started",
  "En route": "En route", "On site": "Arrived", Incomplete: "Arrived", Completed: "Arrived", Cancelled: "Cancelled",
};
const TRIP_TONE: Record<TripStatus, JobStatus> = { "Not started": "Yet to Start", "En route": "En route", Arrived: "On site", Cancelled: "Cancelled" };

const DEPOT = "123 Service Center, New York, NY";
const TIME_ZONE = "EST (UTC-5)";
const PRODUCT_SITES = ["Roof", "Basement", "Level 2", "Mechanical Room"];

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const hrs = (n: number) => `${n} ${n === 1 ? "hr" : "hrs"}`;

function clock(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function starRating(rating: number, size = 13) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} weight={rating >= i + 1 ? "fill" : rating > i ? "duotone" : "regular"}
          color={rating > i ? "#F59E0B" : "#E2E8F0"} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Derive a full detail view-model from the base
//  JobRecord (shared with the listing page).
// ─────────────────────────────────────────────
function buildDetail(job: JobRecord) {
  const tmpl = SERVICE_TEMPLATES[job.serviceType];
  const isPrimary = job.id === 1;
  // Present for the showcase job and for jobs raised through the Create/Edit
  // forms — those values win over the per-service-type template defaults.
  const extras = JOB_EXTRAS[job.id];
  const ws = getWorkspace(job.id);

  const customerInfo = CUSTOMER_DIRECTORY[job.customer] ?? {
    phone: "—",
    email: `facility@${job.customer.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
    address: `${job.customer}, ${job.location}`,
  };

  // Schedule window — the form's start/end when set, otherwise the list's scheduled slot + template duration.
  const start = new Date(extras?.scheduleStart || job.scheduledAt);
  const endFromForm = extras?.scheduleEnd ? new Date(extras.scheduleEnd) : null;
  const durationHrs = endFromForm && endFromForm > start
    ? Math.round(((endFromForm.getTime() - start.getTime()) / 3600000) * 10) / 10
    : tmpl.durationHrs;
  const end = new Date(start.getTime() + durationHrs * 3600000);
  const timeRange = `${clock(start)} – ${clock(end)}`;

  const productModel = extras?.productModel || `${tmpl.asset} - ${job.serviceType.slice(0, 3).toUpperCase()}-${String(job.id).padStart(2, "0")}`;
  const serialNumber = extras?.serialNumber || `${job.serviceType.charAt(0)}-${1000 + job.id}`;
  const productLocation = isPrimary ? "Building A - Roof" : `Building ${"ABCD"[job.id % 4]} - ${PRODUCT_SITES[job.id % PRODUCT_SITES.length]}`;
  const asset = `${productModel} (${serialNumber})`;
  const warranty = isPrimary ? "Valid Till 12 Dec 2026" : `Valid Till ${(job.id % 28) + 1} ${["Jan", "Mar", "Jun", "Sep", "Nov"][job.id % 5]} 202${6 + (job.id % 3)}`;
  const amcStatus = isPrimary ? "Active (Gold Plan)" : job.id % 3 === 0 ? "Not Enrolled" : `Active (${job.id % 2 === 0 ? "Silver" : "Gold"} Plan)`;

  const doneCount = STEP_DONE_COUNT[job.status] ?? 1;
  const cancelled = job.status === "Cancelled";
  const checklistChecked = cancelled ? 0 : Math.max(0, Math.min(CHECKLIST_ITEMS.length, doneCount - 1));

  // Four field tasks: done / in progress / overdue / pending.
  const tasksDone = TASKS_DONE[job.status];
  const tasksInProgress = job.status === "En route" || job.status === "On site" ? 1 : 0;
  const tasksOverdue = job.status === "Incomplete" || job.slaBreached ? Math.min(1, TASK_COUNT - tasksDone - tasksInProgress) : 0;
  const tasks = {
    done: tasksDone, inProgress: tasksInProgress, overdue: tasksOverdue,
    pending: TASK_COUNT - tasksDone - tasksInProgress - tasksOverdue,
  };

  // Trip from the depot to site, leaving an hour before the visit.
  const trip = {
    startLocation: DEPOT,
    startTime: clock(new Date(start.getTime() - 3600000)),
    endLocation: job.customer,
    travelTime: isPrimary ? "30 mins" : `${20 + ((job.id * 7) % 40)} mins`,
    distance: isPrimary ? "12.5 miles" : `${(4 + ((job.id * 37) % 180) / 10).toFixed(1)} miles`,
    status: isPrimary ? "En route" as TripStatus : TRIP_STATUS[job.status],
  };

  const parts = [...tmpl.parts, ...ws.extraParts];
  const partsTotal = parts.reduce((s, p) => s + p.qty * p.rate, 0);
  const labor = isPrimary ? 1200 : tmpl.laborCharge;
  const discount = isPrimary ? 325 : job.id % 4 === 0 ? 150 : 0;
  const tax = Math.round((labor + partsTotal) * 0.18);
  const total = labor + partsTotal + tax - discount;
  const paymentStatus = ws.invoice
    ? "Pending"
    : job.status === "Completed" ? (job.id % 3 === 0 ? "Pending" : "Paid") : job.status === "Cancelled" ? "N/A" : "Pending";

  const seedPhotoCount = isPrimary ? 3 : ["On site", "En route", "Incomplete", "Completed"].includes(job.status) ? (job.id % 4) + 1 : 0;

  const feedbackRating = isPrimary ? 4.5 : Math.round((3.6 + ((job.id * 7) % 14) / 10) * 10) / 10;
  // NPS-style index: 3.0★ maps to 0, 5.0★ maps to 100.
  const nps = Math.max(-100, Math.min(100, Math.round(((feedbackRating - 3) / 2) * 100)));
  const npsBand = nps >= 80 ? "Excellent" : nps >= 60 ? "Good" : nps >= 30 ? "Fair" : "Needs Work";

  const recs: { text: string; tone: "critical" | "warning" | "good" }[] = isPrimary
    ? [
        { text: "Similar noise complaint reported 3 months ago.", tone: "critical" },
        { text: "Rooftop unit performance dropped by 15%.", tone: "warning" },
        { text: "Recommend filter replacement every 90 days.", tone: "good" },
        { text: "Warranty expires in 12 days.", tone: "critical" },
      ]
    : tmpl.recommendations.map((text, i) => ({ text, tone: (["critical", "warning", "good"] as const)[i % 3] }));

  // Activity log — generated from the same step progression as the timeline,
  // then extended with anything the user has done on this screen.
  const stepVerb = (i: number) => ([
    `Job ${job.jobId} created`, `Technician ${job.technician} assigned`, `Technician ${job.technician} accepted the job`,
    `Technician ${job.technician} is on the way`, "Technician reached the site", "Work started on-site",
    "Work completed on-site", "Invoice generated",
  ])[i];
  const shownSteps = cancelled ? [0] : Array.from({ length: Math.min(doneCount, 8) }, (_, i) => i);
  const activity = shownSteps.map(i => ({
    label: i === 0 ? `${stepVerb(0)} by Admin` : stepVerb(i),
    at: `${job.createdAt.split(",")[0]}, ${(9 + i)}:${i === 0 ? "30" : (30 + i * 5) % 60} ${9 + i >= 12 ? "PM" : "AM"}`,
  }));
  if (cancelled) activity.push({ label: `Job ${job.jobId} was cancelled`, at: job.createdAt.split(",")[0] });
  activity.push(...ws.activity);

  // Related jobs are always real records, so every row navigates.
  const sameCustomer = ALL_JOBS.filter(j => j.id !== job.id && j.customer === job.customer);
  const sameService = ALL_JOBS.filter(j => j.id !== job.id && j.serviceType === job.serviceType && j.customer !== job.customer);
  const related = [...sameCustomer, ...sameService].slice(0, 12);

  // Alerts surface the highest-signal facts already present elsewhere.
  const breachedSiblings = sameCustomer.filter(j => j.slaBreached).length;
  const alerts: { tone: "critical" | "warning" | "info"; text: string }[] = [];
  if (job.slaBreached) alerts.push({ tone: "critical", text: `SLA breached on ${job.jobId} — escalate to supervisor` });
  if (breachedSiblings > 0) alerts.push({ tone: "critical", text: `SLA breached in ${breachedSiblings} previous job${breachedSiblings > 1 ? "s" : ""} for this customer` });
  const warn = recs.find(r => r.tone === "warning");
  if (warn) alerts.push({ tone: "warning", text: warn.text });
  alerts.push({ tone: "info", text: `Warranty ${warranty.replace("Valid Till", "valid till")}` });
  if (paymentStatus === "Pending" && job.status === "Completed") {
    alerts.push({ tone: "warning", text: "Payment still pending against this job" });
  }

  return {
    customerInfo, asset, warranty, amcStatus, productModel, serialNumber, productLocation,
    jobTitle: extras?.jobTitle || job.jobName,
    problem: extras?.jobTitle || tmpl.problem,
    description: extras?.description ?? "",
    notes: extras?.notes ?? "",
    category: tmpl.category, jobType: tmpl.jobType, durationHrs, timeRange, start, end,
    doneCount, cancelled, checklistChecked, tasks, trip,
    parts, templatePartCount: tmpl.parts.length, partsTotal, labor, discount, tax, total,
    paymentStatus, seedPhotoCount, feedbackRating, nps, npsBand, recs, activity, related, alerts,
  };
}

// ─────────────────────────────────────────────
//  Presentational helpers
// ─────────────────────────────────────────────
const TABS = [
  { key: "overview",    label: "Overview" },
  { key: "services",    label: "Services and Parts" },
  { key: "timesheet",   label: "Time Sheet" },
  { key: "tripsheet",   label: "Trip Sheet" },
  { key: "attachments", label: "Attachments" },
  { key: "related",     label: "Related" },
  { key: "history",     label: "History" },
] as const;
type TabKey = typeof TABS[number]["key"];

const MENU_PAPER_SX = { borderRadius: "12px", border: "1px solid var(--border)", minWidth: 210, mt: 0.75 };
const MENU_ITEM_SX = { mx: 0.5, borderRadius: "8px", py: 0.9 };
const MENU_TEXT = { fontSize: "14px" };

/** Small outlined "✎ Edit" button used in every card header. */
function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-button-sm font-semibold text-[var(--text-primary)] hover:border-blue-500 hover:text-blue-600 transition-colors flex-shrink-0">
      <PencilSimple size={16} weight="bold" />
      {label}
    </button>
  );
}

function DetailCard({ icon: Icon, title, action, children, className = "" }: {
  icon: typeof FileText; title: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 sm:p-5 min-w-0 ${className}`} style={{ boxShadow: CARD_SHADOW }}>
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Icon size={24} className="flex-shrink-0 text-blue-600" />
          <h2 className="m-0 text-h2 font-bold text-[var(--text-primary)] truncate">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Label/value pair in a two-column definition grid (parent sets the columns). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-body text-[var(--text-muted)]">{label}</dt>
      <dd className="m-0 text-body text-[var(--text-primary)] min-w-0 break-words">{children}</dd>
    </>
  );
}

/** Icon + label + value row (Job details schedule, Customer, Technician, Trip details). */
function IconField({ icon: Icon, label, children, labelClass = "text-body" }: {
  icon: typeof FileText; label: string; children: ReactNode; labelClass?: string;
}) {
  return (
    <div className="grid grid-cols-[20px_minmax(96px,auto)_minmax(0,1fr)] items-center gap-x-3">
      <Icon size={18} className="text-blue-600" />
      <dt className={`${labelClass} text-[var(--text-muted)] whitespace-nowrap`}>{label}</dt>
      <dd className="m-0 text-body text-[var(--text-primary)] min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Pill({ status, label, isDark }: { status: JobStatus; label?: string; isDark: boolean }) {
  const m = STATUS_META[status];
  const color = isDark ? m.dark : m.light;
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-badge-text font-medium whitespace-nowrap"
      style={{ backgroundColor: isDark ? m.bgDark : m.bgLight, color }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {label ?? status}
    </span>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-1.5 text-body text-[var(--text-faint)]">
      <Icon size={26} weight="duotone" />
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────
export default function JobDetail({ jobId }: { jobId: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Every mutation happens against the shared dataset; bumping this pulls the
  // fresh record back through the memos below.
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  const job = useMemo(() => getJobById(jobId), [jobId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const detail = useMemo(() => job ? buildDetail(job) : null, [job, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const ws = job ? getWorkspace(job.id) : null;

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [moreAnchor, setMoreAnchor]   = useState<HTMLElement | null>(null);
  const [editOpen, setEditOpen]       = useState(false);
  const [dialog, setDialog]           = useState<JobDialogKind>(null);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; name: string } | null>(null);
  const [printPayload, setPrintPayload] = useState<PrintPayload | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [toast, setToast] = useState<{ msg: string; href?: string } | null>(null);
  const [attachView, setAttachView] = useState<"list" | "grid">("list");

  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput  = useRef<HTMLInputElement>(null);

  // Materialise the job's existing site photos once so uploads/deletes work
  // against a single list.
  useEffect(() => {
    if (!job || !detail) return;
    seedJobPhotos(job.id, detail.seedPhotoCount);
    refresh();
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const notify = (msg: string, href?: string) => setToast({ msg, href });

  // ── Print ────────────────────────────────────
  const buildPrintPayload = useCallback((kind: PrintKind): PrintPayload | null => {
    if (!job || !detail || !ws) return null;
    const checked = ws.checklist ?? CHECKLIST_ITEMS.map((_, i) => i < detail.checklistChecked);
    return {
      kind, job,
      customer: detail.customerInfo,
      problem: detail.problem, category: detail.category, asset: detail.asset,
      warranty: detail.warranty, amcStatus: detail.amcStatus, durationHrs: detail.durationHrs,
      description: detail.description, notes: detail.notes,
      parts: detail.parts, labor: detail.labor, partsTotal: detail.partsTotal,
      tax: detail.tax, discount: detail.discount, total: detail.total,
      paymentStatus: detail.paymentStatus,
      invoiceNumber: ws.invoice?.number ?? null,
      checklist: CHECKLIST_ITEMS.map((label, i) => ({ label, done: !!checked[i] })),
      timeline: STEP_ORDER.map((label, i) => ({ label, done: !detail.cancelled && i < detail.doneCount })),
      printedAt: nowStamp(),
    };
  }, [job, detail, ws]);

  const handlePrint = (kind: PrintKind) => {
    const payload = buildPrintPayload(kind);
    if (!payload) return;
    setPrintPayload(payload);
    setMoreAnchor(null);
    // Let the sheet commit to the DOM before handing off to the browser.
    window.setTimeout(() => {
      window.print();
      logActivity(payload.job.id, `${kind === "invoice" ? "Invoice" : "Job card"} printed`);
      refresh();
    }, 80);
  };

  if (!job || !detail || !ws) {
    return (
      <div className="sidebar-content flex-1 flex flex-col min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="m-0 mb-2 text-h1 text-[var(--text-primary)]">Job not found</p>
            <button onClick={() => router.push("/jobs")} className="text-body underline text-[var(--text-primary)]">Back to Jobs</button>
          </div>
        </div>
      </div>
    );
  }

  const activeChecklist = ws.checklist ?? CHECKLIST_ITEMS.map((_, i) => i < detail.checklistChecked);
  const toggleChecklist = (i: number) => {
    const next = [...activeChecklist];
    next[i] = !next[i];
    setJobChecklist(job.id, next);
    refresh();
  };

  const priorityMeta = PRIORITY_META[job.priority];
  const techRating = TECHNICIAN_RATINGS[job.technician];
  const techPhone = TECHNICIAN_PHONES[job.technician] ?? "—";
  const techEmail = technicianEmail(job.technician);
  const contact = detail.customerInfo;
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(contact.address)}`;

  // ── Action handlers ──────────────────────────
  const handleEditSave = (input: EditJobInput) => {
    editJob(job.id, input);
    refresh();
    notify(`${job.jobId} updated`);
  };

  const handleAssign = (technician: string) => {
    updateJob(job.id, { technician });
    logActivity(job.id, `Technician reassigned to ${technician}`);
    refresh();
    notify(`Assigned to ${technician}`);
  };

  const handleStatus = (status: JobStatus) => {
    updateJob(job.id, { status });
    logActivity(job.id, `Status changed to ${status}`);
    refresh();
    notify(`Status set to ${status}`);
  };

  const handleInvoice = () => {
    const inv = generateInvoice(job.id);
    refresh();
    notify(`${inv.number} generated`);
  };

  const handleFollowUp = (when: string, note: string) => {
    const extras = JOB_EXTRAS[job.id];
    const followUp = createJob({
      customer: job.customer,
      address: contact.address, email: contact.email, city: "", phone: contact.phone,
      state: "", pincode: "", region: job.region,
      serviceType: job.serviceType, priority: job.priority, status: "Scheduled",
      jobTitle: `Follow-up · ${detail.jobTitle}`,
      description: note || `Follow-up visit for ${job.jobId}.`,
      scheduleStart: when, scheduleEnd: when,
      technician: job.technician,
      productModel: extras?.productModel ?? "", serialNumber: extras?.serialNumber ?? "",
      notes: `Raised from ${job.jobId}.`,
    });
    logActivity(job.id, `Follow-up ${followUp.jobId} scheduled`);
    refresh();
    notify(`Follow-up ${followUp.jobId} scheduled`, `/jobs/${followUp.id}`);
  };

  const handleCloseJob = (resolution: string) => {
    updateJob(job.id, { status: "Completed" });
    setJobChecklist(job.id, CHECKLIST_ITEMS.map(() => true));
    logActivity(job.id, resolution.trim() ? `Job closed — ${resolution.trim()}` : "Job closed");
    refresh();
    notify(`${job.jobId} closed`);
  };

  const handleAddPart = (part: JobPart) => {
    addJobPart(job.id, part);
    refresh();
    notify(`${part.item} added`);
  };

  const handleClone = () => {
    const extras = JOB_EXTRAS[job.id];
    const copy = createJob({
      customer: job.customer,
      address: contact.address, email: contact.email, city: "", phone: contact.phone,
      state: "", pincode: "", region: job.region,
      serviceType: job.serviceType, priority: job.priority, status: "Scheduled",
      jobTitle: detail.jobTitle, description: detail.description,
      scheduleStart: extras?.scheduleStart ?? "", scheduleEnd: extras?.scheduleEnd ?? "",
      technician: job.technician,
      productModel: extras?.productModel ?? "", serialNumber: extras?.serialNumber ?? "",
      notes: `Cloned from ${job.jobId}.`,
    });
    notify(`Cloned as ${copy.jobId}`, `/jobs/${copy.id}`);
  };

  const handleCancelJob = () => {
    updateJob(job.id, { status: "Cancelled" });
    logActivity(job.id, "Job cancelled");
    setMoreAnchor(null);
    refresh();
    notify(`${job.jobId} cancelled`);
  };

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const images = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (images.length === 0) return;
    Promise.all(images.map(file => new Promise<{ name: string; src: string }>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, src: String(reader.result ?? "") });
      reader.readAsDataURL(file);
    }))).then(loaded => {
      addJobPhotos(job.id, loaded);
      refresh();
      notify(`${loaded.length} photo${loaded.length > 1 ? "s" : ""} added`);
    });
  };

  const handleAttachmentFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    addJobAttachments(job.id, Array.from(files).map(f => ({ name: f.name, size: formatFileSize(f.size) })));
    refresh();
    notify(`${files.length} file${files.length > 1 ? "s" : ""} attached`);
  };

  const submitNote = () => {
    if (!noteDraft.trim()) return;
    addJobNote(job.id, noteDraft);
    setNoteDraft("");
    refresh();
  };

  const openDialog = (kind: JobDialogKind) => { setMoreAnchor(null); setDialog(kind); };
  const openEdit = () => { setMoreAnchor(null); setEditOpen(true); };

  const ALERT_TONE = {
    critical: { color: "#EF4444", bg: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2", icon: XCircle },
    warning:  { color: "#F59E0B", bg: isDark ? "rgba(245,158,11,0.12)" : "#FFFBEB", icon: WarningCircle },
    info:     { color: "#2563EB", bg: isDark ? "rgba(37,99,235,0.14)" : "#EFF6FF", icon: Info },
  } as const;

  const progressSlices: { label: string; value: number; tone: Tone }[] = [
    { label: "Completed",   value: detail.tasks.done,       tone: "green" },
    { label: "In Progress", value: detail.tasks.inProgress, tone: "blue" },
    { label: "Pending",     value: detail.tasks.pending,    tone: "gray" },
    { label: "Overdue",     value: detail.tasks.overdue,    tone: "red" },
  ];

  // ── Reusable cards (shared by Overview and the detail tabs) ──
  const tripRows = (
    <dl className="m-0 flex flex-col gap-2.5">
      <IconField icon={MapPin} label="Start location" labelClass="text-caption">{detail.trip.startLocation}</IconField>
      <IconField icon={Clock} label="Start time" labelClass="text-caption">{detail.trip.startTime}</IconField>
      <IconField icon={FlagCheckered} label="End location" labelClass="text-caption">{detail.trip.endLocation}</IconField>
      <IconField icon={Timer} label="Estimated travel time" labelClass="text-caption">{detail.trip.travelTime}</IconField>
      <IconField icon={Ruler} label="Distance" labelClass="text-caption">{detail.trip.distance}</IconField>
      <IconField icon={Car} label="Trip status" labelClass="text-caption">
        <Pill status={TRIP_TONE[detail.trip.status]} label={detail.trip.status} isDark={isDark} />
      </IconField>
    </dl>
  );

  const partsCard = (
    <DetailCard icon={Wrench} title="Parts & materials"
      action={
        <Button size="small" variant="contained" startIcon={<Plus size={14} weight="bold" />} onClick={() => setDialog("addPart")}>
          Add item
        </Button>
      }>
      <div className="overflow-x-auto">
        <table className="so-table w-full min-w-[480px]">
          <thead>
            <tr>
              <th className="text-left px-4">Item</th>
              <th className="text-right px-4">Qty</th>
              <th className="text-right px-4">Rate</th>
              <th className="text-right px-4">Amount</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {detail.parts.map((p, i) => {
              const isExtra = i >= detail.templatePartCount;
              return (
                <tr key={`${p.item}-${i}`} className="group">
                  <td className="px-4 text-table-cell text-[var(--text-primary)]">{p.item}</td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{p.qty}</td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{money(p.rate)}</td>
                  <td className="px-4 text-right text-table-cell font-semibold text-[var(--text-primary)]">{money(p.qty * p.rate)}</td>
                  <td className="text-right">
                    {isExtra && (
                      <Tooltip title="Remove item">
                        <IconButton size="small" className="opacity-0 group-hover:opacity-100"
                          onClick={() => { removeJobPart(job.id, i - detail.templatePartCount); refresh(); }}
                          sx={{ p: 0.4, transition: "opacity 0.15s" }}>
                          <Trash size={14} color="#EF4444" weight="duotone" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3} className="px-4 text-right text-label text-[var(--text-muted)]">Parts total</td>
              <td className="px-4 text-right text-label font-bold text-[var(--text-primary)]">{money(detail.partsTotal)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </DetailCard>
  );

  const invoiceCard = (
    <DetailCard icon={CurrencyDollar} title="Invoice"
      action={!ws.invoice && (
        <Button size="small" variant="contained" startIcon={<FileText size={14} weight="bold" />} onClick={() => setDialog("invoice")}>
          Generate
        </Button>
      )}>
      <div className="flex flex-col gap-2">
        {ws.invoice && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2 mb-2 bg-[var(--serviceops-tint)]">
            <div>
              <p className="m-0 text-label font-bold text-[var(--text-primary)]">{ws.invoice.number}</p>
              <p className="m-0 text-caption text-[var(--text-muted)]">Generated {ws.invoice.generatedAt}</p>
            </div>
            <Button size="small" startIcon={<Printer size={14} weight="duotone" />} onClick={() => handlePrint("invoice")}>Print</Button>
          </div>
        )}
        {([["Labour charges", detail.labor], ["Parts & materials", detail.partsTotal], ["Tax (18%)", detail.tax], ["Discount", -detail.discount]] as [string, number][]).map(([label, val]) => (
          <div key={label} className="flex items-center justify-between text-body">
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className="text-[var(--text-primary)]">{val < 0 ? "-" : ""}{money(Math.abs(val))}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--border-soft)]">
          <span className="text-label font-bold text-[var(--text-primary)]">Total amount</span>
          <span className="text-h2 font-bold text-[var(--text-primary)]">{money(detail.total)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-caption text-[var(--text-muted)]">Payment status</span>
          <Pill isDark={isDark} label={detail.paymentStatus}
            status={detail.paymentStatus === "Paid" ? "Completed" : detail.paymentStatus === "N/A" ? "Yet to Start" : "Incomplete"} />
        </div>
      </div>
    </DetailCard>
  );

  // ── Render ───────────────────────────────────
  return (
    <div className="sidebar-content flex-1 flex flex-col min-h-screen">
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 animate-fade-in">

        {/* ── Breadcrumb ── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-3 text-body text-[var(--text-body)]">
          <Link href="/" aria-label="Home" className="hover:text-[var(--serviceops-primary)] transition-colors"><House size={20} /></Link>
          <CaretRight size={12} className="text-[var(--text-muted)]" />
          <Link href="/jobs" className="hover:text-[var(--serviceops-primary)] transition-colors">Jobs</Link>
          <CaretRight size={12} className="text-[var(--text-muted)]" />
          <span className="text-[var(--text-primary)] truncate">{job.jobId}</span>
        </nav>

        {/* ── Tabs + page actions ── */}
        <div className="flex flex-col-reverse lg:flex-row lg:items-center gap-3 lg:gap-6 border-b border-[var(--border)]">
          <div role="tablist" aria-label="Job sections" className="flex items-center gap-1 sm:gap-4 xl:gap-8 overflow-x-auto -mb-px">
            {TABS.map(t => (
              <button key={t.key} role="tab" type="button" aria-selected={activeTab === t.key} onClick={() => setActiveTab(t.key)}
                className={`px-3 py-3.5 whitespace-nowrap text-body border-b-2 transition-colors ${
                  activeTab === t.key
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent text-[var(--text-primary)] hover:text-blue-600"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 lg:ml-auto lg:pb-2 flex-shrink-0">
            <button type="button" onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-button-sm font-semibold transition-colors">
              <PencilSimple size={16} weight="bold" /> Edit job
            </button>
            <button type="button" onClick={handleClone}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] text-button-sm font-semibold hover:border-blue-500 transition-colors">
              <Copy size={16} weight="bold" /> Clone
            </button>
            <IconButton aria-label="More actions" onClick={e => setMoreAnchor(e.currentTarget)}
              sx={{ width: 40, height: 40, borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text-primary)", bgcolor: "var(--bg-card)", "&:hover": { bgcolor: "var(--serviceops-tint)" } }}>
              <DotsThree size={20} weight="bold" />
            </IconButton>
            <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{ paper: { sx: MENU_PAPER_SX } }}>
              {([
                ["Assign technician",  UserSwitch,   () => openDialog("assign")],
                ["Change status",      PencilSimple, () => openDialog("status")],
                ["Generate invoice",   FileText,     () => openDialog("invoice")],
                ["Schedule follow-up", CalendarPlus, () => openDialog("followUp")],
                ["Close job",          CheckCircle,  () => openDialog("close")],
              ] as [string, typeof FileText, () => void][]).map(([label, Icon, onClick]) => (
                <MenuItem key={label} onClick={onClick} sx={MENU_ITEM_SX}>
                  <ListItemIcon sx={{ minWidth: 30 }}><Icon size={16} weight="duotone" /></ListItemIcon>
                  <ListItemText primaryTypographyProps={MENU_TEXT}>{label}</ListItemText>
                </MenuItem>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={() => handlePrint("card")} sx={MENU_ITEM_SX}>
                <ListItemIcon sx={{ minWidth: 30 }}><ClipboardText size={16} weight="duotone" /></ListItemIcon>
                <ListItemText primaryTypographyProps={MENU_TEXT}>Print job card</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => handlePrint("invoice")} sx={MENU_ITEM_SX}>
                <ListItemIcon sx={{ minWidth: 30 }}><Printer size={16} weight="duotone" /></ListItemIcon>
                <ListItemText primaryTypographyProps={MENU_TEXT}>Print invoice</ListItemText>
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleCancelJob} disabled={job.status === "Cancelled"} sx={{ ...MENU_ITEM_SX, color: "#EF4444" }}>
                <ListItemIcon sx={{ minWidth: 30 }}><XCircle size={16} color="#EF4444" weight="duotone" /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ ...MENU_TEXT, color: "#EF4444" }}>Cancel job</ListItemText>
              </MenuItem>
            </Menu>
          </div>
        </div>

        {/* ══════════════ OVERVIEW ══════════════ */}
        {activeTab === "overview" && (
          // `md:grid-cols-1` opts out of the global tablet auto-fit rule for .grid-cols-1
          <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
            <div className="flex flex-col gap-4 min-w-0">

              {/* Job details */}
              <DetailCard icon={FileText} title="Job details" action={<EditButton onClick={() => setEditOpen(true)} />}>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-y-5">
                  <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[135px_minmax(0,1fr)] gap-x-4 gap-y-4 items-start sm:pl-2 lg:pr-6">
                    <Field label="Job ID">{job.jobId}</Field>
                    {(() => { const wo = workOrderForJob(job.id); return wo ? <Field label="Work order"><Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:underline">{wo.number}</Link></Field> : null; })()}
                    <Field label="Job title">{detail.jobTitle}</Field>
                    <Field label="Description">
                      <span className="text-[var(--text-body)]">{detail.description || "—"}</span>
                    </Field>
                    <Field label="Job type">{detail.jobType}</Field>
                    <Field label="Service type">{job.serviceType}</Field>
                    <Field label="Priority">
                      <span className="inline-flex items-center gap-3">
                        <Flag size={20} weight="fill" style={{ color: isDark ? priorityMeta.textDark : priorityMeta.text }} />
                        <span className="rounded-full px-4 py-1 text-badge-text font-medium"
                          style={{ backgroundColor: isDark ? priorityMeta.bgDark : priorityMeta.bg, color: isDark ? priorityMeta.textDark : priorityMeta.text }}>
                          {job.priority}
                        </span>
                      </span>
                    </Field>
                  </dl>

                  <dl className="m-0 flex flex-col gap-5 border-t border-[var(--border-soft)] pt-5 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6 sm:pl-2">
                    <IconField icon={CalendarBlank} label="Scheduled date" labelClass="text-caption">{job.scheduledDate}</IconField>
                    <IconField icon={Clock} label="Time" labelClass="text-caption">{detail.timeRange}</IconField>
                    <IconField icon={HourglassHigh} label="Estimated duration" labelClass="text-caption">{hrs(detail.durationHrs)}</IconField>
                    <IconField icon={Globe} label="Time zone">{TIME_ZONE}</IconField>
                    <IconField icon={Pulse} label="Status"><Pill status={job.status} isDark={isDark} /></IconField>
                  </dl>
                </div>
              </DetailCard>

              {/* Product information */}
              <DetailCard icon={Package} title="Product information" action={<EditButton onClick={() => setEditOpen(true)} />}>
                <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] sm:grid-cols-[176px_minmax(0,1fr)] gap-x-4 gap-y-4 sm:pl-10">
                  <Field label="Product model">{(() => { const a = assetForJob(job.id); return a ? <Link href={`/assets/${a.id}`} className="hover:text-blue-600 hover:underline">{detail.productModel}</Link> : detail.productModel; })()}</Field>
                  <Field label="Serial number">{detail.serialNumber}</Field>
                  <Field label="Location">{detail.productLocation}</Field>
                </dl>
              </DetailCard>

              {/* Notes */}
              <DetailCard icon={Notepad} title="Notes" action={<EditButton onClick={() => setEditOpen(true)} />}>
                <p className="m-0 sm:pl-10 pb-4 text-body text-[var(--text-body)] whitespace-pre-line">
                  {detail.notes || "No notes added for this job."}
                </p>
              </DetailCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 min-w-0">
              {/* Customer */}
              <DetailCard icon={Buildings} title="Customer" action={<EditButton onClick={() => setEditOpen(true)} />}>
                <div className="flex items-start gap-4 mb-5">
                  <span className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-xl bg-blue-50 text-blue-600 flex-shrink-0">
                    <Buildings size={36} weight="duotone" />
                  </span>
                  <div className="min-w-0">
                    <Link href={customerHref(job.customer)} className="m-0 block text-label font-bold text-[var(--text-primary)] hover:text-blue-600 hover:underline">{job.customer}</Link>
                    {contact.street ? (
                      <>
                        <p className="m-0 text-body text-[var(--text-body)]">{contact.street}</p>
                        <p className="m-0 text-body text-[var(--text-body)]">{contact.cityLine}</p>
                        <p className="m-0 text-body text-[var(--text-body)]">{contact.country}</p>
                      </>
                    ) : (
                      <p className="m-0 text-body text-[var(--text-body)]">{contact.address}</p>
                    )}
                  </div>
                </div>
                <dl className="m-0 flex flex-col gap-2.5">
                  <IconField icon={UserCircle} label="Contact person">{contact.contactPerson ?? "—"}</IconField>
                  <IconField icon={Envelope} label="Email">
                    <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                  </IconField>
                  <IconField icon={Phone} label="Phone">
                    <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:underline">{contact.phone}</a>
                  </IconField>
                  <IconField icon={MapPin} label="Territory">{contact.territory ?? job.region}</IconField>
                </dl>
              </DetailCard>

              {/* Job progress */}
              <DetailCard icon={ShieldCheck} title="Job progress">
                <div className="sm:px-4">
                  <DonutWithLegend data={progressSlices} centerValue={`${detail.tasks.done}/${TASK_COUNT}`}
                    centerLabel="Tasks" unit="tasks" innerRadius="84%" />
                </div>
              </DetailCard>

              {/* Technician */}
              <DetailCard icon={User} title="Technician" action={<EditButton onClick={() => setDialog("assign")} />}>
                <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-2 items-center">
                  <Avatar src={TECHNICIAN_AVATARS[job.technician]} alt={job.technician} sx={{ width: 56, height: 56 }} />
                  <div className="min-w-0">
                    <p className="m-0 text-label font-bold text-[var(--text-primary)]">{job.technician}</p>
                    <p className="m-0 text-body text-[var(--text-body)]">{TECHNICIAN_TITLES[job.technician] ?? "Field Technician"}</p>
                  </div>
                  <Phone size={16} className="justify-self-center text-[var(--text-body)]" />
                  <a href={`tel:${techPhone.replace(/\s/g, "")}`} className="text-body text-[var(--text-body)] hover:underline truncate">{techPhone}</a>
                  <Envelope size={16} className="justify-self-center text-[var(--text-body)]" />
                  <a href={`mailto:${techEmail}`} className="text-body text-[var(--text-body)] hover:underline truncate">{techEmail}</a>
                </div>
              </DetailCard>

              {/* Trip details */}
              <DetailCard icon={Path} title="Trip details" action={<EditButton onClick={() => setActiveTab("tripsheet")} />}>
                {tripRows}
              </DetailCard>
            </div>
          </div>
        )}

        {/* ══════════════ SERVICES AND PARTS ══════════════ */}
        {activeTab === "services" && (
          <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
            {partsCard}
            {invoiceCard}
          </div>
        )}

        {/* ══════════════ TIME SHEET ══════════════ */}
        {activeTab === "timesheet" && (
          <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
            <DetailCard icon={Clock} title="Time sheet">
              <div className="overflow-x-auto">
                <table className="so-table w-full min-w-[560px]">
                  <thead>
                    <tr>{["Activity", "Technician", "Date", "Start", "End", "Duration"].map(h => <th key={h} className="text-left px-4">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Travel to site", from: detail.trip.startTime, to: clock(detail.start), dur: detail.trip.travelTime },
                      { label: "On-site work",   from: clock(detail.start),   to: clock(detail.end),   dur: hrs(detail.durationHrs) },
                    ].map(r => (
                      <tr key={r.label}>
                        <td className="px-4 text-table-cell text-[var(--text-primary)]">{r.label}</td>
                        <td className="px-4 text-table-cell text-[var(--text-body)]">{job.technician}</td>
                        <td className="px-4 text-table-cell text-[var(--text-body)]">{job.scheduledDate}</td>
                        <td className="px-4 text-table-cell text-[var(--text-body)]">{r.from}</td>
                        <td className="px-4 text-table-cell text-[var(--text-body)]">{r.to}</td>
                        <td className="px-4 text-table-cell font-semibold text-[var(--text-primary)]">{r.dur}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailCard>

            <DetailCard icon={CheckCircle} title="Checklist">
              <div className="flex flex-col gap-0.5 -mx-1">
                {CHECKLIST_ITEMS.map((item, i) => (
                  <label key={item} className="flex items-center gap-1.5 px-1 py-1 rounded-lg cursor-pointer hover:bg-[var(--serviceops-tint)] transition-colors">
                    <Checkbox size="small" checked={!!activeChecklist[i]} onChange={() => toggleChecklist(i)}
                      sx={{ p: 0.5, color: "var(--text-faint)", "&.Mui-checked": { color: "#16A34A" } }} />
                    <span className={`text-body ${activeChecklist[i] ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>{item}</span>
                  </label>
                ))}
              </div>
            </DetailCard>
          </div>
        )}

        {/* ══════════════ TRIP SHEET ══════════════ */}
        {activeTab === "tripsheet" && (
          <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
            <DetailCard icon={Path} title="Trip details">{tripRows}</DetailCard>
            <DetailCard icon={NavigationArrow} title="On the road">
              <div className="grid grid-cols-2 gap-3">
                <a href={mapsHref} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-[var(--serviceops-tint)] text-button-sm text-[var(--text-primary)] hover:bg-[var(--serviceops-soft)] transition-colors">
                  <NavigationArrow size={20} weight="duotone" /> Directions
                </a>
                <a href={`tel:${techPhone.replace(/\s/g, "")}`}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-[var(--serviceops-tint)] text-button-sm text-[var(--text-primary)] hover:bg-[var(--serviceops-soft)] transition-colors">
                  <PhoneCall size={20} weight="duotone" /> Call technician
                </a>
              </div>
            </DetailCard>
          </div>
        )}

        {/* ══════════════ ATTACHMENTS ══════════════ */}
        {activeTab === "attachments" && (
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <DetailCard icon={Camera} title="Photos"
              action={
                <>
                  <input ref={photoInput} type="file" accept="image/*" multiple hidden
                    onChange={e => { handlePhotoFiles(e.target.files); e.target.value = ""; }} />
                  <Button size="small" variant="outlined" startIcon={<UploadSimple size={14} weight="bold" />} onClick={() => photoInput.current?.click()}>
                    Add photos
                  </Button>
                </>
              }>
              {ws.photos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ws.photos.map(photo => (
                    <div key={photo.id} className="relative group">
                      <button onClick={() => photo.src && setPhotoPreview({ src: photo.src, name: photo.name })}
                        className={`w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center border border-[var(--border-soft)] bg-[var(--serviceops-tint)] ${photo.src ? "cursor-zoom-in" : "cursor-default"}`}>
                        {photo.src
                          // Data-URL thumbnails from the file picker — next/image can't optimise these.
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={photo.src} alt={photo.name} className="w-full h-full object-cover" />
                          : <ImageIcon size={20} className="text-[var(--text-faint)]" weight="duotone" />}
                      </button>
                      <Tooltip title="Remove photo">
                        <IconButton size="small"
                          onClick={() => { removeJobPhoto(job.id, photo.id); refresh(); }}
                          sx={{
                            position: "absolute", top: 4, right: 4, p: 0.4, opacity: 0,
                            bgcolor: "rgba(0,0,0,0.55)", transition: "opacity 0.15s",
                            ".group:hover &": { opacity: 1 },
                            "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
                          }}>
                          <Trash size={12} color="#fff" weight="bold" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              ) : <EmptyState icon={Camera} text="No photos yet" />}
            </DetailCard>

            <DetailCard icon={Paperclip} title="Files"
              action={
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg p-0.5 gap-0.5 bg-[var(--serviceops-tint)]">
                    {[{ k: "list", Icon: List }, { k: "grid", Icon: GridFour }].map(({ k, Icon }) => (
                      <button key={k} type="button" aria-label={`${k} view`} onClick={() => setAttachView(k as "list" | "grid")}
                        className={`p-1 rounded-md transition-colors ${attachView === k ? "bg-[var(--bg-card)] text-blue-600" : "text-[var(--text-muted)]"}`}>
                        <Icon size={14} weight="duotone" />
                      </button>
                    ))}
                  </div>
                  <input ref={fileInput} type="file" multiple hidden
                    onChange={e => { handleAttachmentFiles(e.target.files); e.target.value = ""; }} />
                  <Button size="small" variant="outlined" startIcon={<UploadSimple size={14} weight="bold" />} onClick={() => fileInput.current?.click()}>
                    Attach
                  </Button>
                </div>
              }>
              {ws.attachments.length === 0 ? (
                <EmptyState icon={Paperclip} text="No attachments yet" />
              ) : attachView === "list" ? (
                <div className="flex flex-col gap-1">
                  {ws.attachments.map(a => (
                    <div key={a.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--serviceops-tint)] transition-colors">
                      <FileText size={16} color="#EF4444" weight="duotone" className="flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-body text-[var(--text-primary)]">{a.name}</span>
                      <span className="text-caption flex-shrink-0 text-[var(--text-muted)]">{a.size}</span>
                      <Tooltip title="Remove">
                        <IconButton size="small" onClick={() => { removeJobAttachment(job.id, a.id); refresh(); }}
                          sx={{ p: 0.3, opacity: 0, transition: "opacity 0.15s", ".group:hover &": { opacity: 1 } }}>
                          <Trash size={13} color="#EF4444" weight="duotone" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ws.attachments.map(a => (
                    <div key={a.id} className="group relative flex flex-col items-center justify-center gap-1.5 aspect-square rounded-lg border border-[var(--border-soft)] bg-[var(--serviceops-tint)] px-2 text-center">
                      <FileText size={22} color="#EF4444" weight="duotone" />
                      <span className="text-caption truncate w-full text-[var(--text-primary)]">{a.name}</span>
                      <Tooltip title="Remove">
                        <IconButton size="small" onClick={() => { removeJobAttachment(job.id, a.id); refresh(); }}
                          sx={{ position: "absolute", top: 4, right: 4, p: 0.3, opacity: 0, transition: "opacity 0.15s", ".group:hover &": { opacity: 1 } }}>
                          <Trash size={12} color="#EF4444" weight="bold" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </DetailCard>
          </div>
        )}

        {/* ══════════════ RELATED ══════════════ */}
        {activeTab === "related" && (
          <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
            <DetailCard icon={LinkSimple} title="Related jobs">
              <div className="overflow-x-auto">
                <table className="so-table w-full min-w-[640px]">
                  <thead>
                    <tr>{["Job #", "Job name", "Customer", "Scheduled date", "Status"].map(h => <th key={h} className="text-left px-4 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {detail.related.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-body text-[var(--text-faint)]">No related jobs</td></tr>
                    ) : detail.related.map(r => (
                      <tr key={r.id} onClick={() => router.push(`/jobs/${r.id}`)} className="cursor-pointer">
                        <td className="px-4 text-table-cell font-semibold text-blue-600 whitespace-nowrap">{r.jobId}</td>
                        <td className="px-4 text-table-cell text-[var(--text-primary)] whitespace-nowrap">{r.jobName}</td>
                        <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{r.customer}</td>
                        <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{r.scheduledDate}</td>
                        <td className="px-4"><Pill status={r.status} isDark={isDark} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailCard>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 min-w-0">
              <DetailCard icon={WarningCircle} title="Alerts">
                <div className="flex flex-col gap-2">
                  {detail.alerts.map((a, i) => {
                    const tone = ALERT_TONE[a.tone];
                    const Icon = tone.icon;
                    return (
                      <div key={i} className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: tone.bg }}>
                        <Icon size={16} color={tone.color} weight="fill" className="mt-0.5 flex-shrink-0" />
                        <span className="text-body text-[var(--text-primary)]">{a.text}</span>
                      </div>
                    );
                  })}
                </div>
              </DetailCard>

              <DetailCard icon={Sparkle} title="AI recommendation">
                <div className="flex flex-col gap-2.5">
                  {detail.recs.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                        style={{ backgroundColor: r.tone === "critical" ? "#EF4444" : r.tone === "warning" ? "#F59E0B" : "#16A34A" }} />
                      <span className="text-body text-[var(--text-body)]">{r.text}</span>
                    </div>
                  ))}
                </div>
              </DetailCard>

              <DetailCard icon={Star} title="Customer feedback">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="m-0 mb-2 text-caption text-[var(--text-muted)]">Overall rating</p>
                    {starRating(detail.feedbackRating, 18)}
                    <p className="m-0 mt-2 text-h2 font-bold text-[var(--text-primary)]">{detail.feedbackRating}/5</p>
                  </div>
                  <div>
                    <p className="m-0 mb-2 text-caption text-[var(--text-muted)]">NPS score</p>
                    <p className="m-0 text-h1 font-bold text-[var(--text-primary)]">{detail.nps}</p>
                    <p className="m-0 text-caption text-[var(--text-muted)]">{detail.npsBand}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-caption text-[var(--text-muted)]">
                  {starRating(techRating.rating, 12)} {job.technician} · {techRating.rating} ({techRating.jobs} jobs)
                </div>
              </DetailCard>
            </div>
          </div>
        )}

        {/* ══════════════ HISTORY ══════════════ */}
        {activeTab === "history" && (
          <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start">
            <DetailCard icon={ClockCounterClockwise} title="Activity">
              {detail.activity.length === 0 ? (
                <EmptyState icon={ClockCounterClockwise} text="No history yet" />
              ) : (
                <ol className="m-0 p-0 list-none">
                  {[...detail.activity].reverse().map((entry, i, arr) => (
                    <li key={i} className="flex gap-3 sm:gap-4">
                      <span className="w-24 sm:w-28 flex-shrink-0 text-right pt-1.5 text-caption text-[var(--text-muted)]">{entry.at}</span>
                      <span className="flex flex-col items-center flex-shrink-0">
                        <span className="w-8 h-8 rounded-full border-2 border-[var(--border)] bg-blue-50 flex items-center justify-center">
                          <CheckCircle size={14} className="text-blue-600" weight="duotone" />
                        </span>
                        {i < arr.length - 1 && <span className="w-px flex-1 my-1 min-h-[20px] bg-[var(--border)]" />}
                      </span>
                      <p className="m-0 pb-5 pt-1 flex-1 min-w-0 text-body text-[var(--text-primary)] break-words">{entry.label}</p>
                    </li>
                  ))}
                </ol>
              )}
            </DetailCard>

            <DetailCard icon={Note} title="Internal notes">
              <div className="flex flex-col gap-3">
                <div className="border border-[var(--border)] rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors">
                  <InputBase fullWidth multiline minRows={2} placeholder="Add internal note…"
                    value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }}
                    sx={{ px: 2, py: 1.5, fontSize: "14px", color: "var(--text-primary)", "& textarea::placeholder": { color: "var(--text-muted)", opacity: 1 } }} />
                  {noteDraft.trim() && (
                    <div className="flex justify-end px-3 pb-2">
                      <Button size="small" variant="contained" onClick={submitNote}>Add note</Button>
                    </div>
                  )}
                </div>
                {ws.notes.map(n => (
                  <div key={n.id} className="group flex items-start gap-2 rounded-xl px-4 py-3 border border-[var(--border-soft)] bg-[var(--serviceops-tint)]">
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-body text-[var(--text-primary)] break-words">{n.text}</p>
                      <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">{n.author} · {n.at}</p>
                    </div>
                    <Tooltip title="Delete note">
                      <IconButton size="small" onClick={() => { removeJobNote(job.id, n.id); refresh(); }}
                        sx={{ p: 0.3, opacity: 0, transition: "opacity 0.15s", ".group:hover &": { opacity: 1 } }}>
                        <Trash size={13} color="#EF4444" weight="duotone" />
                      </IconButton>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </DetailCard>
          </div>
        )}
      </main>

      {/* ══ Edit drawer ══ */}
      <EditJobDrawer open={editOpen} job={job} initial={toEditInput(job)}
        onClose={() => setEditOpen(false)} onSave={handleEditSave} />

      {/* ══ Action dialogs ══ */}
      <JobActionDialogs
        kind={dialog} job={job} onClose={() => setDialog(null)}
        onAssign={handleAssign} onStatus={handleStatus} onInvoice={handleInvoice}
        onFollowUp={handleFollowUp} onCloseJob={handleCloseJob} onAddPart={handleAddPart}
      />

      {/* ══ Photo preview ══ */}
      <Dialog open={Boolean(photoPreview)} onClose={() => setPhotoPreview(null)} maxWidth="md">
        {photoPreview && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview.src} alt={photoPreview.name} style={{ maxWidth: "100%", maxHeight: "76vh", display: "block" }} />
            <div className="flex items-center justify-between px-4 py-2.5 text-[var(--text-body)]">
              <span className="text-caption truncate">{photoPreview.name}</span>
              <Button size="small" onClick={() => setPhotoPreview(null)}>Close</Button>
            </div>
          </>
        )}
      </Dialog>

      {/* ══ Toast ══ */}
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}
          action={toast?.href ? (
            <Button size="small" onClick={() => { const href = toast.href!; setToast(null); router.push(href); }}
              sx={{ color: "#fff", textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
              Open <ArrowSquareOut size={12} weight="bold" style={{ marginLeft: 4 }} />
            </Button>
          ) : undefined}
          sx={{ fontWeight: 600, borderRadius: "10px", alignItems: "center" }}>
          {toast?.msg}
        </Alert>
      </Snackbar>

      {/* ══ Print sheet (screen-hidden) ══ */}
      <JobPrintSheet payload={printPayload} />
    </div>
  );
}
