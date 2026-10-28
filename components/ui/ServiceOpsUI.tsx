"use client";
/**
 * ServiceOps building blocks for every screen beyond Dashboard / Jobs / Job Details.
 * Each piece is lifted from the patterns those reference screens established —
 * the Jobs list (page header, KPI tiles, filter bar, table, pagination) and
 * Job Details (breadcrumb, tabs, DetailCard, Field/IconField, pills) — so new
 * screens read as the same product rather than a parallel design.
 */
import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Checkbox from "@mui/material/Checkbox";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import {
  CaretRight, CaretLeft, CaretDown, MagnifyingGlass, PencilSimple, DotsThreeVertical, X, Flag,
  ArrowDown, ArrowUp, House, ArrowSquareOut, Fan, GearSix, Drop, Lightning, Wrench, Elevator,
} from "@phosphor-icons/react";
import { useTheme } from "@/components/ThemeContext";
import { CARD_SHADOW, IconTile, type Tone } from "@/components/dashboard/DashboardSection";
import { PRIORITY_META, TECHNICIAN_AVATARS, type JobPriority, type ServiceType } from "@/lib/jobsData";

export { CARD_SHADOW };
type PhIcon = typeof MagnifyingGlass;

// ─────────────────────────────────────────────
//  Status pill — same palette as the job status pills
// ─────────────────────────────────────────────
export type PillTone = "gray" | "blue" | "green" | "amber" | "red" | "purple";
const TONE_META: Record<PillTone, { light: string; dark: string; bgLight: string; bgDark: string }> = {
  gray:   { light: "#6B7280", dark: "#A1A1AA", bgLight: "rgba(107,114,128,0.12)", bgDark: "rgba(161,161,170,0.16)" },
  blue:   { light: "#2563EB", dark: "#60A5FA", bgLight: "rgba(37,99,235,0.10)",   bgDark: "rgba(96,165,250,0.16)" },
  green:  { light: "#16A34A", dark: "#4ADE80", bgLight: "rgba(22,163,74,0.10)",   bgDark: "rgba(74,222,128,0.16)" },
  amber:  { light: "#D97706", dark: "#FBBF24", bgLight: "rgba(245,158,11,0.12)",  bgDark: "rgba(251,191,36,0.16)" },
  red:    { light: "#EF4444", dark: "#F87171", bgLight: "rgba(239,68,68,0.10)",   bgDark: "rgba(248,113,113,0.16)" },
  purple: { light: "#7C3AED", dark: "#A78BFA", bgLight: "rgba(124,58,237,0.10)",  bgDark: "rgba(167,139,250,0.16)" },
};
export const toneColor = (tone: PillTone, isDark: boolean) => (isDark ? TONE_META[tone].dark : TONE_META[tone].light);

export function Pill({ tone, children, dot = true }: { tone: PillTone; children: ReactNode; dot?: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const m = TONE_META[tone];
  const color = isDark ? m.dark : m.light;
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-badge-text font-medium whitespace-nowrap"
      style={{ backgroundColor: isDark ? m.bgDark : m.bgLight, color }}>
      {dot && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
      {children}
    </span>
  );
}

/** Priority, compact — flag + coloured label (Job Details uses the same colours). */
export function PriorityTag({ priority }: { priority: JobPriority }) {
  const { theme } = useTheme();
  const m = PRIORITY_META[priority];
  const color = theme === "dark" ? m.textDark : m.text;
  return (
    <span className="inline-flex items-center gap-1.5 text-table-cell whitespace-nowrap" style={{ color }}>
      <Flag size={14} weight="fill" />
      {priority}
    </span>
  );
}

export const SERVICE_ICON: Record<ServiceType, PhIcon> = {
  HVAC: Fan, Mechanical: GearSix, Plumbing: Drop, Electrical: Lightning, Preventive: Wrench, Elevator: Elevator,
};

/** Service type with its icon — the Jobs list column treatment. */
export function ServiceTypeCell({ type }: { type: ServiceType }) {
  const Icon = SERVICE_ICON[type];
  return (
    <span className="inline-flex items-center gap-2.5 text-table-cell text-[var(--text-body)] whitespace-nowrap">
      <Icon size={18} weight="fill" className="text-[var(--text-primary)] flex-shrink-0" />
      {type}
    </span>
  );
}

export function PersonCell({ name, src, sub, size = 32 }: { name: string; src?: string; sub?: ReactNode; size?: number }) {
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("");
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar src={src ?? TECHNICIAN_AVATARS[name]} alt={name}
        sx={{ width: size, height: size, flexShrink: 0, fontSize: size * 0.36, fontWeight: 700, bgcolor: "var(--serviceops-primary-10)", color: "var(--text-primary)" }}>
        {initials}
      </Avatar>
      <div className="min-w-0">
        <p className="m-0 text-table-cell text-[var(--text-primary)] truncate">{name}</p>
        {sub && <p className="m-0 text-table-cell-secondary text-[var(--text-muted)] truncate">{sub}</p>}
      </div>
    </div>
  );
}

/** Blue record link (Job #, WO #, Invoice # …) — matches the Jobs table. */
export function IdLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} onClick={e => e.stopPropagation()} className="text-table-cell font-semibold text-blue-600 hover:underline whitespace-nowrap">
      {children}
    </Link>
  );
}

/** Quiet inline link to another record (customer name, asset …). */
export function RecordLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} onClick={e => e.stopPropagation()} className={`hover:text-blue-600 hover:underline ${className}`}>
      {children}
    </Link>
  );
}

// ─────────────────────────────────────────────
//  Page chrome
// ─────────────────────────────────────────────
export interface Crumb { label: string; href?: string }

export function Breadcrumb({ items, homeIcon = false }: { items: Crumb[]; homeIcon?: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center ${homeIcon ? "gap-3" : "gap-2"} text-body text-[var(--text-body)] min-w-0`}>
      {homeIcon
        ? <Link href="/" aria-label="Home" className="hover:text-[var(--serviceops-primary)] transition-colors flex-shrink-0"><House size={20} /></Link>
        : <Link href="/" className="hover:text-[var(--serviceops-primary)] transition-colors">Home</Link>}
      {items.map((c, i) => (
        <span key={i} className={`flex items-center ${homeIcon ? "gap-3" : "gap-2"} min-w-0`}>
          <CaretRight size={12} className="text-[var(--text-muted)] flex-shrink-0" />
          {c.href
            ? <Link href={c.href} className="hover:text-[var(--serviceops-primary)] transition-colors whitespace-nowrap">{c.label}</Link>
            : <span className="text-[var(--text-primary)] truncate">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** Listing page header — breadcrumb, title, one-line purpose, primary action. */
export function PageHeader({ title, subtitle, crumbs, actions }: { title: string; subtitle: string; crumbs?: Crumb[]; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        <Breadcrumb items={crumbs ?? [{ label: title }]} />
        <h1 className="m-0 mt-3 text-display sm:text-[36px] sm:leading-[44px] font-bold tracking-tight text-[var(--text-primary)]">{title}</h1>
        <p className="m-0 mt-1 text-body sm:text-[18px] sm:leading-[26px] text-[var(--text-body)]">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-auto sm:mb-3 flex-shrink-0">{actions}</div>}
    </div>
  );
}

/** Page wrapper — the same main padding every reference screen uses. */
export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="sidebar-content flex-1 flex flex-col min-h-screen">
      <main className={`flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 animate-fade-in min-w-0 ${wide ? "" : ""}`}>{children}</main>
    </div>
  );
}

/** Amber page-level CTA ("New job" button on the Jobs list). */
export function PrimaryButton({ children, icon: Icon, onClick, href, size = "lg" }: { children: ReactNode; icon?: PhIcon; onClick?: () => void; href?: string; size?: "lg" | "md" }) {
  const cls = `inline-flex items-center gap-2.5 ${size === "lg" ? "h-12 px-6" : "h-10 px-4"} rounded-xl bg-[var(--serviceops-primary)] hover:bg-[var(--serviceops-hover)] text-[#111111] text-button font-semibold transition-colors shadow-[0_4px_14px_rgba(245,158,11,0.3)] whitespace-nowrap`;
  const body = <>{Icon && <Icon size={18} weight="bold" />}{children}</>;
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** Outlined secondary action ("Clone" on Job Details). */
export function SecondaryButton({ children, icon: Icon, onClick, href, className = "" }: { children: ReactNode; icon?: PhIcon; onClick?: () => void; href?: string; className?: string }) {
  const cls = `inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] text-button-sm font-semibold hover:border-blue-500 transition-colors whitespace-nowrap ${className}`;
  const body = <>{Icon && <Icon size={16} weight="bold" />}{children}</>;
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** Solid blue detail-page action ("Edit job" on Job Details). */
export function DetailPrimaryButton({ children, icon: Icon, onClick, href }: { children: ReactNode; icon?: PhIcon; onClick?: () => void; href?: string }) {
  const cls = "inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-button-sm font-semibold transition-colors whitespace-nowrap";
  const body = <>{Icon && <Icon size={16} weight="bold" />}{children}</>;
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

// ─────────────────────────────────────────────
//  KPI tiles (Jobs list) — optionally act as quick filters
// ─────────────────────────────────────────────
export function KpiTile({ label, value, tone, icon: Icon, weight = "fill", active, onClick, meta }: {
  label: string; value: ReactNode; tone: Tone; icon: PhIcon; weight?: "fill" | "bold" | "duotone"; active?: boolean; onClick?: () => void; meta?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} aria-pressed={onClick ? !!active : undefined}
      className={`flex items-center gap-3 sm:gap-4 rounded-2xl border bg-[var(--bg-card)] px-3 sm:px-4 py-4 min-w-0 text-left transition-colors ${
        active ? "border-[var(--serviceops-primary)] ring-1 ring-[var(--serviceops-primary)]" : "border-[var(--border-soft)]"
      } ${onClick ? "hover:border-[var(--serviceops-primary)] cursor-pointer" : ""}`}
      style={{ boxShadow: CARD_SHADOW }}>
      <IconTile tone={tone} size={48}><Icon size={24} weight={weight} /></IconTile>
      <div className="min-w-0">
        <p className="m-0 text-label font-normal text-[var(--text-body)] truncate">{label}</p>
        <p className="m-0 text-display font-bold text-[var(--text-primary)]">{value}</p>
        {meta && <p className="m-0 text-caption text-[var(--text-muted)] truncate">{meta}</p>}
      </div>
    </Tag>
  );
}

/** KPI tiles: a grid on tablet/desktop, one swipeable strip on phones so the list stays near the top. */
export function KpiRow({ children, cols = "xl:grid-cols-6" }: { children: ReactNode; cols?: string }) {
  return (
    <div className={`flex sm:grid sm:grid-cols-3 md:grid-cols-3 ${cols} gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0 snap-x [&>*]:min-w-[168px] [&>*]:sm:min-w-0 [&>*]:snap-start`}>
      {children}
    </div>
  );
}

/** Search + filters. Phones get the search box and a "Filters" toggle instead of a wall of dropdowns. */
export function FilterBar({ search, children, trailing, activeCount = 0 }: { search: ReactNode; children?: ReactNode; trailing?: ReactNode; activeCount?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 sm:flex-wrap">
        <div className="flex-1 min-w-0 sm:flex-none sm:contents">{search}</div>
        {children && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className={`sm:hidden inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl border text-button-sm flex-shrink-0 ${activeCount ? "border-[var(--serviceops-primary)] bg-[var(--serviceops-primary-10)]" : "border-[var(--border)] bg-[var(--bg-card)]"} text-[var(--text-primary)]`}>
            Filters{activeCount ? ` · ${activeCount}` : ""}
            <CaretDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        <div className="hidden sm:contents">{children}{trailing}</div>
      </div>
      {open && <div className="sm:hidden grid grid-cols-2 gap-2 [&>*]:!w-full [&>*]:!min-w-0">{children}{trailing}</div>}
    </div>
  );
}

/** The white list card that holds filters + table + pagination. */
export function ListCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 sm:p-4 min-w-0 ${className}`} style={{ boxShadow: CARD_SHADOW }}>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────
//  Filters
// ─────────────────────────────────────────────
export const MENU_PAPER_SX = { borderRadius: "12px", border: "1px solid var(--border)", minWidth: 200, maxHeight: 340, mt: 0.75 };
export const MENU_ITEM_SX = { mx: 0.5, borderRadius: "8px", fontSize: "14px" };

export function SearchBox({ value, onChange, placeholder, className = "" }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--serviceops-tint)] px-3.5 focus-within:border-[var(--serviceops-primary)] transition-colors ${className}`}>
      <MagnifyingGlass size={18} className="flex-shrink-0 text-[var(--text-body)]" />
      <InputBase placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        inputProps={{ "aria-label": placeholder }}
        sx={{ flex: 1, fontSize: "14px", color: "var(--text-primary)", "& input::placeholder": { color: "var(--text-muted)", opacity: 1 } }} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <X size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}

/** Dropdown filter; the first option is the "All …" reset value. */
export function FilterSelect({ value, options, onChange, icon, className = "" }: {
  value: string; options: string[]; onChange: (v: string) => void; icon?: ReactNode; className?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const active = value !== options[0];
  return (
    <>
      <button type="button" onClick={e => setAnchor(e.currentTarget)}
        className={`flex items-center gap-2.5 h-11 rounded-xl border px-3.5 bg-[var(--bg-card)] text-body transition-colors hover:border-[var(--serviceops-primary)] text-[var(--text-primary)] ${
          active ? "border-[var(--serviceops-primary)]" : "border-[var(--border)]"
        } ${className}`}>
        {icon}
        <span className={`flex-1 text-left truncate ${icon && !active ? "text-[var(--text-muted)]" : ""}`}>{value}</span>
        <CaretDown size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
      </button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: MENU_PAPER_SX } }}>
        {options.map(opt => (
          <MenuItem key={opt} selected={opt === value} onClick={() => { onChange(opt); setAnchor(null); }} sx={MENU_ITEM_SX}>{opt}</MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** Segmented quick filter (e.g. Dispatch view switch, list scopes). */
export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div role="tablist" className="inline-flex items-center rounded-xl p-1 gap-1 bg-[var(--serviceops-tint)] border border-[var(--border-soft)] max-w-full overflow-x-auto">
      {options.map(o => (
        <button key={o.value} role="tab" type="button" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg ${size === "sm" ? "px-2.5 h-8 text-button-sm" : "px-3 h-9 text-button-sm"} whitespace-nowrap transition-colors ${
            value === o.value ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold shadow-sm" : "text-[var(--text-body)] hover:text-[var(--text-primary)]"
          }`}>
          {o.label}
          {o.count !== undefined && <span className="text-caption text-[var(--text-muted)]">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Table — Jobs list visual language, with a
//  mobile list rendering for small screens
// ─────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  width?: string;
  /** Provide to make the header clickable for sorting. */
  sortValue?: (row: T) => number | string;
  /** Hide the column on narrower desktops (it's secondary information). */
  hideBelow?: "xl" | "2xl" | "wide";
}

const HIDE_BELOW = { xl: "hidden xl:table-cell", "2xl": "hidden 2xl:table-cell", wide: "hidden min-[1680px]:table-cell" } as const;

const headCell = "px-3 py-3.5 text-table-header text-[var(--text-primary)] whitespace-nowrap bg-[var(--serviceops-tint)]";
const bodyCell = "px-3 py-3 border-b border-[var(--border-soft)] align-middle";

export function DataTable<T>({
  columns, rows: allRows, rowKey, onRowClick, empty, minWidth = 960, mobileCard, selected, onSelectedChange, defaultSort, rowClassName,
  pageSize, noun = "records",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  empty: { icon: PhIcon; title: string; hint?: string };
  minWidth?: number;
  /** Renders each row as a card below the md breakpoint instead of the table. */
  mobileCard?: (row: T) => ReactNode;
  selected?: Set<string | number>;
  onSelectedChange?: (next: Set<string | number>) => void;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  rowClassName?: (row: T) => string;
  /** Paginate (after sorting) and render the Jobs-style pagination footer. */
  pageSize?: number;
  noun?: string;
}) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(1);
  // A new result set (filters changed) starts again from page one.
  useEffect(() => { setPage(1); }, [allRows]);
  const sortedAll = useMemo(() => {
    if (!sort) return allRows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return allRows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...allRows].sort((a, b) => {
      const x = col.sortValue!(a), y = col.sortValue!(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [allRows, sort, columns]);
  const totalPages = pageSize ? Math.max(1, Math.ceil(sortedAll.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const sorted = pageSize ? sortedAll.slice((safePage - 1) * pageSize, safePage * pageSize) : sortedAll;

  const selectable = !!selected && !!onSelectedChange;
  const keys = sorted.map(rowKey);
  const allSel = selectable && keys.length > 0 && keys.every(k => selected!.has(k));
  const someSel = selectable && keys.some(k => selected!.has(k));
  const toggle = (k: string | number) => {
    const next = new Set(selected); if (next.has(k)) next.delete(k); else next.add(k); onSelectedChange!(next);
  };
  const toggleAll = () => {
    const next = new Set(selected); if (allSel) keys.forEach(k => next.delete(k)); else keys.forEach(k => next.add(k)); onSelectedChange!(next);
  };
  const checkboxSx = { p: 0.5, color: "var(--text-faint)", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "var(--serviceops-primary)" } };
  const EmptyIcon = empty.icon;
  const emptyBlock = (
    <div className="py-16 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-[var(--serviceops-primary-10)]">
        <EmptyIcon size={22} color="var(--serviceops-primary)" weight="duotone" />
      </div>
      <p className="m-0 text-label text-[var(--text-primary)]">{empty.title}</p>
      {empty.hint && <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">{empty.hint}</p>}
    </div>
  );

  return (
    <>
      {mobileCard && (
        <div className="md:hidden mt-3 flex flex-col gap-2">
          {sorted.length === 0 ? emptyBlock : sorted.map(r => (
            <div key={rowKey(r)} role={onRowClick ? "button" : undefined} tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(r)} onKeyDown={e => { if (e.key === "Enter") onRowClick?.(r); }}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3.5 active:bg-[var(--serviceops-tint)] transition-colors">
              {mobileCard(r)}
            </div>
          ))}
        </div>
      )}
      <div className={`${mobileCard ? "hidden md:block" : ""} mt-4 overflow-x-auto`}>
        <table className="w-full border-separate border-spacing-0" style={{ minWidth }}>
          <thead>
            <tr>
              {selectable && (
                <th className="w-10 pl-3 py-2 bg-[var(--serviceops-tint)] rounded-l-xl">
                  <Checkbox size="small" checked={allSel} indeterminate={someSel && !allSel} onChange={toggleAll}
                    inputProps={{ "aria-label": "Select all" }} sx={checkboxSx} />
                </th>
              )}
              {columns.map((c, i) => {
                const first = i === 0 && !selectable, last = i === columns.length - 1;
                const active = sort?.key === c.key;
                const SortIcon = active && sort?.dir === "desc" ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} style={{ width: c.width }}
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={`${headCell} ${c.align === "right" ? "text-right pr-4" : "text-left"} ${first ? "rounded-l-xl" : ""} ${last ? "rounded-r-xl" : ""} ${c.hideBelow ? HIDE_BELOW[c.hideBelow] : ""}`}>
                    {c.sortValue ? (
                      <button type="button" onClick={() => setSort(s => ({ key: c.key, dir: s?.key === c.key && s.dir === "asc" ? "desc" : "asc" }))}
                        className={`inline-flex items-center gap-1.5 hover:text-[var(--serviceops-primary)] transition-colors ${active ? "" : "text-[var(--text-primary)]"}`}>
                        {c.header} <SortIcon size={13} weight="bold" className={active ? "" : "opacity-30"} />
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const k = rowKey(r);
              const isSel = selectable && selected!.has(k);
              return (
                <tr key={k} onClick={() => onRowClick?.(r)}
                  className={`${onRowClick ? "cursor-pointer" : ""} transition-colors ${isSel ? "bg-[var(--serviceops-primary-10)]" : "hover:bg-[var(--serviceops-tint)]"} ${rowClassName?.(r) ?? ""}`}>
                  {selectable && (
                    <td className={`${bodyCell} w-10 pl-3`} onClick={e => e.stopPropagation()}>
                      <Checkbox size="small" checked={isSel} onChange={() => toggle(k)} inputProps={{ "aria-label": `Select ${k}` }} sx={checkboxSx} />
                    </td>
                  )}
                  {columns.map(c => (
                    <td key={c.key} className={`${bodyCell} ${c.align === "right" ? "text-right pr-4" : ""} ${c.hideBelow ? HIDE_BELOW[c.hideBelow] : ""}`}>{c.cell(r)}</td>
                  ))}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)}>{emptyBlock}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pageSize && (
        <Pagination page={safePage} totalPages={totalPages} total={sortedAll.length} pageSize={pageSize} setPage={setPage} noun={noun} />
      )}
    </>
  );
}

/** Two-line cell: primary value + muted secondary line. */
export function Stack({ top, bottom, right = false }: { top: ReactNode; bottom?: ReactNode; right?: boolean }) {
  return (
    <div className={right ? "text-right" : ""}>
      <p className="m-0 text-table-cell text-[var(--text-primary)] whitespace-nowrap">{top}</p>
      {bottom !== undefined && <p className="m-0 text-table-cell-secondary text-[var(--text-muted)] whitespace-nowrap">{bottom}</p>}
    </div>
  );
}

function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

/** Client-side paging over a filtered list. */
export function usePaged<T>(rows: T[], pageSize = 8) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, totalPages);
  return {
    page: safe, setPage, totalPages, pageSize,
    rows: rows.slice((safe - 1) * pageSize, safe * pageSize),
    total: rows.length,
  };
}

export function Pagination({ page, totalPages, total, pageSize, setPage, noun }: {
  page: number; totalPages: number; total: number; pageSize: number; setPage: (p: number) => void; noun: string;
}) {
  const btn = "w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--serviceops-primary)] disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors";
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 sm:px-2 pt-6 pb-2">
      <p className="m-0 text-body text-[var(--text-body)]">
        {total === 0 ? `No ${noun}` : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total} ${noun}`}
      </p>
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))} className={btn}>
            <CaretLeft size={14} weight="bold" />
          </button>
          {pageList(page, totalPages).map((p, i) => p === "…" ? (
            <span key={`gap-${i}`} className="w-6 text-center text-body text-[var(--text-muted)]">…</span>
          ) : (
            <button key={p} type="button" onClick={() => setPage(p)} aria-current={p === page ? "page" : undefined}
              className={`min-w-9 w-9 h-9 rounded-lg border text-button-sm transition-colors ${
                p === page ? "border-blue-500 bg-blue-50 text-blue-600" : "border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--serviceops-primary)]"
              }`}>
              {p}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))} className={btn}>
            <CaretRight size={14} weight="bold" />
          </button>
        </nav>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Menus + toasts
// ─────────────────────────────────────────────
export interface MenuAction { label: string; icon: PhIcon; onClick: () => void; danger?: boolean; divider?: boolean; disabled?: boolean }

export function ActionMenu({ actions, label = "More actions", variant = "row" }: { actions: MenuAction[]; label?: string; variant?: "row" | "page" }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton aria-label={label} size="small" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        sx={variant === "page"
          ? { width: 40, height: 40, borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text-primary)", bgcolor: "var(--bg-card)", "&:hover": { bgcolor: "var(--serviceops-tint)" } }
          : { borderRadius: "8px", color: "var(--text-primary)", "&:hover": { bgcolor: "var(--serviceops-tint)" } }}>
        <DotsThreeVertical size={20} weight="bold" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} onClick={e => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { ...MENU_PAPER_SX, minWidth: 200 } } }}>
        {actions.flatMap(a => {
          const Icon = a.icon;
          const item = (
            <MenuItem key={a.label} disabled={a.disabled} onClick={() => { setAnchor(null); a.onClick(); }} sx={{ ...MENU_ITEM_SX, py: 0.9, ...(a.danger ? { color: "#EF4444" } : {}) }}>
              <ListItemIcon sx={{ minWidth: 30 }}><Icon size={15} weight="duotone" color={a.danger ? "#EF4444" : undefined} /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: "14px", ...(a.danger ? { color: "#EF4444" } : {}) }}>{a.label}</ListItemText>
            </MenuItem>
          );
          return a.divider ? [<Divider key={`d-${a.label}`} sx={{ my: 0.5 }} />, item] : [item];
        })}
      </Menu>
    </>
  );
}

export function useToast() {
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; href?: string; severity?: "success" | "info" } | null>(null);
  const node = (
    <Snackbar open={Boolean(toast)} autoHideDuration={4500} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
      <Alert severity={toast?.severity ?? "success"} variant="filled" onClose={() => setToast(null)}
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
  );
  return { toastNode: node, notify: (msg: string, href?: string, severity?: "success" | "info") => setToast({ msg, href, severity }) };
}

// ─────────────────────────────────────────────
//  Detail page language (Job Details)
// ─────────────────────────────────────────────
export function DetailTabs<T extends string>({ tabs, active, onChange, actions, label }: {
  tabs: { key: T; label: string; count?: number }[]; active: T; onChange: (k: T) => void; actions?: ReactNode; label: string;
}) {
  return (
    <div className="flex flex-col-reverse lg:flex-row lg:items-center gap-3 lg:gap-6 border-b border-[var(--border)]">
      <div role="tablist" aria-label={label} className="flex items-center gap-1 sm:gap-3 xl:gap-6 overflow-x-auto -mb-px">
        {tabs.map(t => (
          <button key={t.key} role="tab" type="button" aria-selected={active === t.key} onClick={() => onChange(t.key)}
            className={`px-3 py-3.5 whitespace-nowrap text-body border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              active === t.key ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-[var(--text-primary)] hover:text-blue-600"
            }`}>
            {t.label}
            {t.count !== undefined && (
              <span className={`text-caption rounded-full px-1.5 min-w-[20px] text-center ${active === t.key ? "bg-blue-50 text-blue-600" : "bg-[var(--serviceops-tint)] text-[var(--text-muted)]"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3 lg:ml-auto lg:pb-2 flex-shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}

export function DetailCard({ icon: Icon, title, action, children, className = "", flush = false }: {
  icon: PhIcon; title: string; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] ${flush ? "pt-4 sm:pt-5 px-0 pb-2" : "p-4 sm:p-5"} min-w-0 ${className}`} style={{ boxShadow: CARD_SHADOW }}>
      <header className={`flex items-center justify-between gap-3 mb-4 ${flush ? "px-4 sm:px-5" : ""}`}>
        <div className="flex items-center gap-3 min-w-0">
          <Icon size={24} className="flex-shrink-0 text-blue-600" />
          <h2 className="m-0 text-h2 font-bold text-[var(--text-primary)] truncate">{title}</h2>
        </div>
        {action}
      </header>
      <div className={flush ? "px-2 sm:px-3" : ""}>{children}</div>
    </section>
  );
}

export function EditButton({ onClick, label = "Edit", icon: Icon = PencilSimple }: { onClick: () => void; label?: string; icon?: PhIcon }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-button-sm font-semibold text-[var(--text-primary)] hover:border-blue-500 hover:text-blue-600 transition-colors flex-shrink-0">
      <Icon size={16} weight="bold" />
      {label}
    </button>
  );
}

/** Label/value pair in a two-column definition grid (parent sets the columns). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-body text-[var(--text-muted)]">{label}</dt>
      <dd className="m-0 text-body text-[var(--text-primary)] min-w-0 break-words">{children}</dd>
    </>
  );
}

export function IconField({ icon: Icon, label, children, labelClass = "text-body" }: { icon: PhIcon; label: string; children: ReactNode; labelClass?: string }) {
  return (
    <div className="grid grid-cols-[20px_minmax(96px,auto)_minmax(0,1fr)] items-center gap-x-3">
      <Icon size={18} className="text-blue-600" />
      <dt className={`${labelClass} text-[var(--text-muted)] whitespace-nowrap`}>{label}</dt>
      <dd className="m-0 text-body text-[var(--text-primary)] min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function EmptyState({ icon: Icon, text, action }: { icon: PhIcon; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-1.5 text-body text-[var(--text-faint)] text-center">
      <Icon size={26} weight="duotone" />
      {text}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Simple table inside a DetailCard (Job Details' `so-table` style). */
export function MiniTable({ head, children, minWidth = 520 }: { head: (string | { label: string; right?: boolean })[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="so-table w-full" style={{ minWidth }}>
        <thead>
          <tr>
            {head.map((h, i) => {
              const label = typeof h === "string" ? h : h.label;
              const right = typeof h !== "string" && h.right;
              return <th key={i} className={`${right ? "text-right" : "text-left"} px-4 whitespace-nowrap`}>{label}</th>;
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** "What happens next" strip — answers the fourth core question at a glance. */
export function NextStep({ tone, label, action }: { tone: PillTone; label: string; action?: ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const m = TONE_META[tone];
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl px-4 py-3 border"
      style={{ backgroundColor: isDark ? m.bgDark : m.bgLight, borderColor: "transparent" }}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="text-caption font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: isDark ? m.dark : m.light }}>Next step</span>
        <span className="text-body text-[var(--text-primary)] min-w-0">{label}</span>
      </div>
      {action}
    </div>
  );
}

/** Horizontal lifecycle stepper (Request → … → Billed). */
export function Stepper({ steps, current, cancelled = false }: { steps: string[]; current: number; cancelled?: boolean }) {
  return (
    <ol className="m-0 p-0 list-none flex items-start overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = !cancelled && i < current;
        const now = !cancelled && i === current;
        return (
          <li key={s} className="flex-1 min-w-[84px] flex flex-col items-center relative">
            {i > 0 && <span className={`absolute top-[11px] right-1/2 w-full h-[2px] ${done || now ? "bg-blue-600" : "bg-[var(--border)]"}`} />}
            <span className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${
              done ? "bg-blue-600 border-blue-600 text-white" : now ? "bg-[var(--bg-card)] border-blue-600 text-blue-600" : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-faint)]"
            }`}>{done ? "✓" : i + 1}</span>
            <span className={`mt-1.5 text-caption text-center px-1 ${now ? "text-[var(--text-primary)] font-semibold" : done ? "text-[var(--text-body)]" : "text-[var(--text-muted)]"}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Activity timeline (Job Details ▸ History). */
export function Timeline({ items }: { items: { label: string; at: string; tone?: PillTone }[] }) {
  return (
    <ol className="m-0 p-0 list-none">
      {items.map((e, i) => (
        <li key={i} className="flex gap-3 sm:gap-4">
          <span className="w-24 sm:w-28 flex-shrink-0 text-right pt-1.5 text-caption text-[var(--text-muted)]">{e.at}</span>
          <span className="flex flex-col items-center flex-shrink-0">
            <span className="w-3 h-3 mt-2 rounded-full border-2 border-blue-600 bg-[var(--bg-card)]" />
            {i < items.length - 1 && <span className="w-px flex-1 my-1 min-h-[20px] bg-[var(--border)]" />}
          </span>
          <p className="m-0 pb-5 pt-1 flex-1 min-w-0 text-body text-[var(--text-primary)] break-words">{e.label}</p>
        </li>
      ))}
    </ol>
  );
}

// ─────────────────────────────────────────────
//  Side drawer — the Create/Edit Job drawer shell
// ─────────────────────────────────────────────
export function SideDrawer({ open, onClose, title, subtitle, icon: Icon, children, footer, width = 560 }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; icon: PhIcon; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: width }, display: "flex", flexDirection: "column",
          bgcolor: isDark ? "#0F0F0F" : "#FFFFFF",
          borderLeft: `1px solid ${isDark ? "#27272A" : "var(--serviceops-soft)"}`,
          boxShadow: isDark ? "-12px 0 48px rgba(0,0,0,0.5)" : "-12px 0 48px rgba(17,17,17,0.10)",
        },
      }}>
      <div className={`flex items-center justify-between px-5 sm:px-6 py-4 border-b flex-shrink-0 ${isDark ? "bg-[#111113] border-[#27272A]" : "bg-[var(--serviceops-tint)] border-[var(--serviceops-soft)]"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-[#27272A]" : "bg-[var(--serviceops-primary)]"}`}>
            <Icon size={18} color={isDark ? "#A1A1AA" : "#3B1F00"} weight="duotone" />
          </div>
          <div className="min-w-0">
            <h2 className="m-0 text-[16px] font-bold tracking-tight text-[var(--text-primary)] truncate">{title}</h2>
            {subtitle && <p className="m-0 text-caption text-[var(--text-muted)] truncate">{subtitle}</p>}
          </div>
        </div>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close"
            sx={{ borderRadius: "9px", border: `1.5px solid ${isDark ? "#3F3F46" : "var(--serviceops-soft)"}`, "&:hover": { bgcolor: isDark ? "#27272A" : "var(--serviceops-surface)" } }}>
            <X size={17} color={isDark ? "#71717A" : "#64748B"} weight="duotone" />
          </IconButton>
        </Tooltip>
      </div>
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">{children}</div>
      {footer && (
        <div className={`flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t flex-shrink-0 ${isDark ? "bg-[#111113] border-[#27272A]" : "bg-[var(--serviceops-tint)] border-[var(--serviceops-soft)]"}`}>
          {footer}
        </div>
      )}
    </Drawer>
  );
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="m-0 mb-3.5 text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{title}</h3>
      {children}
    </div>
  );
}

/** Drawer footer buttons — same treatment as the Create Job drawer. */
export function DrawerActions({ onCancel, onSubmit, submitLabel, disabled }: { onCancel: () => void; onSubmit: () => void; submitLabel: string; disabled?: boolean }) {
  return (
    <>
      <Button variant="text" onClick={onCancel} sx={{ color: "var(--text-muted)", fontWeight: 600, borderRadius: "9px", px: 2.5 }}>Cancel</Button>
      <Button variant="contained" onClick={onSubmit} disabled={disabled}
        sx={{ bgcolor: "var(--serviceops-primary)", color: "#3B1F00", borderRadius: "9px", fontWeight: 700, px: 3, boxShadow: "0 1px 8px 0 rgba(245,158,11,0.35)", "&:hover": { bgcolor: "var(--serviceops-hover)" } }}>
        {submitLabel}
      </Button>
    </>
  );
}

/** Dense key/value row used inside drawers and side panels. */
export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border-soft)] last:border-b-0">
      <span className="text-body text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className="text-body text-[var(--text-primary)] text-right min-w-0 break-words">{children}</span>
    </div>
  );
}
