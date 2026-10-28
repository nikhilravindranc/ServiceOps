"use client";
import { useState, useEffect, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import { CaretDown, Check, SquaresFour, GearSix } from "@phosphor-icons/react";
import DashboardHero from "@/components/dashboard/DashboardHero";
import JobStatisticsCard from "@/components/dashboard/JobStatisticsCard";
import TeamAvailabilityCard from "@/components/dashboard/TeamAvailabilityCard";
import JobsByStatusCard from "@/components/dashboard/JobsByStatusCard";
import RecentActivityCard from "@/components/dashboard/RecentActivityCard";
import QuotationsCard from "@/components/dashboard/QuotationsCard";
import InvoicesCard from "@/components/dashboard/InvoicesCard";
import CustomerFeedbackCard from "@/components/dashboard/CustomerFeedbackCard";

/* ─────────── Dashboards available to switch between (mirrors Settings ▸ Dashboard Customization) ─────────── */
interface DashboardOption { id: string; name: string; isActive: boolean; }
const DASHBOARDS_STORAGE_KEY = "dashboards-list";
const ACTIVE_DASHBOARD_KEY = "active-dashboard-id";
const DEFAULT_DASHBOARDS: DashboardOption[] = [{ id: "hp1", name: "Dashboard V1", isActive: true }];

function loadDashboardOptions(): DashboardOption[] {
  if (typeof window === "undefined") return DEFAULT_DASHBOARDS;
  try {
    const raw = localStorage.getItem(DASHBOARDS_STORAGE_KEY);
    const parsed: DashboardOption[] = raw ? JSON.parse(raw) : DEFAULT_DASHBOARDS;
    return parsed.length ? parsed : DEFAULT_DASHBOARDS;
  } catch {
    return DEFAULT_DASHBOARDS;
  }
}

export default function DashboardPage() {
  const router = useRouter();

  const [dashboards, setDashboards] = useState<DashboardOption[]>(DEFAULT_DASHBOARDS);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_DASHBOARDS[0].id);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const options = loadDashboardOptions();
    const available = options.filter((d) => d.isActive);
    const list = available.length ? available : options;
    setDashboards(list);

    const savedId = localStorage.getItem(ACTIVE_DASHBOARD_KEY);
    const initial = list.find((d) => d.id === savedId) ?? list[0];
    if (initial) setSelectedId(initial.id);
  }, []);

  const selectedDashboard = dashboards.find((d) => d.id === selectedId) ?? dashboards[0];

  const handleSelectDashboard = (dashboardId: string) => {
    setSelectedId(dashboardId);
    localStorage.setItem(ACTIVE_DASHBOARD_KEY, dashboardId);
    setMenuAnchor(null);
  };

  const dashboardSwitcher = (
    <>
      <button
        type="button"
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-caption text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--serviceops-primary)] transition-colors"
        style={{ background: "color-mix(in srgb, var(--bg-card) 70%, transparent)" }}
      >
        <SquaresFour size={12} weight="duotone" />
        {selectedDashboard?.name ?? "Select Dashboard"}
        <CaretDown size={10} weight="bold" />
      </button>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "12px", minWidth: 220, py: 0.5, border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" } } }}>
        {dashboards.map((d) => (
          <MenuItem key={d.id} onClick={() => handleSelectDashboard(d.id)} selected={d.id === selectedId}
            sx={{ py: 1, px: 1.75, mx: 0.5, borderRadius: "8px" }}>
            <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: d.id === selectedId ? 700 : 500 }}>{d.name}</ListItemText>
            {d.id === selectedId && <Check size={15} weight="bold" />}
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { setMenuAnchor(null); router.push("/settings?tab=homepage"); }}
          sx={{ py: 1, px: 1.75, mx: 0.5, borderRadius: "8px" }}>
          <GearSix size={16} weight="duotone" className="mr-2.5" />
          <ListItemText primaryTypographyProps={{ fontSize: 13.5 }}>Manage Dashboards</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );

  return (
    <div
      className="sidebar-content flex-1 flex flex-col min-h-screen overflow-auto bg-[var(--dash-bg)]"
      style={{ "--dash-bg": "color-mix(in srgb, var(--serviceops-tint) 60%, var(--bg-page))" } as CSSProperties}
    >
      <div className="animate-fade-in">
        <DashboardHero userName="Alex" dateAside={dashboardSwitcher} />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          {/* `md:grid-cols-*` on every grid opts out of the global tablet auto-fit rule for .grid-cols-1 */}
          <div className="grid grid-cols-1 md:grid-cols-1 min-[1440px]:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4">
                <JobStatisticsCard />
                <TeamAvailabilityCard />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4">
                <JobsByStatusCard />
                <RecentActivityCard />
              </div>
            </div>

            {/* Right rail — stacks beside the grid on wide screens, flows into columns below it otherwise */}
            <div className="grid grid-cols-1 md:grid-cols-2 min-[1200px]:grid-cols-3 min-[1440px]:grid-cols-1 gap-4 min-w-0">
              <QuotationsCard />
              <InvoicesCard />
              <div className="md:col-span-2 min-[1200px]:col-span-1 grid">
                <CustomerFeedbackCard />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
