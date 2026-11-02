/** Which roles may open which screens. The first matching prefix wins; the API routes enforce their own rules as well. */
export const ROLES = ["Administrator", "Service manager", "Dispatcher", "Service coordinator", "Technician"] as const;
export type Role = typeof ROLES[number];

const ALL: readonly string[] = ROLES;
const MANAGEMENT: readonly string[] = ["Administrator", "Service manager"];
const FRONT_DESK: readonly string[] = ["Administrator", "Service manager", "Dispatcher", "Service coordinator"];

const RULES: [prefix: string, roles: readonly string[]][] = [
  ["/users", ["Administrator"]],
  ["/integrations", ["Administrator"]],
  ["/settings", MANAGEMENT],
  ["/insights", MANAGEMENT],
  ["/reports", MANAGEMENT],
  ["/billing", ["Administrator", "Service manager", "Service coordinator"]],
  ["/plans", ["Administrator", "Service manager", "Service coordinator"]],
  ["/catalog", ["Administrator", "Service manager", "Service coordinator"]],
  ["/dispatch", ["Administrator", "Service manager", "Dispatcher"]],
  ["/customers", FRONT_DESK],
  ["/requests", FRONT_DESK],
  ["/inventory", ["Administrator", "Service manager", "Dispatcher", "Technician"]],
];

export function canOpen(role: string | undefined, pathname: string): boolean {
  if (!role) return false;
  const rule = RULES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return (rule ? rule[1] : ALL).includes(role);
}

/** One line on what each role can do, shown in the role switcher. */
export const ROLE_BLURB: Record<Role, string> = {
  Administrator: "Everything, including users and integrations",
  "Service manager": "All work, billing, insights and settings",
  Dispatcher: "Requests, scheduling, dispatch and jobs",
  "Service coordinator": "Requests, customers, estimates and billing",
  Technician: "Own jobs, work orders, assets and timesheet",
};
