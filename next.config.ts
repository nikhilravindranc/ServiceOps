import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
