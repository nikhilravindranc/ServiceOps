import { createHmac, timingSafeEqual } from "node:crypto";

/** The role switcher is for demos and development only. Set DEMO_MODE=1 to turn it on elsewhere. */
export const demoMode = () => process.env.DEMO_MODE === "1" || !!process.env.VERCEL || process.env.NODE_ENV !== "production";

/** One sample person per role (the administrator is whoever the seed script created). */
export const DEMO_TEAM = [
  { name: "Alex Morgan", email: "alex.morgan@serviceops.com", role: "Service manager" },
  { name: "Priya Raman", email: "priya.raman@serviceops.com", role: "Dispatcher" },
  { name: "Grace Liu", email: "grace.liu@serviceops.com", role: "Service coordinator" },
  { name: "Michael Thomas", email: "michael.thomas@serviceops.com", role: "Technician" },
] as const;

const sign = (email: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`demo-switch:${email.toLowerCase()}`).digest("hex");
export const switchToken = (email: string) => sign(email);
export const validSwitchToken = (email: string, token: string) => {
  const a = Buffer.from(sign(email)); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};
