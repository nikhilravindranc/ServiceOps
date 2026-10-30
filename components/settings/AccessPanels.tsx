"use client";
import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import Button from "@mui/material/Button";

import Drawer from "@mui/material/Drawer";
import TextField from "@mui/material/TextField";

import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

import { ShieldCheck, Lock, Envelope, UploadSimple, DownloadSimple, CaretDown, PencilSimple, Plus, Globe, Tree, CaretRight, CheckCircle, Eye, Square, Printer, Trash, ListBullets, X, ClockCounterClockwise } from "@phosphor-icons/react";
import { useTheme } from "@/components/ThemeContext";




// ---------------------------------------------
//  Roles in ServiceOps and who reports to whom
// ---------------------------------------------
interface RoleNode {
  id: string; name: string; description: string; reportsTo?: string; department?: string; createdDate?: string; children?: RoleNode[];
}
interface RoleActivity {
  id: string; roleId: string; action: string; user: string; userEmail: string; timestamp: string;
}

const ROLE_TREE: RoleNode[] = [{
  id: "administrator", name: "Administrator", description: "Everything, including users, settings and integrations", reportsTo: "—", department: "Management",
  children: [{
    id: "service-manager", name: "Service manager", description: "All service work, customers, billing and reports", reportsTo: "Administrator", department: "Operations",
    children: [
      { id: "dispatcher", name: "Dispatcher", description: "Schedules and assigns jobs; sees technicians, work orders and parts", reportsTo: "Service manager", department: "Dispatch desk", children: [] },
      { id: "coordinator", name: "Service coordinator", description: "Takes requests, raises work orders and estimates, talks to customers", reportsTo: "Service manager", department: "Customer service", children: [] },
      { id: "technician", name: "Technician", description: "Their own jobs on the mobile app", reportsTo: "Service manager", department: "Field service", children: [] },
    ],
  }],
}];

// Changes are recorded in the audit log; this panel has no sample history to show.
const ROLE_ACTIVITIES: RoleActivity[] = [];

function SettingCard({ icon: Icon, title, color = "#3B82F6", children, action }: {
  icon: React.ElementType; title: string; color?: string;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? "bg-[#1C1C1E] border-[#27272A]" : "bg-[#f9fbff] border-[#E3ECFC]"}`}>
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b ${isDark ? "border-[#27272A]" : "border-[#EFF6FF]"}`}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + (isDark ? "22" : "18") }}>
          <Icon size={13} color={color} weight="duotone" />
        </div>
        <span className={`font-heading text-[12px] font-bold uppercase tracking-wider flex-1 text-slate-500`}>{title}</span>
        {action}
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

function KV({ label, value, link, editable, onSave }: {
  label: string; value: string; link?: boolean; editable?: boolean; onSave?: (newValue: string) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const empty = !value || value === "—" || value === "-";

  const handleSave = () => {
    if (editValue.trim()) {
      onSave?.(editValue);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <div className={`py-2.5 border-b last:border-0 flex items-start justify-between group ${isDark ? "border-[#27272A]" : "border-[#EFF6FF]"}`}>
      <div className="flex-1 min-w-0">
        <div className={`text-[11.5px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? "text-[#ABABAD]" : "text-slate-400"}`}>{label}</div>
        {isEditing ? (
          <div className="flex items-center gap-1.5 -mx-2">
            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              autoFocus
              className={`flex-1 px-2 py-1 text-[14px] font-medium border rounded-lg focus:outline-none ${isDark ? "border-[#9CA3AF] bg-[#27272A] text-[#D4D4D8] focus:border-[#71717A]" : "border-[#4A7AE8] bg-white focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#4A7AE8] text-slate-700"}`}
            />
            <button onClick={handleSave} className={`px-2 py-1 text-[11px] font-bold rounded whitespace-nowrap transition-colors ${isDark ? "bg-[#3F3F46] text-[#D4D4D8] hover:bg-[#9CA3AF]" : "bg-[#1D4ED8] text-white hover:bg-[#60A5FA]"}`}>
              Save
            </button>
            <button onClick={handleCancel} className={`px-2 py-1 text-[11px] font-semibold border rounded whitespace-nowrap transition-colors ${isDark ? "border-[#3F3F46] text-[#71717A] hover:bg-[#27272A]" : "border-[#E3ECFC] text-slate-500 hover:bg-slate-50"}`}>
              Cancel
            </button>
          </div>
        ) : (
          <div
            title={empty ? undefined : editValue}
            className={`text-[14px] font-bold leading-snug truncate ${link ? (isDark ? "text-[#A1A1AA]" : "text-[#1D4ED8]") : empty ? (isDark ? "text-[#3F3F46]" : "text-slate-300") : (isDark ? "text-[#D4D4D8]" : "text-slate-700")}`}>
            {empty ? "—" : editValue}
          </div>
        )}
      </div>
      {editable && !isEditing && (
        <Tooltip title="Edit">
          <IconButton
            onClick={() => setIsEditing(true)}
            size="small"
            sx={{ p:0.4, mt:0.5, color: isDark ? "#3F3F46" : "#E2E8F0", opacity:0, transition:"opacity 0.15s", ".group:hover &":{opacity:1}, "&:hover":{color: isDark ? "#71717A" : "#E3ECFC", bgcolor: isDark ? "#27272A" : "#EFF6FF"}, borderRadius:"6px", cursor:"pointer" }}>
            <PencilSimple size={13} weight="duotone" />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}


function NewRoleDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    roleName: "",
    roleDescription: "",
    reportsTo: "",
    department: "",
    status: "Active",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (formData.roleName.trim()) {
      console.log("New role:", formData);
      onClose();
      setFormData({ roleName: "", roleDescription: "", reportsTo: "", department: "", status: "Active" });
    }
  };

  const handleClose = () => {
    onClose();
    setFormData({ roleName: "", roleDescription: "", reportsTo: "", department: "", status: "Active" });
  };

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const FX = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      ...(isDark ? {} : { backgroundColor: "#EFF6FF" }),
      fontSize: "0.82rem",
      "& fieldset":             { borderColor: isDark ? "#3F3F46" : "#E3ECFC", borderWidth: 1.5 },
      "&:hover fieldset":       { borderColor: isDark ? "#9CA3AF" : "#E3ECFC" },
      "&.Mui-focused fieldset": { borderColor: isDark ? "#71717A" : "#E3ECFC", borderWidth: 2 },
      "&.Mui-focused":          { boxShadow: isDark ? "none" : "0 0 0 2px #4A7AE8" },
      "& input":                { padding: "10px 14px" },
    },
    "& .MuiInputLabel-root":             { fontSize: "0.79rem", ...(isDark ? {} : { color: "#6B7280" }) },
    "& .MuiInputLabel-root.Mui-focused": { color: isDark ? "#A1A1AA" : "inherit" },
    "& .MuiSelect-select":               { fontSize: "0.82rem", padding: "10px 14px", ...(isDark ? {} : { backgroundColor: "#EFF6FF" }) },
  };

  return (
    <Drawer anchor="right" open={open} onClose={handleClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 520 }, display: "flex", flexDirection: "column", bgcolor: isDark ? "#18181B" : "#F8FAFF", boxShadow: isDark ? "-12px 0 48px rgba(0,0,0,0.5)" : "-12px 0 48px rgba(12,36,114,0.12)" } }}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${isDark ? "bg-[#111113] border-[#27272A]" : "bg-[#f9fbff] border-[#E3ECFC]"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${isDark ? "bg-[#27272A]" : "bg-[#8B5CF6]"}`}>
            <ShieldCheck size={18} color={isDark ? "#A1A1AA" : "#fff"} weight="duotone" />
          </div>
          <h2 className={`m-0 font-heading text-[16px] font-bold tracking-tight ${isDark ? "text-[#F4F4F5]" : "text-slate-900"}`}>New Role</h2>
        </div>
        <Tooltip title="Close">
          <IconButton size="small" onClick={handleClose}
            sx={{ borderRadius: "9px", border: `1.5px solid ${isDark ? "#3F3F46" : "#E3ECFC"}`, "&:hover": { bgcolor: isDark ? "#27272A" : "#EFF6FF" } }}>
            <X size={17} color={isDark ? "#71717A" : "#64748B"} weight="duotone" />
          </IconButton>
        </Tooltip>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Role Details */}
        <div>
          <h3 className={`font-heading text-[12px] font-bold mb-4 uppercase tracking-wider text-slate-500`}>Role Details</h3>
          <div className="space-y-3">
            <TextField label="Role Name" value={formData.roleName} onChange={e => handleChange("roleName", e.target.value)}
              size="small" fullWidth sx={FX} />
            <TextField label="Role Description" value={formData.roleDescription} onChange={e => handleChange("roleDescription", e.target.value)}
              multiline minRows={3} size="small" fullWidth sx={FX} />
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Reports To</InputLabel>
              <Select label="Reports To" value={formData.reportsTo} onChange={e => handleChange("reportsTo", e.target.value)} displayEmpty>
                <MenuItem value="" sx={{ fontSize: "0.82rem", color: "#94A3B8" }}><em>Select a role</em></MenuItem>
                <MenuItem value="Administrator" sx={{ fontSize: "0.82rem" }}>Administrator</MenuItem>
                <MenuItem value="Administrator" sx={{ fontSize: "0.82rem" }}>Administrator</MenuItem>
                <MenuItem value="Service manager" sx={{ fontSize: "0.82rem" }}>Service manager</MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>

        {/* Additional Information */}
        <div>
          <h3 className={`font-heading text-[12px] font-bold mb-4 uppercase tracking-wider text-slate-500`}>Additional Information</h3>
          <div className="space-y-3">
            <TextField label="Department" value={formData.department} onChange={e => handleChange("department", e.target.value)}
              size="small" fullWidth sx={FX} />
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={formData.status} onChange={e => handleChange("status", e.target.value)}>
                <MenuItem value="Active" sx={{ fontSize: "0.82rem" }}>Active</MenuItem>
                <MenuItem value="Inactive" sx={{ fontSize: "0.82rem" }}>Inactive</MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0 ${isDark ? "bg-[#111113] border-[#27272A]" : "bg-[#f9fbff] border-[#E3ECFC]"}`}>
        <Button variant="text" onClick={handleClose}
          sx={{ color: isDark ? "#A1A1AA" : "#64748B", textTransform: "none", fontWeight: 600, fontSize: "0.82rem", borderRadius: "9px", px: 2.5, "&:hover": { bgcolor: isDark ? "#27272A" : "#EFF6FF" } }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit}
          sx={{ bgcolor: isDark ? "#27272A" : "inherit", color: isDark ? "#F4F4F5" : undefined, borderRadius: "9px", textTransform: "none", fontWeight: 700, fontSize: "0.82rem", px: 3, boxShadow: isDark ? "none" : "0 1px 8px #1D4ED833", "&:hover": { bgcolor: isDark ? "#3F3F46" : "inherit" }, "&:active": { bgcolor: isDark ? "#18181B" : "#0C2472" } }}>
          Create Role
        </Button>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------
//  Roles panel
// ---------------------------------------------
function RoleTreeNode({ node, depth, selectedId, expandedIds, onSelect, onToggle, isDark }: {
  node: RoleNode; depth: number; selectedId: string;
  expandedIds: Set<string>; onSelect: (n: RoleNode) => void; onToggle: (id: string) => void;
  isDark: boolean;
}) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <div onClick={() => onSelect(node)}
        className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors group ${
          isDark
            ? `border-b border-[#27272A] ${isSelected ? "bg-[#27272A]" : "hover:bg-[#1C1C1E]"}`
            : `border-b border-[#E3ECFC] ${isSelected ? "bg-[#EFF6FF]" : "hover:bg-[#f9fbff]"}`
        }`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}>
        {/* Expand toggle */}
        <button onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
          className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-md transition-colors ${isDark ? "hover:bg-[#3F3F46]" : "hover:bg-[#E3ECFC]"}`}>
          {hasChildren
            ? isExpanded
              ? <CaretDown size={10} color={isDark ? "#71717A" : "#94A3B8"} weight="bold" />
              : <CaretRight size={10} color={isDark ? "#71717A" : "#94A3B8"} weight="bold" />
            : <span className={`w-1.5 h-1.5 rounded-full inline-block ${isDark ? "bg-[#3F3F46]" : "bg-[#CBD5E1]"}`} />
          }
        </button>
        <div className={`text-[14px] font-medium flex-1 ${
          isSelected
            ? isDark ? "text-[#D4D4D8] font-semibold" : "text-[#0C2472] font-semibold"
            : isDark ? "text-[#71717A]" : "text-slate-500"
        }`}>
          {node.name}
        </div>
        {isSelected && <CheckCircle size={14} color={isDark ? "#9CA3AF" : "#1D4ED8"} weight="duotone" />}
      </div>

      {hasChildren && isExpanded && node.children!.map(child => (
        <RoleTreeNode key={child.id} node={child} depth={depth + 1}
          selectedId={selectedId} expandedIds={expandedIds}
          onSelect={onSelect} onToggle={onToggle} isDark={isDark} />
      ))}
    </div>
  );
}

export function RolesPanel() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selectedRole, setSelectedRole] = useState<RoleNode>(ROLE_TREE[0]);
  const [activeTab, setActiveTab]       = useState<"overview"|"timeline">("overview");
  const [viewMode, setViewMode]         = useState<"tree"|"list">("tree");
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(
    new Set(["admin", "vp", "ops"])
  );
  const [newRoleOpen, setNewRoleOpen] = useState(false);

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const allRoles = (() => {
    const roles: RoleNode[] = [];
    const collect = (node: RoleNode) => {
      roles.push(node);
      node.children?.forEach(collect);
    };
    ROLE_TREE.forEach(collect);
    return roles;
  })();

  const roleActivities = ROLE_ACTIVITIES.filter(a => a.roleId === selectedRole.id).sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const RoleListView = () => (
    <div className="flex-1 overflow-y-auto space-y-2">
      {allRoles.map(role => (
        <button key={role.id} onClick={() => setSelectedRole(role)}
          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
            selectedRole.id === role.id
              ? isDark ? "bg-[#27272A] border-[#3F3F46] shadow-sm" : "bg-[#EFF6FF] border-[#1D4ED8] shadow-sm"
              : isDark ? "border-[#27272A] hover:bg-[#1C1C1E]" : "border-[#E3ECFC] hover:bg-[#f9fbff]"
          }`}>
          <div className={`text-[14px] font-semibold ${
            selectedRole.id === role.id
              ? isDark ? "text-[#D4D4D8]" : "text-[#0C2472]"
              : isDark ? "text-[#71717A]" : "text-slate-600"
          }`}>
            {role.name}
          </div>
          <div className={`text-[12px] mt-0.5 ${isDark ? "text-[#9CA3AF]" : "text-slate-400"}`}>{role.description}</div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Role sidebar */}
      <div className={`w-[340px] flex-shrink-0 flex flex-col border-r ${isDark ? "border-[#27272A] bg-[#111113]" : "border-[#E3ECFC] bg-[#f9fbff]"}`}>
        {/* Toolbar */}
        <div className={`px-4 py-3 border-b ${isDark ? "border-[#27272A]" : "border-[#E3ECFC]"} flex items-center gap-2`}>
          <div className={`flex items-center rounded-xl p-1 gap-1 ${isDark ? "bg-[#1C1C1E] border border-[#27272A]" : "bg-[#EFF6FF] border border-[#E3ECFC]"}`}>
            <button onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                viewMode === "tree"
                  ? isDark ? "bg-[#27272A] text-[#D4D4D8]" : "bg-[#E3ECFC] text-[#0C2472]"
                  : isDark ? "text-[#9CA3AF]" : "text-slate-400"
              }`}>
              <Tree size={12} weight="duotone" />
              Tree
            </button>
            <button onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                viewMode === "list"
                  ? isDark ? "bg-[#27272A] text-[#D4D4D8]" : "bg-[#E3ECFC] text-[#0C2472]"
                  : isDark ? "text-[#9CA3AF]" : "text-slate-400"
              }`}>
              <ListBullets size={12} weight="duotone" />
              List
            </button>
          </div>
          <div className="flex-1" />
          <Button variant="contained" size="small" onClick={() => setNewRoleOpen(true)}
            sx={{ bgcolor: isDark ? "#27272A" : "#1D4ED8", color: isDark ? "#D4D4D8" : "white", borderRadius:"9px", textTransform:"none", fontWeight:700, fontSize:"0.73rem", px:1.5, py:0.7, boxShadow: isDark ? "none" : "0 1px 6px #1D4ED833", "&:hover":{ bgcolor: isDark ? "#3F3F46" : "#2563EB", color: isDark ? "#F4F4F5" : "white" } }}>
            New Role
          </Button>
        </div>

        {/* Tree or List view */}
        <div className="flex-1 overflow-y-auto p-2">
          {viewMode === "tree" ? (
            ROLE_TREE.map(node => (
              <RoleTreeNode key={node.id} node={node} depth={0}
                selectedId={selectedRole.id} expandedIds={expandedIds}
                onSelect={setSelectedRole} onToggle={toggleExpand} isDark={isDark} />
            ))
          ) : (
            <RoleListView />
          )}
        </div>
      </div>

      {/* Role detail */}
      <div className={`flex-1 overflow-y-auto px-6 py-6 ${isDark ? "bg-[#0A0A0A]" : "bg-[#EFF6FF]"}`}>
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5">
          {(["overview","timeline"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-[14px] font-semibold capitalize transition-all ${
                activeTab === tab
                  ? isDark ? "bg-[#27272A] text-[#D4D4D8] shadow-sm" : "bg-[#1D4ED8] text-white shadow-sm"
                  : isDark ? "bg-[#1C1C1E] text-[#9CA3AF] hover:bg-[#27272A] hover:text-[#A1A1AA]" : "bg-white text-slate-500 hover:bg-[#E3ECFC] hover:text-[#0C2472]"
              }`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <SettingCard icon={ShieldCheck} title="Role Information" color="#8B5CF6">
            <KV label="Role Name"        value={selectedRole.name}        editable onSave={() => {}} />
            <KV label="Role Description" value={selectedRole.description} editable onSave={() => {}} />
            <KV label="Reports To"       value={selectedRole.reportsTo ?? "—"} editable onSave={() => {}} />
            <KV label="Department"       value={selectedRole.department ?? "—"} editable onSave={() => {}} />
            <KV label="Created Date"     value={selectedRole.createdDate ?? "—"} />
          </SettingCard>
        )}

        {activeTab === "timeline" && (() => {
          const fmt = (ts: string) => {
            const d = new Date(ts);
            return {
              date: d.toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" }),
              time: d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true }).toLowerCase(),
            };
          };
          const getIcon = (action: string) => {
            if (action.toLowerCase().includes("created")) return { icon: Plus,          color:"#1D4ED8", bg:"#EFF6FF" };
            if (action.toLowerCase().includes("updated")) return { icon: PencilSimple,  color:"#1D4ED8", bg:"#EFF6FF" };
            if (action.toLowerCase().includes("modified"))return { icon: PencilSimple,  color:"#1D4ED8", bg:"#EFF6FF" };
            if (action.toLowerCase().includes("changed")) return { icon: PencilSimple,  color:"#1D4ED8", bg:"#EFF6FF" };
            return                                               { icon: PencilSimple,  color:"#1D4ED8", bg:"#EFF6FF" };
          };
          // group by date
          const grouped: { date: string; items: typeof roleActivities }[] = [];
          roleActivities.forEach(a => {
            const { date } = fmt(a.timestamp);
            const grp = grouped.find(g => g.date === date);
            if (grp) grp.items.push(a);
            else grouped.push({ date, items: [a] });
          });

          return (
            <div className="bg-[#f9fbff] rounded-2xl border border-[#E3ECFC] shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#EFF6FF]">
                <div className="w-6 h-6 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <ClockCounterClockwise size={13} color="#1D4ED8" weight="duotone" />
                </div>
                <span className="font-heading text-[12px] font-bold uppercase tracking-wider text-slate-500">History</span>
              </div>

              {roleActivities.length > 0 ? (
                <div className="px-5 py-4 space-y-5">
                  {grouped.map(({ date, items }) => (
                    <div key={date}>
                      {/* Date divider */}
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[12px] font-semibold text-slate-400 whitespace-nowrap">{date}</span>
                        <div className="flex-1 h-px bg-[#E3ECFC]" />
                      </div>
                      {/* Items for this date */}
                      <div className="space-y-4">
                        {items.map(activity => {
                          const { time } = fmt(activity.timestamp);
                          const { icon: Icon, color, bg } = getIcon(activity.action);
                          const [verb, ...rest] = activity.action.split(" ");
                          return (
                            <div key={activity.id} className="flex items-start gap-4">
                              {/* Time */}
                              <span className="text-[12px] text-slate-400 font-medium w-[60px] flex-shrink-0 pt-0.5">{time}</span>
                              {/* Icon */}
                              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                                <Icon size={13} color={color} weight="duotone" />
                              </div>
                              {/* Text */}
                              <div className="flex-1 min-w-0">
                                <div className="text-[14px] text-slate-700 leading-snug">
                                  <span className="font-bold">{verb}:</span>{" "}
                                  <span className="font-medium">{rest.join(" ")}</span>
                                </div>
                                <div className="text-[11.5px] text-[#1D4ED8] mt-0.5">by {activity.userEmail}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-slate-400 text-[14px]">
                  No activity recorded for this role.
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* New Role Drawer */}
      {newRoleOpen && <NewRoleDrawer open={newRoleOpen} onClose={() => setNewRoleOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------
//  Permissions panel
// ---------------------------------------------
type PermKey = "fullAccess"|"create"|"read"|"update"|"delete"|"print"|"import"|"export"|"email"|"dataSharingPublic";
type PermState = Record<string, Record<string, Record<PermKey, boolean>>>;

const PERM_PAIRS: [PermKey, PermKey][] = [
  ["fullAccess","create"],
  ["read","update"],
  ["delete","print"],
  ["import","export"],
  ["email","dataSharingPublic"],
];

const PERM_META: Record<PermKey, { label: string; icon: React.ElementType; color: string }> = {
  fullAccess:        { label:"Full Access",           icon:Square,         color:"#10B981" },
  create:            { label:"Create",                icon:Plus,           color:"#1D4ED8" },
  read:              { label:"Read",                  icon:Eye,            color:"#06B6D4" },
  update:            { label:"Update",                icon:PencilSimple,   color:"#F59E0B" },
  delete:            { label:"Delete",                icon:Trash,          color:"#EF4444" },
  print:             { label:"Print",                 icon:Printer,        color:"#64748B" },
  import:            { label:"Import",                icon:UploadSimple,   color:"#8B5CF6" },
  export:            { label:"Export",                icon:DownloadSimple, color:"#8B5CF6" },
  email:             { label:"Email",                 icon:Envelope,       color:"#64748B" },
  dataSharingPublic: { label:"Data Sharing (Public)", icon:Globe,          color:"#10B981" },
};

const PERM_MODULES = [
  "Work Orders","Dispatch","Jobs","Customers","Assets","Inventory",
  "Estimates","Invoices","Reports",
  "Users","Settings","Integrations",
];

const PERM_ROLES = [
  { key:"administrator",  label:"Administrator",       color:"#7C3AED" },
  { key:"serviceManager", label:"Service manager",     color:"#2563EB" },
  { key:"dispatcher",     label:"Dispatcher",          color:"#D97706" },
  { key:"coordinator",    label:"Service coordinator", color:"#6B7280" },
  { key:"technician",     label:"Technician",          color:"#16A34A" },
];

function buildDefaultPerms(): PermState {
  const s: PermState = {};
  PERM_MODULES.forEach(mod => {
    s[mod] = {};
    PERM_ROLES.forEach(role => {
      s[mod][role.key] = {
        fullAccess:true, create:true, read:true, update:true,
        delete:true, print:true, import:true, export:true,
        email:true, dataSharingPublic:true,
      };
    });
  });
  return s;
}

function MiniToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`relative inline-flex w-[28px] h-[15px] rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${checked ? "bg-[#10B981]" : "bg-slate-200"}`}>
      <span className={`inline-block w-[11px] h-[11px] rounded-full bg-white shadow-sm transform transition-transform duration-200 absolute top-[2px] ${checked ? "translate-x-[15px]" : "translate-x-[2px]"}`} />
    </button>
  );
}

function PermCell({ module, role, state, onToggle }: {
  module: string; role: string;
  state: Record<PermKey, boolean>;
  onToggle: (mod: string, role: string, perm: PermKey) => void;
}) {
  return (
    <div className="px-3 py-2 space-y-1.5 min-w-[120px]">
      {PERM_PAIRS.map(([p1, p2]) => {
        const M1 = PERM_META[p1], M2 = PERM_META[p2];
        return (
          <div key={p1} className="flex items-center gap-2.5">
            <Tooltip title={M1.label}>
              <div className="flex items-center gap-0.5">
                <MiniToggle checked={state[p1]} onChange={() => onToggle(module, role, p1)} />
                <M1.icon size={10} color={state[p1] ? M1.color : "#E2E8F0"} weight={p1==="fullAccess"||p1==="delete"?"fill":"duotone"} />
              </div>
            </Tooltip>
            <Tooltip title={M2.label}>
              <div className="flex items-center gap-0.5">
                <MiniToggle checked={state[p2]} onChange={() => onToggle(module, role, p2)} />
                <M2.icon size={10} color={state[p2] ? M2.color : "#E2E8F0"} weight={p2==="fullAccess"||p2==="delete"?"fill":"duotone"} />
              </div>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

export function PermissionPanel() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tab, setTab]         = useState<"matrix"|"summary">("matrix");
  const [perms, setPerms]     = useState<PermState>(buildDefaultPerms);
  const [saved, setSaved]     = useState(false);
  const [mobileRole, setMobileRole] = useState(PERM_ROLES[0].key);

  const toggle = (mod: string, role: string, perm: PermKey) => {
    setPerms(prev => ({
      ...prev,
      [mod]: { ...prev[mod], [role]: { ...prev[mod][role], [perm]: !prev[mod][role][perm] } },
    }));
    setSaved(false);
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${isDark ? "bg-[#0A0A0A]" : "bg-white"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b ${isDark ? "bg-[#111113] border-[#27272A]" : "bg-[#f9fbff] border-[#E3ECFC]"}`}>
        <div className={`text-[16px] sm:text-[18px] font-extrabold tracking-tight ${isDark ? "text-[#D4D4D8]" : "text-slate-900"}`}>Permissions</div>
        <Button variant="contained" size="small"
          onClick={() => setSaved(true)}
          sx={{ bgcolor: saved ? "#10B981" : (isDark ? "#27272A" : "#1D4ED8"), color: saved ? "#fff" : (isDark ? "#D4D4D8" : "white"), borderRadius:"9px", textTransform:"none", fontWeight:700, fontSize:"0.75rem", px:2, py:0.8, boxShadow: isDark ? "none" : "0 1px 6px #1D4ED833", flexShrink: 0, "&:hover":{ bgcolor: saved ? "#059669" : (isDark ? "#3F3F46" : "#2563EB") } }}>
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 sm:px-6 pt-4 pb-0">
        {(["matrix","summary"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-t-xl text-[14px] font-semibold transition-all border border-b-0 ${
              tab === t
                ? isDark ? "bg-[#1C1C1E] border-[#27272A] text-[#D4D4D8]" : "bg-white border-[#E3ECFC] text-slate-900"
                : isDark ? "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#A1A1AA]" : "bg-transparent border-transparent text-slate-400 hover:text-slate-600"
            }`}>
            {t === "matrix" ? "Permission Matrix" : "Summary View"}
          </button>
        ))}
      </div>

      {/* Matrix — mobile: pick one role, see it as a scrollable list. Desktop: full grid. */}
      {tab === "matrix" && (
        <div className="md:hidden flex-1 overflow-hidden flex flex-col mx-4 mb-4">
          {/* Role picker */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-3 flex-shrink-0">
            {PERM_ROLES.map(role => {
              const active = mobileRole === role.key;
              return (
                <button key={role.key} onClick={() => setMobileRole(role.key)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors border-2`}
                  style={active
                    ? { backgroundColor: role.color, borderColor: role.color, color: "#fff" }
                    : { backgroundColor: "transparent", borderColor: isDark ? "#27272A" : "#E3ECFC", color: isDark ? "#9CA3AF" : "#64748B" }}>
                  {role.label}
                </button>
              );
            })}
          </div>
          {/* Module list for the selected role */}
          <div className={`flex-1 overflow-y-auto rounded-2xl border divide-y ${isDark ? "bg-[#1C1C1E] border-[#27272A] divide-[#27272A]" : "bg-white border-[#E3ECFC] divide-[#EFF6FF]"}`}>
            {PERM_MODULES.map(mod => (
              <div key={mod} className="px-4 py-3">
                <div className={`text-[13.5px] font-bold mb-2.5 ${isDark ? "text-[#D4D4D8]" : "text-slate-800"}`}>{mod}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {(Object.keys(PERM_META) as PermKey[]).map(perm => {
                    const meta = PERM_META[perm];
                    const Icon = meta.icon;
                    const checked = perms[mod][mobileRole][perm];
                    return (
                      <button key={perm} onClick={() => toggle(mod, mobileRole, perm)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors ${
                          checked
                            ? isDark ? "border-[#27272A] bg-[#111113]" : "border-[#E3ECFC] bg-[#f9fbff]"
                            : isDark ? "border-[#1C1C1E] bg-transparent opacity-50" : "border-transparent bg-transparent opacity-50"
                        }`}>
                        <Icon size={12} color={checked ? meta.color : "#94A3B8"} weight={perm === "fullAccess" || perm === "delete" ? "fill" : "duotone"} className="flex-shrink-0" />
                        <span className={`text-[11.5px] font-medium truncate ${isDark ? "text-[#D4D4D8]" : "text-slate-700"}`}>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "matrix" && (
        <div className={`hidden md:block flex-1 overflow-auto mx-6 mb-4 rounded-b-2xl rounded-tr-2xl border shadow-sm ${isDark ? "bg-[#1C1C1E] border-[#27272A]" : "bg-white border-[#E3ECFC]"}`}>
          <table className="so-table w-full border-collapse text-left" style={{ minWidth: 900 }}>
            <thead>
              <tr className={`border-b ${isDark ? "bg-[#111113] border-[#27272A]" : "bg-[#f9fbff] border-[#E3ECFC]"}`}>
                <th className={`sticky left-0 z-10 px-5 py-3 text-[11px] font-bold uppercase tracking-wider w-[160px] border-r ${isDark ? "bg-[#111113] text-[#9CA3AF] border-[#27272A]" : "bg-[#f9fbff] text-slate-600 border-[#E3ECFC]"}`}>
                  Module
                </th>
                {PERM_ROLES.map(role => (
                  <th key={role.key} className="px-3 py-3 text-center min-w-[140px]">
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: role.color }}>
                      {role.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERM_MODULES.map((mod, i) => (
                <tr key={mod} className={`border-b ${isDark ? `border-[#27272A] ${i % 2 === 0 ? "bg-[#1C1C1E]" : "bg-[#18181B]"}` : `border-[#E3ECFC] ${i % 2 === 0 ? "bg-white" : "bg-[#f9fbff]"}`}`}>
                  <td className={`sticky left-0 z-10 px-5 py-2 border-r font-semibold text-[14px] bg-inherit align-middle whitespace-nowrap ${isDark ? "text-[#A1A1AA] border-[#27272A]" : "text-slate-700 border-[#E3ECFC]"}`}>
                    {mod}
                  </td>
                  {PERM_ROLES.map(role => (
                    <td key={role.key} className={`border-r last:border-r-0 align-top ${isDark ? "border-[#27272A]" : "border-[#E3ECFC]"}`}>
                      <PermCell module={mod} role={role.key} state={perms[mod][role.key]} onToggle={toggle} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "summary" && (
        <div className="flex-1 overflow-auto px-4 sm:px-6 py-5 space-y-5">
          {/* Role cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERM_ROLES.map(role => {
              const rolePerms = perms;
              return (
                <div key={role.key} className="bg-white rounded-2xl border border-[#E3ECFC] shadow-sm overflow-hidden">
                  {/* Role header badge */}
                  <div className="px-4 py-3 border-b border-[#EFF6FF]">
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: role.color }}>
                      {role.label}
                    </span>
                  </div>
                  {/* Module rows */}
                  <div className="divide-y divide-[#F8FAFF]">
                    {PERM_MODULES.map(mod => {
                      const state = rolePerms[mod]?.[role.key];
                      const activePerms = state
                        ? (Object.entries(state) as [PermKey, boolean][]).filter(([, v]) => v).map(([k]) => k)
                        : [];
                      const hasAny = activePerms.length > 0;
                      return (
                        <div key={mod} className="flex items-center justify-between px-4 py-2 hover:bg-[#fafcff] transition-colors">
                          <span className="text-[14px] text-slate-600 font-medium">{mod}</span>
                          {hasAny ? (
                            <div className="flex items-center gap-0.5">
                              {activePerms.map(perm => {
                                const meta = PERM_META[perm];
                                if (!meta) return null;
                                const Icon = meta.icon;
                                return (
                                  <Tooltip key={perm} title={meta.label}>
                                    <span className="flex items-center justify-center w-5 h-5">
                                      <Icon size={12} color={meta.color} weight={perm === "fullAccess" || perm === "delete" ? "fill" : "duotone"} />
                                    </span>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          ) : (
                            <Lock size={12} color="#E2E8F0" weight="duotone" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-2xl border border-[#E3ECFC] px-5 py-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Permission Legend</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 sm:gap-x-8 gap-y-2">
              {(Object.entries(PERM_META) as [PermKey, typeof PERM_META[PermKey]][]).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <Icon size={13} color={meta.color} weight={key === "fullAccess" || key === "delete" ? "fill" : "duotone"} />
                    <span className="text-[12px] text-slate-600">{meta.label}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <Lock size={13} color="#E2E8F0" weight="duotone" />
                <span className="text-[12px] text-slate-600">Data Sharing (Private)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {tab === "matrix" && (
        <div className={`mx-4 sm:mx-6 mb-5 rounded-2xl border px-4 sm:px-5 py-3 flex-shrink-0 ${isDark ? "bg-[#1C1C1E] border-[#27272A]" : "bg-white border-[#E3ECFC]"}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isDark ? "text-[#9CA3AF]" : "text-slate-500"}`}>Permission Legend</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-1.5">
            {(Object.entries(PERM_META) as [PermKey, typeof PERM_META[PermKey]][]).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <Icon size={12} color={meta.color} weight={key==="fullAccess"||key==="delete"?"fill":"duotone"} />
                  <span className={`text-[11.5px] ${isDark ? "text-[#71717A]" : "text-slate-600"}`}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
