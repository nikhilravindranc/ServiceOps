import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Creates an empty scratch SQLite database with every migration applied and points DATABASE_URL at it.
 * Call before anything imports lib/db (use a dynamic import afterwards). Returns a cleanup function.
 */
export function useScratchDb(name: string): () => void {
  const file = path.join(os.tmpdir(), `serviceops-test-${name}-${process.pid}.db`).replaceAll("\\", "/");
  for (const f of [file, `${file}-journal`]) rmSync(f, { force: true });
  process.env.DATABASE_URL = `file:${file}`;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: `file:${file}` }, stdio: "pipe", cwd: process.cwd() });
  // Windows keeps the file locked while a connection is open, so a failed delete is not an error here.
  return () => { for (const f of [file, `${file}-journal`]) { try { rmSync(f, { force: true }); } catch { /* removed with the temp folder later */ } } };
}
