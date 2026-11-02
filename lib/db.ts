import { PrismaClient } from "@prisma/client";
import { copyFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** On Vercel the project folder is read-only: use a copy of the demo database built at deploy time, kept in /tmp (resets on cold start). */
const demoUrl = () => {
  if (!process.env.VERCEL || process.env.DEMO_MODE !== "1") return undefined;
  const tmp = path.join(os.tmpdir(), "demo.db");
  if (!existsSync(tmp)) copyFileSync(path.join(process.cwd(), "prisma", "demo.db"), tmp);
  return `file:${tmp.replaceAll("\\", "/")}`;
};

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ datasourceUrl: demoUrl() });
if (process.env.NODE_ENV !== "production") g.prisma = db;
