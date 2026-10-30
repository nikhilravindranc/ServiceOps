"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import { Plus, Buildings, Tray, ClipboardText, Wrench, Books, Receipt } from "@phosphor-icons/react";
import { MENU_ITEM_SX, MENU_PAPER_SX } from "@/components/ui/ServiceOpsUI";

const ITEMS = [
  { label: "Customer", icon: Buildings, href: "/customers?new=1" },
  { label: "Request", icon: Tray, href: "/requests?new=1" },
  { label: "Work order", icon: ClipboardText, href: "/work-orders?new=1" },
  { label: "Job", icon: Wrench, href: "/jobs?new=1" },
  { label: "Catalog item", icon: Books, href: "/catalog?new=1" },
] as const;

/** Global Create (+) menu: start any record from any screen. Each target page opens its own drawer. */
export default function CreateMenu() {
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const go = (href: string) => { setAnchor(null); router.push(href); };

  return (
    <>
      <button type="button" aria-haspopup="menu" aria-expanded={Boolean(anchor)} onClick={e => setAnchor(e.currentTarget)}
        className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-[10px] text-[13px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] hover:bg-[var(--serviceops-hover)] transition-colors shadow-[0_1px_8px_rgba(245,158,11,0.35)]">
        <Plus size={15} weight="bold" /><span className="hidden sm:inline">Create</span>
      </button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { ...MENU_PAPER_SX, minWidth: 210 } } }}>
        {ITEMS.map(i => (
          <MenuItem key={i.label} onClick={() => go(i.href)} sx={{ ...MENU_ITEM_SX, py: 0.9 }}>
            <ListItemIcon sx={{ minWidth: 30 }}><i.icon size={16} weight="duotone" /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: "14px" }}>{i.label}</ListItemText>
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => go("/billing")} sx={{ ...MENU_ITEM_SX, py: 0.9 }}>
          <ListItemIcon sx={{ minWidth: 30 }}><Receipt size={16} weight="duotone" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "14px" }}>Invoice a completed job</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
