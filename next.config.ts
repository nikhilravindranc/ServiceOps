import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";

// Deploys without AUTH_SECRET use the secret generated at build time by scripts/prepare-demo.mjs.
const demoSecret = existsSync(".demo-secret") ? readFileSync(".demo-secret", "utf8").trim() : undefined;

const nextConfig: NextConfig = {
  ...(!process.env.AUTH_SECRET && demoSecret ? { env: { AUTH_SECRET: demoSecret } } : {}),
  // Development and production builds use separate folders, so running one over the other cannot corrupt the cache.
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev",
  // Contacts and accounts live under Customers; leads and deals are now requests and estimates.
  async redirects() {
    return [
      { source: "/accounts", destination: "/customers", permanent: false },
      { source: "/accounts/:id", destination: "/customers", permanent: false },
      { source: "/contacts", destination: "/customers", permanent: false },
      { source: "/contacts/:id", destination: "/customers", permanent: false },
      // Leads and deals are now requests and estimates; tasks and comms were removed.
      { source: "/leads", destination: "/requests", permanent: false },
      { source: "/leads/:id", destination: "/requests", permanent: false },
      { source: "/deals", destination: "/billing", permanent: false },
      { source: "/deals/:id", destination: "/billing", permanent: false },
      { source: "/tasks", destination: "/", permanent: false },
      { source: "/tasks/:id", destination: "/", permanent: false },
      { source: "/comms", destination: "/", permanent: false },
    ];
  },
  // The service worker is served from the root with no HTTP caching so updates are picked up; the manifest revalidates.
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }, { key: "Service-Worker-Allowed", value: "/" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }, { key: "Content-Type", value: "application/manifest+json" }] },
    ];
  },
  // Demo deploys ship a pre-seeded SQLite file built at deploy time (see lib/db.ts).
  outputFileTracingIncludes: { "/**": ["./prisma/demo.db"] },
  experimental: {
    optimizePackageImports: [
      "@phosphor-icons/react",
      "recharts",
      "@mui/material",
      "@mui/icons-material",
    ],
  },
};

export default nextConfig;
