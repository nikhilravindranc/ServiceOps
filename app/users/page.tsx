"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Button from "@mui/material/Button";
import { UserPlus, UsersThree, Eye, PencilSimple, Prohibit, PaperPlaneTilt, ShieldCheck, ArrowSquareOut, Phone, Envelope } from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, ListCard, SearchBox, FilterSelect, DataTable, Pill, PersonCell, ActionMenu, useToast,
  SideDrawer, DrawerSection, DrawerActions, Segmented, KV, type Column, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { matchesQuery } from "@/lib/filtering";
import { USERS, SERVICE_ZONES, techProfile, type AppUser, type UserRole, type UserStatus } from "@/lib/serviceData";

const ROLES: UserRole[] = ["Administrator", "Service manager", "Dispatcher", "Service coordinator", "Technician"];
const ROLE_TONE: Record<UserRole, PillTone> = { Administrator: "purple", "Service manager": "blue", Dispatcher: "amber", "Service coordinator": "gray", Technician: "green" };
const ROLE_DESC: Record<UserRole, string> = {
  Administrator: "Everything, including users, settings and integrations.",
  "Service manager": "All service work, customers, billing and reports for their territory.",
  Dispatcher: "Schedules and assigns jobs; sees technicians, work orders and parts.",
  "Service coordinator": "Takes requests, raises work orders and estimates, talks to customers.",
  Technician: "Their own jobs on the mobile app — customer, asset, parts, time and sign-off.",
};
const STATUS_TONE: Record<UserStatus, PillTone> = { Active: "green", Invited: "amber", Deactivated: "gray" };
const TEAMS = ["Operations", "Dispatch desk", "Customer service", "HVAC & Mechanical", "Electrical", "Plumbing", "Vertical transport", "General service"];
const TERRITORIES = ["All territories", "North East", "Mid-Atlantic", "New England", ...SERVICE_ZONES.map(z => `${z} zone`)];
type Scope = "all" | UserRole;

export default function UsersPage() {
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("All status");
  const [teamF, setTeamF] = useState("All teams");
  const [open, setOpen] = useState<AppUser | null>(null);
  const [invite, setInvite] = useState(false);
  const blank = { name: "", email: "", phone: "", role: "Technician" as UserRole, team: "General service", territory: "Central zone" };
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState("");

  const users = useMemo(() => [...USERS], [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = users.filter(u =>
    (scope === "all" || u.role === scope)
    && (statusF === "All status" || u.status === statusF)
    && (teamF === "All teams" || u.team === teamF)
    && matchesQuery(search, u.name, u.email, u.team, u.territory));

  const count = (r: UserRole) => users.filter(u => u.role === r).length;
  const columns: Column<AppUser>[] = [
    { key: "user", header: "User", sortValue: u => u.name, cell: u => <PersonCell name={u.name} src={u.avatar} sub={u.email} size={34} /> },
    { key: "role", header: "Role", sortValue: u => ROLES.indexOf(u.role), cell: u => <Pill tone={ROLE_TONE[u.role]} dot={false}>{u.role}</Pill> },
    { key: "team", header: "Team", sortValue: u => u.team, cell: u => <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap">{u.team}</span> },
    { key: "territory", header: "Territory", cell: u => <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap">{u.territory}</span> },
    { key: "phone", header: "Contact", cell: u => <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap">{u.phone}</span> },
    { key: "status", header: "Status", sortValue: u => u.status, cell: u => <Pill tone={STATUS_TONE[u.status]}>{u.status}</Pill> },
    { key: "last", header: "Last active", hideBelow: "xl", cell: u => <span className="text-table-cell text-[var(--text-muted)] whitespace-nowrap">{u.lastActive}</span> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: u => (
        <ActionMenu label={`Actions for ${u.name}`} actions={[
          { label: "View & edit", icon: Eye, onClick: () => setOpen(u) },
          ...(u.status === "Invited" ? [{ label: "Resend invite", icon: PaperPlaneTilt, onClick: () => notify(`Invite resent to ${u.email}`) }] : []),
          { label: u.status === "Deactivated" ? "Reactivate" : "Deactivate", icon: Prohibit, danger: u.status !== "Deactivated", divider: true, disabled: u.id === "u-pm",
            onClick: () => { u.status = u.status === "Deactivated" ? "Active" : "Deactivated"; setVersion(v => v + 1); notify(`${u.name} ${u.status === "Active" ? "reactivated" : "deactivated"}`); } },
        ]} />
      ),
    },
  ];

  const sendInvite = () => {
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) { setErr("Enter a name and a valid work email"); return; }
    USERS.push({ id: `u-${Date.now()}`, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || "—", role: form.role, team: form.team, territory: form.territory, status: "Invited", lastActive: "—" });
    setInvite(false); setForm(blank); setErr(""); setVersion(v => v + 1);
    notify(`Invite sent to ${form.email.trim()}`);
  };
  const MI = { fontSize: "0.84rem" };
  const tech = open?.role === "Technician" ? techProfile(open.name) : undefined;

  return (
    <PageShell>
      <PageHeader title="Users" subtitle="Who uses ServiceOps, what they're responsible for, and where they work."
        crumbs={[{ label: "Admin" }, { label: "Users" }]}
        actions={<PrimaryButton icon={UserPlus} onClick={() => setInvite(true)}>Invite user</PrimaryButton>} />

      <ListCard>
        <div className="flex flex-col gap-3">
          <Segmented value={scope} onChange={setScope} options={[
            { value: "all", label: "Everyone", count: users.length },
            { value: "Technician", label: "Technicians", count: count("Technician") },
            { value: "Dispatcher", label: "Dispatchers", count: count("Dispatcher") },
            { value: "Service coordinator", label: "Coordinators", count: count("Service coordinator") },
            { value: "Service manager", label: "Managers", count: count("Service manager") },
            { value: "Administrator", label: "Admins", count: count("Administrator") },
          ]} />
          <div className="flex flex-wrap items-center gap-3">
            <SearchBox value={search} onChange={setSearch} placeholder="Search name, email, team…" className="w-full sm:w-auto sm:flex-1 lg:flex-none lg:w-[300px]" />
            <FilterSelect value={teamF} options={["All teams", ...TEAMS]} onChange={setTeamF} className="flex-1 sm:flex-none min-w-[150px] sm:w-[190px]" />
            <FilterSelect value={statusF} options={["All status", "Active", "Invited", "Deactivated"]} onChange={setStatusF} className="flex-1 sm:flex-none min-w-[140px] sm:w-[160px]" />
          </div>
        </div>
        <DataTable columns={columns} rows={filtered} rowKey={u => u.id} onRowClick={setOpen} pageSize={10} noun="users" minWidth={980}
          empty={{ icon: UsersThree, title: "No users match", hint: "Try a different role, team or search" }}
          rowClassName={u => (u.status === "Deactivated" ? "opacity-60" : "")}
          mobileCard={u => (
            <div className="flex items-center justify-between gap-3">
              <PersonCell name={u.name} src={u.avatar} sub={`${u.role} · ${u.team}`} size={36} />
              <Pill tone={STATUS_TONE[u.status]}>{u.status}</Pill>
            </div>
          )} />
      </ListCard>

      {/* ── User detail ── */}
      <SideDrawer open={!!open} onClose={() => setOpen(null)} icon={PencilSimple} title={open?.name ?? ""} subtitle={open ? `${open.role} · ${open.team}` : ""}
        footer={open ? <DrawerActions onCancel={() => setOpen(null)} onSubmit={() => { setVersion(v => v + 1); notify(`${open.name} updated`); setOpen(null); }} submitLabel="Save changes" /> : undefined}>
        {open && (
          <>
            <DrawerSection title="Contact">
              <KV label="Email"><a href={`mailto:${open.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Envelope size={14} />{open.email}</a></KV>
              <KV label="Phone"><a href={`tel:${open.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone size={14} />{open.phone}</a></KV>
              <KV label="Last active">{open.lastActive}</KV>
            </DrawerSection>
            <DrawerSection title="Role & access">
              <div className="grid grid-cols-1 gap-3">
                <FormControl size="small" fullWidth sx={FX}>
                  <InputLabel>Role</InputLabel>
                  <Select label="Role" value={open.role} disabled={open.id === "u-pm"} onChange={e => { open.role = e.target.value as UserRole; setVersion(v => v + 1); }}>
                    {ROLES.map(r => <MenuItem key={r} value={r} sx={MI}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
                <p className="m-0 text-caption text-[var(--text-muted)]">{ROLE_DESC[open.role]}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormControl size="small" fullWidth sx={FX}>
                    <InputLabel>Team</InputLabel>
                    <Select label="Team" value={open.team} onChange={e => { open.team = e.target.value; setVersion(v => v + 1); }}>
                      {TEAMS.map(t => <MenuItem key={t} value={t} sx={MI}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth sx={FX}>
                    <InputLabel>Territory</InputLabel>
                    <Select label="Territory" value={open.territory} onChange={e => { open.territory = e.target.value; setVersion(v => v + 1); }}>
                      {TERRITORIES.map(t => <MenuItem key={t} value={t} sx={MI}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </div>
                <Link href="/settings?tab=permission" className="inline-flex items-center gap-1.5 text-button-sm text-blue-600 hover:underline">
                  <ShieldCheck size={14} /> Fine-tune what each role can do in Settings <ArrowSquareOut size={12} />
                </Link>
              </div>
            </DrawerSection>
            {tech && (
              <DrawerSection title="Field profile">
                <KV label="Home zone">{tech.zone}</KV>
                <KV label="Shift">{`${tech.shift[0]}:00 – ${tech.shift[1]}:00`}</KV>
                <KV label="Skills">{tech.skills.join(", ")}</KV>
                <KV label="Van">{tech.van}</KV>
                <Button size="small" variant="outlined" href="/dispatch" sx={{ mt: 1.5 }}>See schedule in Dispatch</Button>
              </DrawerSection>
            )}
          </>
        )}
      </SideDrawer>

      {/* ── Invite ── */}
      <SideDrawer open={invite} onClose={() => setInvite(false)} icon={UserPlus} title="Invite user" subtitle="They'll get an email to set a password and download the app"
        footer={<DrawerActions onCancel={() => setInvite(false)} onSubmit={sendInvite} submitLabel="Send invite" />}>
        <DrawerSection title="Person">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Full name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" fullWidth sx={FX} error={!!err && !form.name.trim()} />
            <TextField label="Work email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} size="small" fullWidth sx={FX} error={!!err} helperText={err} />
            <TextField label="Mobile" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} size="small" fullWidth sx={FX} />
          </div>
        </DrawerSection>
        <DrawerSection title="Role">
          <div className="flex flex-col gap-2">
            {ROLES.map(r => (
              <label key={r} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${form.role === r ? "border-[var(--serviceops-primary)] bg-[var(--serviceops-primary-10)]" : "border-[var(--border)] hover:border-[var(--serviceops-primary)]"}`}>
                <input type="radio" name="role" checked={form.role === r} onChange={() => setForm(f => ({ ...f, role: r }))} className="mt-1 accent-[#F59E0B]" />
                <span><span className="block text-label text-[var(--text-primary)]">{r}</span><span className="block text-caption text-[var(--text-muted)]">{ROLE_DESC[r]}</span></span>
              </label>
            ))}
          </div>
        </DrawerSection>
        <DrawerSection title="Where they work">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Team</InputLabel>
              <Select label="Team" value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}>
                {TEAMS.map(t => <MenuItem key={t} value={t} sx={MI}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Territory</InputLabel>
              <Select label="Territory" value={form.territory} onChange={e => setForm(f => ({ ...f, territory: e.target.value }))}>
                {TERRITORIES.map(t => <MenuItem key={t} value={t} sx={MI}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          </div>
        </DrawerSection>
      </SideDrawer>

      {toastNode}
    </PageShell>
  );
}
