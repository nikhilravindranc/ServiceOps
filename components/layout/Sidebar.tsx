"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import {
  SquaresFourIcon, ClipboardTextIcon, TruckIcon, WrenchIcon, BuildingsIcon, CubeIcon, PackageIcon,
  ReceiptIcon, ChartBarIcon, TrayIcon, BooksIcon, CalendarCheckIcon, LightbulbIcon, ClockIcon, CaretDownIcon, UsersThreeIcon, GearSixIcon, PlugsConnectedIcon, XIcon,
} from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { useLayout } from "@/components/LayoutContext";
import { useTheme } from "@/components/ThemeContext";
import { WORK_ORDERS, woStatus } from "@/lib/serviceData";

const MOBILE_BP = 1024;

type NavItem = { label: string; Icon: typeof SquaresFourIcon; href: string; badge?: number };
type NavGroup = { label: string | null; items: NavItem[] };

/* Grouped by how the work flows: a request becomes a work order, gets
   dispatched and executed as a job; customers, assets and parts are the
   records that work touches; billing and reports close the loop. */
function buildNav(): { main: NavGroup[]; admin: NavGroup } {
  const toSchedule = WORK_ORDERS.filter(w => woStatus(w) === "Ready to schedule").length;
  const fresh = WORK_ORDERS.filter(w => woStatus(w) === "New").length;
  return {
    main: [
      { label: null, items: [{ label: "Home", Icon: SquaresFourIcon, href: "/" }] },
      {
        label: "Work",
        items: [
          { label: "Requests",    Icon: TrayIcon,          href: "/requests" },
          { label: "Work Orders", Icon: ClipboardTextIcon, href: "/work-orders", badge: fresh || undefined },
          { label: "Dispatch",    Icon: TruckIcon,         href: "/dispatch",    badge: toSchedule || undefined },
          { label: "Jobs",        Icon: WrenchIcon,        href: "/jobs" },
        ],
      },
      {
        label: "Records",
        items: [
          { label: "Customers", Icon: BuildingsIcon, href: "/customers" },
          { label: "Assets",    Icon: CubeIcon,      href: "/assets" },
          { label: "Inventory", Icon: PackageIcon,   href: "/inventory" },
          { label: "Catalog",   Icon: BooksIcon,     href: "/catalog" },
          { label: "Plans",     Icon: CalendarCheckIcon, href: "/plans" },
        ],
      },
      {
        label: "Business",
        items: [
          { label: "Billing", Icon: ReceiptIcon,  href: "/billing" },
          { label: "Insights", Icon: LightbulbIcon, href: "/insights" },
          { label: "Timesheets", Icon: ClockIcon, href: "/timesheets" },
          { label: "Reports", Icon: ChartBarIcon, href: "/reports" },
        ],
      },
    ],
    admin: {
      label: "Admin",
      items: [
        { label: "Users",        Icon: UsersThreeIcon,     href: "/users" },
        { label: "Settings",     Icon: GearSixIcon,        href: "/settings" },
        { label: "Integrations", Icon: PlugsConnectedIcon, href: "/integrations" },
      ],
    },
  };
}

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export default function Sidebar() {
  const pathname    = usePathname();
  const { data: session } = useSession();
  const { layout } = useLayout();
  const compact = layout === "compact";
  // Compact layout: menu groups can be folded; the choice is remembered on this device.
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setClosedGroups(JSON.parse(localStorage.getItem("nav-closed-groups") ?? "{}")); } catch { /* ignore */ } }, []);
  const toggleGroup = (label: string) => setClosedGroups(c => {
    const next = { ...c, [label]: !c[label] };
    try { localStorage.setItem("nav-closed-groups", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const initials = (session?.user?.name ?? "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isMobile,    setIsMobile]    = useState(false);
  const [collapsed,   setCollapsed]   = useState(false); // desktop
  const [drawerOpen,  setDrawerOpen]  = useState(false); // mobile
  const drawerRef = useRef(false);
  // Badge counts read the in-memory dataset — rebuild on navigation so they follow changes.
  const [nav, setNav] = useState(buildNav);
  useEffect(() => { setNav(buildNav()); }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    setCollapsed(stored === "true");

    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);

    const onMqChange = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setDrawerOpen(false); // close when resizing to mobile
    };
    onMqChange();
    mq.addEventListener("change", onMqChange);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.action === "drawer") {
        // Mobile toggle
        const next = !drawerRef.current;
        drawerRef.current = next;
        setDrawerOpen(next);
      } else if (typeof detail.collapsed === "boolean") {
        // Desktop collapse
        setCollapsed(detail.collapsed);
      }
    };
    window.addEventListener("sidebar-toggle", handler);

    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("sidebar-toggle", handler);
    };
  }, []);

  const closeDrawer = () => {
    drawerRef.current = false;
    setDrawerOpen(false);
  };

  // Menu item colours. Hover keeps the text dark (or cream in dark mode) on a soft neutral wash, so it stays readable;
  // the current page gets the amber wash and a darker amber icon.
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--serviceops-primary)]";
  const itemTone = (active: boolean) => focusRing + " " + (isDark
    ? (active
        ? "bg-[rgba(251,191,36,0.16)] text-[var(--serviceops-primary)] font-semibold"
        : "text-[var(--serviceops-secondary)] hover:bg-[rgba(255,243,214,0.09)] hover:text-[var(--serviceops-depth)]")
    : (active
        ? "bg-[rgba(245,158,11,0.14)] text-[var(--serviceops-depth)] font-semibold hover:bg-[rgba(245,158,11,0.20)]"
        : "text-[#2B2B2B] hover:bg-[rgba(17,17,17,0.06)] hover:text-[#000000]"));
  const iconTone = (active: boolean) => isDark
    ? (active ? "text-[var(--serviceops-primary)]" : "text-[var(--serviceops-muted)] group-hover:text-[var(--serviceops-primary)]")
    : (active ? "text-[#C2410C]" : "text-[#4B4B4B] group-hover:text-[#C2410C]");
  const badgeCls = `text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
    isDark ? "bg-[var(--serviceops-tint)] text-[var(--serviceops-primary)]" : "bg-[rgba(245,158,11,0.16)] text-[#B45309]"
  }`;

  const groupLabel = (label: string, mobile = false) => (
    <p className={`m-0 ${mobile ? "px-3 pt-4" : "px-3 pt-4"} pb-1.5 text-nav-group-label uppercase text-[var(--serviceops-muted)]`}>{label}</p>
  );

  /* ═══════════════════════════════════════════
     MOBILE — overlay drawer
  ═══════════════════════════════════════════ */
  if (isMobile) {
    const renderMobileItem = ({ label, Icon, href, badge }: NavItem) => {
      const active = isActive(pathname, href);
      return (
        <Link key={href} href={href} onClick={closeDrawer} aria-current={active ? "page" : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[16px] font-medium transition-all duration-150 group ${itemTone(active)}`}>
          <Icon size={19} weight="duotone" className={`flex-shrink-0 transition-colors ${iconTone(active)}`} />
          <span className="flex-1 truncate">{label}</span>
          {badge && !active && <span className={badgeCls}>{badge}</span>}
          {active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--serviceops-primary)]" />}
        </Link>
      );
    };

    return (
      <>
        {/* Backdrop */}
        <div
          onClick={closeDrawer}
          style={{
            position: "fixed", inset: 0, zIndex: 90,
            backgroundColor: "rgba(17, 17, 17, 0.35)",
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? "auto" : "none",
            transition: "opacity 0.25s ease",
          }}
        />

        {/* Drawer */}
        <aside
          aria-label="Main navigation"
          style={{
            position: "fixed", top: 0, left: 0,
            width: "min(280px, 85vw)", height: "100vh",
            zIndex: 100,
            backgroundColor: isDark ? "var(--serviceops-surface)" : "var(--bg-sidebar)",
            boxShadow: isDark ? "4px 0 24px rgba(0,0,0,0.45)" : "4px 0 24px rgba(17, 17, 17, 0.08)",
            display: "flex", flexDirection: "column",
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
            overflowY: "auto",
          }}
        >
          {/* Header: close + brand */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--serviceops-soft)]">
            <button
              onClick={closeDrawer}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 flex-shrink-0 ${
                isDark ? "text-[var(--serviceops-secondary)] hover:text-[var(--serviceops-depth)] hover:bg-[rgba(255,243,214,0.09)]" : "text-[var(--serviceops-depth)] hover:text-[#000000] hover:bg-[rgba(17,17,17,0.06)]"
              }`}
              aria-label="Close menu"
            >
              <XIcon size={18} weight="bold" />
            </button>
            <img
              src="/logo.png"
              alt="ServiceOps"
              style={{ height: "28px", width: "auto" }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-2 overflow-y-auto">
            {[...nav.main, nav.admin].map((g, gi) => (
              <div key={gi} className="space-y-0.5">
                {g.label && groupLabel(g.label, true)}
                {g.items.map(renderMobileItem)}
              </div>
            ))}
          </nav>

          {/* Bottom: profile */}
          <div className="px-3 pb-4 border-t pt-3 border-[var(--serviceops-soft)]">
            <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${isDark ? "bg-[var(--serviceops-tint)] border-[var(--serviceops-soft)]" : "bg-[var(--bg-card)] border-[var(--serviceops-soft)]"}`}>
              <div className="relative flex-shrink-0">
                <Avatar
                  sx={{ width: 30, height: 30, bgcolor: "var(--serviceops-primary)", fontSize: "0.6rem", fontWeight: 800 }}
                >{initials}</Avatar>
                <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border-2 ${isDark ? "border-[var(--serviceops-surface)]" : "border-white"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[12px] font-semibold truncate text-[var(--serviceops-depth)]">{session?.user?.name ?? "Account"}</p>
                <p className="m-0 text-[11px] truncate text-[var(--serviceops-muted)]">{[session?.user?.role, session?.user?.email].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  }

  /* ═══════════════════════════════════════════
     DESKTOP — persistent collapsible sidebar
  ═══════════════════════════════════════════ */
  const renderItem = ({ label, Icon, href, badge }: NavItem) => {
    const active = isActive(pathname, href);
    const itemContent = (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`
          flex items-center rounded-lg text-[16px] font-medium
          transition-all duration-150 group relative
          ${collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2.5 w-full"}
          ${itemTone(active)}
        `}
      >
        <Icon size={18} weight="duotone" className={`flex-shrink-0 transition-colors ${iconTone(active)}`} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {badge && !active && <span className={badgeCls}>{badge}</span>}
            {active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--serviceops-primary)]" />}
          </>
        )}
        {collapsed && badge && !active && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full border-2 bg-[var(--serviceops-primary)] border-[var(--serviceops-surface)]" />
        )}
      </Link>
    );
    return collapsed ? (
      <Tooltip key={href} title={badge ? `${label} · ${badge}` : label} placement="right" arrow>
        <span className="flex justify-center">{itemContent}</span>
      </Tooltip>
    ) : (
      <span key={href} className="block">{itemContent}</span>
    );
  };

  const renderGroup = (g: NavGroup, gi: number) => {
    if (compact && g.label && !collapsed) {
      const closed = !!closedGroups[g.label];
      // A folded group still shows the page you are on, so you never lose your place.
      const visible = closed ? g.items.filter(i => isActive(pathname, i.href)) : g.items;
      return (
        <div key={gi} className="space-y-0.5">
          <button type="button" onClick={() => toggleGroup(g.label!)} aria-expanded={!closed}
            className="w-full flex items-center justify-between px-3 pt-3 pb-1 text-nav-group-label uppercase text-[var(--serviceops-muted)] hover:text-[var(--serviceops-depth)]">
            <span>{g.label}</span>
            <CaretDownIcon size={11} weight="bold" className={"transition-transform " + (closed ? "-rotate-90" : "")} />
          </button>
          {visible.map(renderItem)}
        </div>
      );
    }
    return (
      <div key={gi} className="space-y-0.5">
        {g.label && (collapsed
          ? (gi > 0 ? <div className="mx-3 my-2 border-t border-[var(--serviceops-soft)]" /> : null)
          : groupLabel(g.label))}
        {g.items.map(renderItem)}
      </div>
    );
  };

  return (
    <aside
      aria-label="Main navigation"
      className="fixed left-0 flex flex-col z-50 select-none border-r overflow-hidden border-[var(--serviceops-soft)]"
      style={{
        top: compact ? "0px" : "72px",
        height: compact ? "100vh" : "calc(100vh - 72px)",
        backgroundColor: "var(--bg-sidebar)",
        width: collapsed ? "68px" : compact ? "224px" : "260px",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      {/* Navigation (Admin is the last group, so nothing is hidden behind a pinned block on short windows) */}
      {compact && (
        <div className="flex items-center h-[56px] flex-shrink-0 px-4 border-b border-[var(--serviceops-soft)]">
          <img src="/logo.png" alt="ServiceOps" style={collapsed ? { height: 28, width: 32, objectFit: "cover", objectPosition: "left" } : { height: 28, width: "auto" }} />
        </div>
      )}
      <nav className="flex-1 min-h-0 px-2 py-3 overflow-y-auto overflow-x-hidden">
        {[...nav.main, nav.admin].map(renderGroup)}
      </nav>

      {/* Bottom: profile */}
      <div className="px-2 pb-3 border-t pt-2 flex-shrink-0 border-[var(--serviceops-soft)]">
        {collapsed ? (
          <Tooltip title={`${session?.user?.name ?? "Account"} — ${session?.user?.role ?? ""}`} placement="right" arrow>
            <span className="flex justify-center py-1 mt-1">
              <div className="relative">
                <Avatar
                  sx={{ width: 34, height: 34, bgcolor: "var(--serviceops-primary)", fontSize: "0.6rem", fontWeight: 800, cursor: "pointer" }}
                >{initials}</Avatar>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 ${isDark ? "border-[var(--serviceops-surface)]" : "border-white"}`} />
              </div>
            </span>
          </Tooltip>
        ) : (
          <div className={`flex items-center gap-2.5 mt-2 px-3 py-2 rounded-lg border ${isDark ? "bg-[var(--serviceops-tint)] border-[var(--serviceops-soft)]" : "bg-[var(--bg-card)] border-[var(--serviceops-soft)]"}`}>
            <div className="relative flex-shrink-0">
              <Avatar
                sx={{ width: 30, height: 30, bgcolor: "var(--serviceops-primary)", fontSize: "0.6rem", fontWeight: 800 }}
              >{initials}</Avatar>
              <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border-2 ${isDark ? "border-[var(--serviceops-surface)]" : "border-white"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[12px] font-semibold truncate text-[var(--serviceops-depth)]">{session?.user?.name ?? "Account"}</p>
              <p className="m-0 text-[10px] truncate text-[var(--serviceops-muted)]">{[session?.user?.role, session?.user?.email].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
