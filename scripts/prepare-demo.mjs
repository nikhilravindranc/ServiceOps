// Vercel build step: creates and seeds the demo SQLite database and a per-deployment auth secret, so a plain git push deploys with no dashboard settings.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

// A real (non-demo) deployment sets DEMO_MODE=0: no demo database, no public demo login, no role switcher.
if (process.env.DEMO_MODE === "0") { console.log("DEMO_MODE=0: skipping the demo database and demo login."); process.exit(0); }

const env = { ...process.env };
env.DATABASE_URL = "file:./demo.db";
env.SEED_ADMIN_EMAIL ||= "demo@serviceops.dev";
env.SEED_ADMIN_PASSWORD ||= "ServiceOps-Demo-2026";

writeFileSync(".demo-mode", "1");
if (!process.env.AUTH_SECRET && !existsSync(".demo-secret")) writeFileSync(".demo-secret", randomBytes(32).toString("base64"));

const run = cmd => execSync(cmd, { stdio: "inherit", env });
run("npx prisma migrate deploy");
run("npx tsx prisma/seed.ts");
console.log(`Demo login: ${env.SEED_ADMIN_EMAIL}`);
