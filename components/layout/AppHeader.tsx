"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { ListIcon, Bell, UserCircleIcon, SignOutIcon, Sun, Moon } from "@phosphor-icons/react";
import { HeaderSearch, MobileSearch } from "./GlobalSearch";
import { useTheme } from "@/components/ThemeContext";
import { signOut, useSession } from "next-auth/react";
import CreateMenu from "./CreateMenu";
import { useLayout } from "@/components/LayoutContext";

const EXPANDED_W = "260px";
const COMPACT_EXPANDED_W = "224px";
const COLLAPSED_W = "68px";
const MOBILE_BP = 1024;

const PATH_TITLES: Record<string, string> = {
  "/":         "Dashboard",
  "/requests":     "Requests",
  "/work-orders":  "Work Orders",
  "/dispatch":     "Dispatch",
  "/jobs":         "Jobs",
  "/customers":    "Customers",
  "/assets":       "Assets",
  "/inventory":    "Inventory",
  "/catalog":      "Catalog",
  "/plans":        "Service plans",
  "/insights":     "Insights",
  "/timesheets":   "Timesheets",
  "/billing":      "Billing",
  "/reports":      "Reports",
  "/users":        "Users",
  "/settings":     "Settings",
  "/integrations": "Integrations",
};

function UserMenu({
  anchor, onClose, router, isDark,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
  isDark: boolean;
}) {
  const { data: session } = useSession();
  return (
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={onClose}
      onClick={onClose}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            mt: 1.5, minWidth: 220,
            borderRadius: "16px",
            border: `1px solid ${isDark ? "var(--serviceops-soft)" : "var(--serviceops-soft)"}`,
            bgcolor: isDark ? "var(--serviceops-surface)" : "#ffffff",
            boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.35)" : "0 12px 40px rgba(17,17,17,0.12)",
            overflow: "hidden",
          },
        },
      }}
    >
      {/* User info */}
      <div className="px-5 pt-4 pb-3">
        <p className={`text-[15px] font-bold leading-tight ${isDark ? "text-[var(--serviceops-depth)]" : "text-[var(--serviceops-depth)]"}`}>{session?.user?.name ?? "Account"}</p>
        <p className={`text-[12px] mt-0.5 ${isDark ? "text-[var(--serviceops-muted)]" : "text-[var(--serviceops-muted)]"}`}>{session?.user?.role ?? ""}</p>
      </div>

      <Divider sx={{ borderColor: isDark ? "var(--serviceops-soft)" : "var(--serviceops-soft)", mx: 0 }} />

      <div className="py-1.5 px-1.5">
        <MenuItem
          onClick={() => router.push("/settings")}
          sx={{
            gap: 2, px: "14px", py: "10px", fontSize: "0.875rem", fontWeight: 500,
            color: isDark ? "var(--serviceops-depth)" : "var(--serviceops-depth)", borderRadius: "10px",
            "&:hover": { bgcolor: isDark ? "rgba(255,243,214,0.09)" : "rgba(17,17,17,0.06)", color: "var(--serviceops-depth)", "& svg": { color: isDark ? "var(--serviceops-primary)" : "#C2410C" } },
          }}
        >
          <UserCircleIcon size={18} weight="duotone" />
          My Account
        </MenuItem>

        <MenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          sx={{
            gap: 2, px: "14px", py: "10px", fontSize: "0.875rem", fontWeight: 500,
            color: isDark ? "#EF4444" : "#EF4444", borderRadius: "10px",
            "&:hover": { bgcolor: isDark ? "var(--serviceops-tint)" : "var(--serviceops-tint)", color: isDark ? "#DC2626" : "#DC2626" },
          }}
        >
          <SignOutIcon size={18} weight="duotone" />
          Log out
        </MenuItem>
      </div>
    </Menu>
  );
}

function ThemeToggleButton({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <Tooltip title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}>
      <IconButton
        onClick={onToggle}
        size="small"
        aria-label="Toggle dark mode"
        sx={{
          borderRadius: "9px",
          border: `1.5px solid ${isDark ? "var(--serviceops-soft)" : "var(--serviceops-soft)"}`,
          bgcolor: isDark ? "var(--serviceops-surface)" : "var(--serviceops-surface)",
          "&:hover": { bgcolor: isDark ? "var(--serviceops-tint)" : "var(--serviceops-tint)" },
          transition: "all 0.2s ease",
        }}
      >
        {isDark
          ? <Sun size={17} color="var(--serviceops-primary)" weight="duotone" />
          : <Moon size={17} color="var(--serviceops-muted)" weight="duotone" />
        }
      </IconButton>
    </Tooltip>
  );
}

export default function AppHeader() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { data: session } = useSession();
  const initials = (session?.user?.name ?? "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const { layout } = useLayout();
  const compact = layout === "compact";
  const expandedW = compact ? COMPACT_EXPANDED_W : EXPANDED_W;
  const [collapsed, setCollapsed]         = useState(false);
  const [isMobile, setIsMobile]           = useState(false);
  const [avatarAnchor, setAvatarAnchor]   = useState<HTMLElement | null>(null);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    // Desktop: restore persisted collapsed state
    const stored    = localStorage.getItem("sidebar-collapsed");
    const isCollapsed = stored === "true";
    setCollapsed(isCollapsed);

    const applyDesktopWidth = (c: boolean) =>
      document.documentElement.style.setProperty("--sidebar-w", c ? COLLAPSED_W : expandedW);

    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);

    const onMqChange = () => {
      setIsMobile(mq.matches);
      if (mq.matches) {
        // Mobile: sidebar doesn't push content
        document.documentElement.style.setProperty("--sidebar-w", "0px");
      } else {
        // Desktop: restore sidebar push width
        const c = localStorage.getItem("sidebar-collapsed") === "true";
        applyDesktopWidth(c);
      }
    };

    onMqChange();
    mq.addEventListener("change", onMqChange);
    return () => mq.removeEventListener("change", onMqChange);
  }, [expandedW]);

  const toggle = () => {
    if (isMobile) {
      // Mobile: signal the drawer to open/close
      window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { action: "drawer" } }));
    } else {
      // Desktop: collapse / expand persistent sidebar
      const next = !collapsed;
      setCollapsed(next);
      localStorage.setItem("sidebar-collapsed", String(next));
      document.documentElement.style.setProperty("--sidebar-w", next ? COLLAPSED_W : expandedW);
      window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed: next } }));
    }
  };

  const title = PATH_TITLES[pathname] ?? PATH_TITLES["/" + pathname.split("/")[1]] ?? (pathname === "/" ? "Overview" : "");

  /* ─── Mobile header ─── */
  if (isMobile) {
    return (
      <header
        style={{
          position: "fixed", top: 0, left: 0, right: 0,
          height: "64px", zIndex: 60,
          backgroundColor: isDark ? "var(--serviceops-surface)" : "#ffffff",
          borderBottom: `1px solid ${isDark ? "var(--serviceops-soft)" : "var(--serviceops-soft)"}`,
          display: "flex", alignItems: "center",
          padding: "0 16px", gap: "12px",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        <button
          onClick={toggle}
          className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 ${
            isDark ? "text-[var(--serviceops-secondary)] hover:text-[var(--serviceops-depth)] hover:bg-[rgba(255,243,214,0.09)]" : "text-[var(--serviceops-depth)] hover:text-[#000000] hover:bg-[rgba(17,17,17,0.06)]"
          }`}
          aria-label="Open menu"
        >
          <ListIcon size={20} weight="bold" />
        </button>

        <span className="flex-1" />

        <MobileSearch isDark={isDark} />

        {/* Dark / Light toggle */}
        <CreateMenu />
        <ThemeToggleButton isDark={isDark} onToggle={toggleTheme} />

        {/* Notifications */}
        <Tooltip title="3 unread notifications">
          <IconButton size="small" sx={{ borderRadius: "10px", "&:hover": { bgcolor: isDark ? "var(--serviceops-tint)" : "var(--serviceops-tint)" } }}>
            <Badge
              badgeContent={3}
              color="error"
              sx={{ "& .MuiBadge-badge": { fontSize: "0.55rem", height: 16, minWidth: 16, padding: "0 4px" } }}
            >
              <Bell size={20} color={isDark ? "#9CA3AF" : "#6B6B6B"} weight="duotone" />
            </Badge>
          </IconButton>
        </Tooltip>

        <Avatar
          onClick={e => setAvatarAnchor(e.currentTarget)}
          sx={{
            width: 34, height: 34,
            bgcolor: "var(--serviceops-primary)", fontSize: "0.6rem", fontWeight: 800,
            cursor: "pointer", border: `2px solid ${isDark ? "var(--serviceops-soft)" : "var(--serviceops-soft)"}`,
          }}
        >{initials}</Avatar>

        <UserMenu anchor={avatarAnchor} onClose={() => setAvatarAnchor(null)} router={router} isDark={isDark} />
      </header>
    );
  }

  /* ─── Compact desktop header: title on the left, tools on the right; the logo is in the sidebar ─── */
  if (compact) {
    return (
      <header
        style={{
          position: "fixed", top: 0, right: 0, left: "var(--sidebar-w)", height: "56px", zIndex: 60,
          backgroundColor: isDark ? "var(--serviceops-surface)" : "#ffffff",
          borderBottom: "1px solid var(--serviceops-soft)", display: "flex", alignItems: "center", gap: "16px", padding: "0 20px",
          transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease",
        }}
      >
        <button onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--serviceops-depth)] hover:bg-[var(--serviceops-tint)]">
          <ListIcon size={18} weight="bold" />
        </button>
        <h1 className="m-0 text-[16px] font-semibold text-[var(--text-primary)] whitespace-nowrap">{title}</h1>
        <div className="flex-1" />
        <HeaderSearch isDark={isDark} />
        <CreateMenu />
        <ThemeToggleButton isDark={isDark} onToggle={toggleTheme} />
        <Tooltip title="3 unread notifications">
          <IconButton size="small" sx={{ borderRadius: "8px" }}>
            <Badge badgeContent={3} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.58rem", height: 15, minWidth: 15, padding: "0 3px" } }}>
              <Bell size={20} color={isDark ? "#9CA3AF" : "#6B6B6B"} weight="duotone" />
            </Badge>
          </IconButton>
        </Tooltip>
        <Avatar onClick={e => setAvatarAnchor(e.currentTarget)} sx={{ width: 32, height: 32, bgcolor: "var(--serviceops-primary)", fontSize: "0.6rem", fontWeight: 800, cursor: "pointer" }}>{initials}</Avatar>
        <UserMenu anchor={avatarAnchor} onClose={() => setAvatarAnchor(null)} router={router} isDark={isDark} />
      </header>
    );
  }

  /* ─── Desktop header ─── */
  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: "72px", zIndex: 60,
        backgroundColor: isDark ? "var(--serviceops-surface)" : "#ffffff",
        borderBottom: `1px solid ${isDark ? "var(--serviceops-soft)" : "var(--serviceops-soft)"}`,
        display: "flex", alignItems: "center",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      {/* Left: hamburger + logo — fixed 260px matching expanded sidebar */}
      <div
        style={{
          width: "260px", flexShrink: 0,
          display: "flex", alignItems: "center",
          padding: "0 12px", gap: "12px",
        }}
      >
        <button
          onClick={toggle}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 ${
            isDark ? "text-[var(--serviceops-secondary)] hover:text-[var(--serviceops-depth)] hover:bg-[rgba(255,243,214,0.09)]" : "text-[var(--serviceops-depth)] hover:text-[#000000] hover:bg-[rgba(17,17,17,0.06)]"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ListIcon size={18} weight="bold" />
        </button>
        <img
          src="/logo.png"
          alt="ServiceOps"
          style={{ height: "28px", width: "auto", display: "block", flexShrink: 0 }}
        />
      </div>

      {/* Right: title + controls */}
      <div className="flex flex-1 items-center gap-8 px-8 min-w-0">
        <div className="flex-1 min-w-0">
          {/*{title ? (
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <h1 className="text-[18px] font-extrabold text-[var(--serviceops-depth)] leading-none tracking-tight m-0">{title}</h1>
              <span className="text-[11.5px] text-slate-400 font-medium">· {today}</span>
            </div>
          ) : (
            <p className="text-[12px] text-slate-400 font-medium whitespace-nowrap m-0">{today}</p>
          )} */}
        </div>

        {/* Search */}
        <HeaderSearch isDark={isDark} />

        {/* Dark / Light toggle */}
        <CreateMenu />
        <ThemeToggleButton isDark={isDark} onToggle={toggleTheme} />

        {/* Notifications */}
        <Tooltip title="3 unread notifications">
          <IconButton size="small" sx={{ borderRadius: "8px", "&:hover": { bgcolor: isDark ? "var(--serviceops-tint)" : "var(--serviceops-tint)" } }}>
            <Badge
              badgeContent={3}
              color="error"
              sx={{ "& .MuiBadge-badge": { fontSize: "0.58rem", height: 15, minWidth: 15, padding: "0 3px" } }}
            >
              <Bell size={20} color={isDark ? "#9CA3AF" : "#6B6B6B"} weight="duotone" />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Avatar */}
        <Avatar
          onClick={e => setAvatarAnchor(e.currentTarget)}
          sx={{ width: 32, height: 32, bgcolor: "var(--serviceops-primary)", fontSize: "0.6rem", fontWeight: 800, cursor: "pointer" }}
          className={`ring-2 ring-transparent transition-all ${isDark ? "hover:ring-[var(--serviceops-soft)]" : "hover:ring-[var(--serviceops-soft)]"}`}
        >{initials}</Avatar>

        <UserMenu anchor={avatarAnchor} onClose={() => setAvatarAnchor(null)} router={router} isDark={isDark} />
      </div>
    </header>
  );
}
