"use client";
import { useOpenOnNew } from "@/lib/useOpenOnNew";
import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Checkbox from "@mui/material/Checkbox";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import {
  CaretRight, CaretLeft, Plus, MagnifyingGlass, CalendarBlank, CaretDown, SlidersHorizontal,
  DotsThreeVertical, Eye, Export as ExportIcon, Briefcase, Clock, Pulse, XCircle, HourglassHigh,
  CheckCircle, Fan, GearSix, Drop, Lightning, Wrench, Elevator, ArrowDown, ArrowUp,
  UserSwitch, PencilSimple,
} from "@phosphor-icons/react";
import FiltersDrawer, { type FilterRow } from "@/components/shared/FiltersDrawer";
import NewJobDrawer from "@/components/jobs/NewJobDrawer";
import { useTheme } from "@/components/ThemeContext";
import { CARD_SHADOW, IconTile, type Tone } from "@/components/dashboard/DashboardSection";
import {
  ALL_JOBS, STATUS_ORDER, SERVICE_TYPE_ORDER, STATUS_META, STATUS_GROUP, TECHNICIANS, TECHNICIAN_AVATARS,
  JOBS_TODAY, createJob, type StatusGroup, type ServiceType, type JobRecord, type NewJobInput,
} from "@/lib/jobsData";

// ---------------------------------------------
//  Config
// ---------------------------------------------
const SERVICE_ICON: Record<ServiceType, typeof Fan> = {
  HVAC: Fan,
  Mechanical: GearSix,
  Plumbing: Drop,
  Electrical: Lightning,
  Preventive: Wrench,
  Elevator: Elevator,
};

const KPI_TILES: { group: StatusGroup | "total"; label: string; tone: Tone; Icon: typeof Fan; weight: "fill" | "bold" }[] = [
  { group: "total",      label: "Total jobs",   tone: "purple", Icon: Briefcase,     weight: "fill" },
  { group: "yetToStart", label: "Yet to start", tone: "blue",   Icon: Clock,         weight: "bold" },
  { group: "inProgress", label: "In progress",  tone: "amber",  Icon: Pulse,         weight: "bold" },
  { group: "cancelled",  label: "Cancelled",    tone: "red",    Icon: XCircle,       weight: "fill" },
  { group: "incomplete", label: "Incomplete",   tone: "amber",  Icon: HourglassHigh, weight: "fill" },
  { group: "completed",  label: "Completed",    tone: "green",  Icon: CheckCircle,   weight: "fill" },
];

const PAGE_SIZE = 8;
const DAY_MS = 24 * 3600 * 1000;

// Offsets in days from the dataset's "today" — [from, to).
const DATE_PRESETS: { label: string; range: [number, number] | null }[] = [
  { label: "Select date range", range: null },
  { label: "Today",             range: [0, 1] },
  { label: "Tomorrow",          range: [1, 2] },
  { label: "This week",         range: [0, 7] },
  { label: "Next 30 days",      range: [0, 30] },
];

const ALL_SERVICE_TYPES = "All service types";
const ALL_STATUS = "All status";
const ALL_TECHNICIANS = "All technicians";

const JOB_FILTER_COLUMNS = [
  { value: "jobId",       label: "Job · Job #"        },
  { value: "jobName",     label: "Job · Job name"     },
  { value: "customer",    label: "Job · Customer"     },
  { value: "location",    label: "Job · Location"     },
  { value: "serviceType", label: "Job · Service type" },
  { value: "technician",  label: "Job · Technician"   },
  { value: "priority",    label: "Job · Priority"     },
  { value: "status",      label: "Job · Status"       },
  { value: "region",      label: "Job · Region"       },
];

/** 1 2 3 4 5 … 8 — first/last page always visible, a window around the current one. */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

// ---------------------------------------------
//  Small reusable pieces
// ---------------------------------------------
const MENU_PAPER_SX = { borderRadius: "12px", border: "1px solid var(--border)", minWidth: 200, maxHeight: 340, mt: 0.75 };
const MENU_ITEM_SX = { mx: 0.5, borderRadius: "8px", fontSize: "14px" };

function FilterSelect({ value, options, onChange, icon, className = "" }: {
  value: string; options: string[]; onChange: (v: string) => void; icon?: ReactNode; className?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const active = value !== options[0];
  return (
    <>
      <button type="button" onClick={e => setAnchor(e.currentTarget)}
        className={`flex items-center gap-2.5 h-11 rounded-xl border px-3.5 bg-[var(--bg-card)] text-body transition-colors hover:border-[var(--serviceops-primary)] ${
          active ? "border-[var(--serviceops-primary)] text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-primary)]"
        } ${className}`}>
        {icon}
        <span className={`flex-1 text-left truncate ${icon && !active ? "text-[var(--text-muted)]" : ""}`}>{value}</span>
        <CaretDown size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
      </button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: MENU_PAPER_SX } }}>
        {options.map(opt => (
          <MenuItem key={opt} selected={opt === value} onClick={() => { onChange(opt); setAnchor(null); }} sx={MENU_ITEM_SX}>
            {opt}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function StatusPill({ status, isDark }: { status: JobRecord["status"]; isDark: boolean }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-badge-text font-medium whitespace-nowrap"
      style={{ backgroundColor: isDark ? m.bgDark : m.bgLight, color: isDark ? m.dark : m.light }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isDark ? m.dark : m.light }} />
      {status}
    </span>
  );
}

// ---------------------------------------------
//  Page
// ---------------------------------------------
export default function JobsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [search, setSearch]         = useState("");
  const [serviceF, setServiceF]     = useState(ALL_SERVICE_TYPES);
  const [statusF, setStatusF]       = useState(ALL_STATUS);
  const [techF, setTechF]           = useState(ALL_TECHNICIANS);
  const [datePreset, setDatePreset] = useState(DATE_PRESETS[0].label);
  const [sortAsc, setSortAsc]       = useState(true);
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [filtersAnchor, setFiltersAnchor] = useState<HTMLElement | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterRow[]>([]);
  const [rowMenu, setRowMenu]       = useState<{ anchor: HTMLElement; id: number } | null>(null);
  const [bulkAnchor, setBulkAnchor] = useState<HTMLElement | null>(null);
  const [newJobOpen, setNewJobOpen] = useState(false);
  useOpenOnNew(() => setNewJobOpen(true));
  const [createdJob, setCreatedJob] = useState<JobRecord | null>(null);
  const [allJobs, setAllJobs]       = useState<JobRecord[]>(ALL_JOBS);

  const customers = useMemo(() => Array.from(new Set(allJobs.map(j => j.customer))).sort(), [allJobs]);

  const applyFilter = (next: () => void) => { next(); setPage(1); };

  // Create Job — persist through the shared dataset (so the details screen can
  // resolve it too), then clear the view down so the new row is actually visible.
  const handleCreateJob = (input: NewJobInput) => {
    const job = createJob(input);
    setAllJobs([...ALL_JOBS]);
    setSearch("");
    setServiceF(ALL_SERVICE_TYPES); setStatusF(ALL_STATUS); setTechF(ALL_TECHNICIANS);
    setDatePreset(DATE_PRESETS[0].label);
    setActiveFilters([]);
    setPage(1);
    setCreatedJob(job);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const range = DATE_PRESETS.find(p => p.label === datePreset)?.range;
    const from = range ? JOBS_TODAY.getTime() + range[0] * DAY_MS : -Infinity;
    const to   = range ? JOBS_TODAY.getTime() + range[1] * DAY_MS : Infinity;

    return allJobs.filter(j => {
      const matchSearch = !q || [j.jobId, j.jobName, j.customer, j.location, j.technician].some(v => v.toLowerCase().includes(q));
      const matchService = serviceF === ALL_SERVICE_TYPES || j.serviceType === serviceF;
      const matchStatus = statusF === ALL_STATUS || j.status === statusF;
      const matchTech = techF === ALL_TECHNICIANS || j.technician === techF;
      const matchDate = j.scheduledAt >= from && j.scheduledAt < to;
      const matchAdv = activeFilters.every(f => {
        const raw = (j as unknown as Record<string, string>)[f.column] ?? "";
        const val = String(raw).toLowerCase();
        const fv = f.value.toLowerCase();
        switch (f.operator) {
          case "contains":         return val.includes(fv);
          case "does_not_contain": return !val.includes(fv);
          case "equals":           return val === fv;
          case "does_not_equal":   return val !== fv;
          case "starts_with":      return val.startsWith(fv);
          case "ends_with":        return val.endsWith(fv);
          case "is_empty":         return val === "";
          case "is_not_empty":     return val !== "";
          default:                 return true;
        }
      });
      return matchSearch && matchService && matchStatus && matchTech && matchDate && matchAdv;
    }).sort((a, b) => (sortAsc ? a.scheduledAt - b.scheduledAt : b.scheduledAt - a.scheduledAt));
  }, [search, serviceF, statusF, techF, datePreset, sortAsc, activeFilters, allJobs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageIds = pageRows.map(r => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const somePageSelected = pageIds.some(id => selected.has(id));

  const toggleRow = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllOnPage = () => setSelected(prev => {
    const next = new Set(prev);
    if (allPageSelected) pageIds.forEach(id => next.delete(id));
    else pageIds.forEach(id => next.add(id));
    return next;
  });

  // KPIs — computed from the full dataset (not the filtered/paginated view)
  const kpis = useMemo(() => {
    const counts: Record<StatusGroup | "total", number> = { total: allJobs.length, yetToStart: 0, inProgress: 0, cancelled: 0, incomplete: 0, completed: 0 };
    allJobs.forEach(j => { counts[STATUS_GROUP[j.status]] += 1; });
    return counts;
  }, [allJobs]);

  const checkboxSx = { p: 0.5, color: "var(--text-faint)", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "var(--serviceops-primary)" } };
  const headCell = "px-3 py-3.5 text-left text-table-header text-[var(--text-primary)] whitespace-nowrap";
  const bodyCell = "px-3 py-3 border-b border-[var(--border-soft)]";
  const SortIcon = sortAsc ? ArrowDown : ArrowUp;

  return (
    <div className="sidebar-content flex-1 flex flex-col min-h-screen overflow-auto">
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 animate-fade-in">

        {/* -- Breadcrumb + Header -- */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-body text-[var(--text-body)]">
              <Link href="/" className="hover:text-[var(--text-primary)] hover:underline underline-offset-2 transition-colors">Home</Link>
              <CaretRight size={12} className="text-[var(--text-muted)]" />
              <span className="text-[var(--text-primary)]">Jobs</span>
            </nav>
            <h1 className="m-0 mt-3 text-display sm:text-[36px] sm:leading-[44px] font-bold tracking-tight text-[var(--text-primary)]">Jobs</h1>
            <p className="m-0 mt-1 text-body sm:text-[18px] sm:leading-[26px] text-[var(--text-body)]">View and manage all jobs across your operations.</p>
          </div>

          <button type="button" onClick={() => setNewJobOpen(true)}
            className="self-start sm:self-auto sm:mb-3 inline-flex items-center gap-2.5 h-12 rounded-xl px-6 bg-[var(--serviceops-primary)] hover:bg-[var(--serviceops-hover)] text-[#111111] text-button font-semibold transition-colors shadow-[0_4px_14px_rgba(245,158,11,0.3)]">
            <Plus size={18} weight="bold" />
            New job
          </button>
        </div>

        {/* -- KPI stat cards -- */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {KPI_TILES.map(({ group, label, tone, Icon, weight }) => (
            <div key={group} className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 sm:px-4 py-4 min-w-0"
              style={{ boxShadow: CARD_SHADOW }}>
              <IconTile tone={tone} size={48}><Icon size={24} weight={weight} /></IconTile>
              <div className="min-w-0">
                <p className="m-0 text-label font-normal text-[var(--text-body)] truncate">{label}</p>
                <p className="m-0 text-display font-bold text-[var(--text-primary)]">{kpis[group]}</p>
              </div>
            </div>
          ))}
        </div>

        {/* -- Job list card -- */}
        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 sm:p-4" style={{ boxShadow: CARD_SHADOW }}>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--serviceops-tint)] px-3.5 w-full sm:w-auto sm:flex-1 lg:flex-none lg:w-[250px] focus-within:border-[var(--serviceops-primary)] transition-colors">
              <MagnifyingGlass size={18} className="flex-shrink-0 text-[var(--text-body)]" />
              <InputBase placeholder="Search jobs..." value={search}
                onChange={e => applyFilter(() => setSearch(e.target.value))}
                inputProps={{ "aria-label": "Search jobs" }}
                sx={{ flex: 1, fontSize: "14px", color: "var(--text-primary)", "& input::placeholder": { color: "var(--text-muted)", opacity: 1 } }} />
            </div>

            <FilterSelect value={serviceF} options={[ALL_SERVICE_TYPES, ...SERVICE_TYPE_ORDER]} onChange={v => applyFilter(() => setServiceF(v))}
              className="flex-1 sm:flex-none min-w-[150px] sm:w-[168px]" />
            <FilterSelect value={statusF} options={[ALL_STATUS, ...STATUS_ORDER]} onChange={v => applyFilter(() => setStatusF(v))}
              className="flex-1 sm:flex-none min-w-[150px] sm:w-[160px]" />
            <FilterSelect value={techF} options={[ALL_TECHNICIANS, ...TECHNICIANS]} onChange={v => applyFilter(() => setTechF(v))}
              className="flex-1 sm:flex-none min-w-[150px] sm:w-[180px]" />
            <FilterSelect value={datePreset} options={DATE_PRESETS.map(p => p.label)} onChange={v => applyFilter(() => setDatePreset(v))}
              icon={<CalendarBlank size={18} className="flex-shrink-0 text-[var(--text-body)]" />}
              className="flex-1 min-w-[200px] lg:max-w-[320px]" />

            <IconButton aria-label="Advanced filters" onClick={e => setFiltersAnchor(e.currentTarget)}
              sx={{
                ml: { lg: "auto" }, width: 44, height: 44, borderRadius: "12px", flexShrink: 0,
                border: `1px solid ${activeFilters.length ? "var(--serviceops-primary)" : "var(--border)"}`,
                bgcolor: activeFilters.length ? "var(--serviceops-primary-10)" : "var(--bg-card)",
                color: "var(--text-primary)",
                "&:hover": { borderColor: "var(--serviceops-primary)", bgcolor: "var(--serviceops-primary-10)" },
              }}>
              <SlidersHorizontal size={20} />
            </IconButton>
          </div>

          {/* Bulk selection bar — only while rows are selected */}
          {selected.size > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--serviceops-primary-10)] px-4 py-2">
              <span className="text-label text-[var(--text-primary)]">{selected.size} selected</span>
              <div className="flex items-center gap-2">
                <Button size="small" onClick={() => setSelected(new Set())} sx={{ color: "var(--text-body)" }}>Clear</Button>
                <Button size="small" variant="contained" onClick={e => setBulkAnchor(e.currentTarget)} endIcon={<CaretDown size={12} weight="bold" />}>
                  Bulk actions
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="w-10 pl-3 py-2 bg-[var(--serviceops-tint)] rounded-l-xl">
                    <Checkbox size="small" checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected}
                      onChange={toggleAllOnPage} inputProps={{ "aria-label": "Select all on page" }} sx={checkboxSx} />
                  </th>
                  <th className={`${headCell} bg-[var(--serviceops-tint)]`}>Job #</th>
                  <th className={`${headCell} bg-[var(--serviceops-tint)]`}>Job name</th>
                  <th className={`${headCell} bg-[var(--serviceops-tint)]`}>Customer</th>
                  <th className={`${headCell} bg-[var(--serviceops-tint)]`}>Service type</th>
                  <th className={`${headCell} bg-[var(--serviceops-tint)]`} aria-sort={sortAsc ? "ascending" : "descending"}>
                    <button type="button" onClick={() => setSortAsc(s => !s)} className="inline-flex items-center gap-1.5 hover:text-[var(--text-primary)] hover:underline underline-offset-2 transition-colors">
                      Scheduled date <SortIcon size={14} weight="bold" />
                    </button>
                  </th>
                  <th className={`${headCell} bg-[var(--serviceops-tint)]`}>Status</th>
                  <th className={`${headCell} bg-[var(--serviceops-tint)]`}>Technician</th>
                  <th className={`${headCell} bg-[var(--serviceops-tint)] rounded-r-xl text-right pr-4`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(job => {
                  const ServiceIcon = SERVICE_ICON[job.serviceType];
                  const isSelected = selected.has(job.id);
                  return (
                    <tr key={job.id} onClick={() => router.push(`/jobs/${job.id}`)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-[var(--serviceops-primary-10)]" : "hover:bg-[var(--serviceops-tint)]"}`}>
                      <td className={`${bodyCell} w-10 pl-3`} onClick={e => e.stopPropagation()}>
                        <Checkbox size="small" checked={isSelected} onChange={() => toggleRow(job.id)}
                          inputProps={{ "aria-label": `Select ${job.jobId}` }} sx={checkboxSx} />
                      </td>
                      <td className={bodyCell}>
                        <Link href={`/jobs/${job.id}`} onClick={e => e.stopPropagation()}
                          className="text-table-cell font-semibold text-blue-600 hover:underline whitespace-nowrap">
                          {job.jobId}
                        </Link>
                      </td>
                      <td className={`${bodyCell} text-table-cell text-[var(--text-primary)] whitespace-nowrap`}>{job.jobName}</td>
                      <td className={bodyCell}>
                        <p className="m-0 text-table-cell text-[var(--text-primary)] whitespace-nowrap">{job.customer}</p>
                        <p className="m-0 text-table-cell text-[var(--text-muted)] whitespace-nowrap">{job.location}</p>
                      </td>
                      <td className={bodyCell}>
                        <span className="inline-flex items-center gap-3 text-table-cell text-[var(--text-body)] whitespace-nowrap">
                          <ServiceIcon size={20} weight="fill" className="text-[var(--text-primary)]" />
                          {job.serviceType}
                        </span>
                      </td>
                      <td className={bodyCell}>
                        <p className="m-0 text-table-cell text-[var(--text-primary)] whitespace-nowrap">{job.scheduledDate}</p>
                        <p className="m-0 text-table-cell text-[var(--text-body)] whitespace-nowrap">{job.scheduledTime}</p>
                      </td>
                      <td className={bodyCell}><StatusPill status={job.status} isDark={isDark} /></td>
                      <td className={bodyCell}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={TECHNICIAN_AVATARS[job.technician]} alt={job.technician} sx={{ width: 36, height: 36, flexShrink: 0 }} />
                          <span className="text-table-cell text-[var(--text-primary)] whitespace-nowrap">{job.technician}</span>
                        </div>
                      </td>
                      <td className={`${bodyCell} text-right pr-2`} onClick={e => e.stopPropagation()}>
                        <IconButton size="small" aria-label={`Actions for ${job.jobId}`} onClick={e => setRowMenu({ anchor: e.currentTarget, id: job.id })}
                          sx={{ borderRadius: "8px", color: "var(--text-primary)", "&:hover": { bgcolor: "var(--serviceops-tint)" } }}>
                          <DotsThreeVertical size={20} weight="bold" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-[var(--serviceops-primary-10)]">
                        <Wrench size={22} color="var(--serviceops-primary)" weight="duotone" />
                      </div>
                      <p className="m-0 text-label text-[var(--text-primary)]">No jobs found</p>
                      <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 sm:px-2 pt-6 pb-2">
            <p className="m-0 text-body text-[var(--text-body)]">
              {filtered.length === 0 ? "No jobs" : `Showing ${(safePage - 1) * PAGE_SIZE + 1} to ${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} jobs`}
            </p>
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" aria-label="Previous page" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--serviceops-primary)] disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors">
                <CaretLeft size={14} weight="bold" />
              </button>
              {pageList(safePage, totalPages).map((p, i) => p === "…" ? (
                <span key={`gap-${i}`} className="w-6 text-center text-body text-[var(--text-muted)]">…</span>
              ) : (
                <button key={p} type="button" onClick={() => setPage(p)} aria-current={p === safePage ? "page" : undefined}
                  className={`min-w-9 w-9 h-9 rounded-lg border text-button-sm transition-colors ${
                    p === safePage
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--serviceops-primary)]"
                  }`}>
                  {p}
                </button>
              ))}
              <button type="button" aria-label="Next page" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--serviceops-primary)] disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors">
                <CaretRight size={14} weight="bold" />
              </button>
            </nav>
          </div>
        </section>
      </main>

      {/* -- Row actions menu -- */}
      <Menu anchorEl={rowMenu?.anchor ?? null} open={Boolean(rowMenu)} onClose={() => setRowMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { ...MENU_PAPER_SX, minWidth: 190 } } }}>
        <MenuItem onClick={() => { const id = rowMenu?.id; setRowMenu(null); if (id) router.push(`/jobs/${id}`); }} sx={{ ...MENU_ITEM_SX, py: 0.9 }}>
          <ListItemIcon sx={{ minWidth: 30 }}><Eye size={15} weight="duotone" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "14px" }}>View details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setRowMenu(null)} sx={{ ...MENU_ITEM_SX, py: 0.9 }}>
          <ListItemIcon sx={{ minWidth: 30 }}><UserSwitch size={15} weight="duotone" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "14px" }}>Reassign technician</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setRowMenu(null)} sx={{ ...MENU_ITEM_SX, py: 0.9 }}>
          <ListItemIcon sx={{ minWidth: 30 }}><PencilSimple size={15} weight="duotone" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "14px" }}>Change status</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => setRowMenu(null)} sx={{ ...MENU_ITEM_SX, py: 0.9, color: "#EF4444" }}>
          <ListItemIcon sx={{ minWidth: 30 }}><XCircle size={15} color="#EF4444" weight="duotone" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "14px", color: "#EF4444" }}>Cancel job</ListItemText>
        </MenuItem>
      </Menu>

      {/* -- Bulk actions menu -- */}
      <Menu anchorEl={bulkAnchor} open={Boolean(bulkAnchor) && selected.size > 0} onClose={() => setBulkAnchor(null)}
        slotProps={{ paper: { sx: MENU_PAPER_SX } }}>
        <MenuItem onClick={() => setBulkAnchor(null)} sx={{ ...MENU_ITEM_SX, py: 0.9 }}>
          <ListItemIcon sx={{ minWidth: 30 }}><UserSwitch size={15} weight="duotone" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "14px" }}>Assign technician</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setBulkAnchor(null)} sx={{ ...MENU_ITEM_SX, py: 0.9 }}>
          <ListItemIcon sx={{ minWidth: 30 }}><PencilSimple size={15} weight="duotone" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "14px" }}>Update status</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setBulkAnchor(null)} sx={{ ...MENU_ITEM_SX, py: 0.9 }}>
          <ListItemIcon sx={{ minWidth: 30 }}><ExportIcon size={15} weight="duotone" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "14px" }}>Export selected</ListItemText>
        </MenuItem>
      </Menu>

      <FiltersDrawer
        anchor={filtersAnchor} onClose={() => setFiltersAnchor(null)}
        filters={activeFilters} onChange={v => { setActiveFilters(v); setPage(1); }}
        columns={JOB_FILTER_COLUMNS}
        subtitle="Narrow down jobs by conditions"
      />

      {/* -- Create Job -- */}
      <NewJobDrawer
        open={newJobOpen}
        onClose={() => setNewJobOpen(false)}
        customers={customers}
        onSubmit={handleCreateJob}
      />

      <Snackbar
        open={Boolean(createdJob)}
        autoHideDuration={5000}
        onClose={() => setCreatedJob(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setCreatedJob(null)}
          action={
            <Button size="small" onClick={() => { const job = createdJob; setCreatedJob(null); if (job) router.push(`/jobs/${job.id}`); }}
              sx={{ color: "#fff", textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
              View
            </Button>
          }
          sx={{ fontWeight: 600, borderRadius: "10px", alignItems: "center" }}
        >
          Job {createdJob?.jobId} created for {createdJob?.customer}
        </Alert>
      </Snackbar>
    </div>
  );
}
