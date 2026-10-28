import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Former CRM areas now live under Customers (contacts are a customer tab).
  async redirects() {
    return [
      { source: "/accounts", destination: "/customers", permanent: false },
      { source: "/accounts/:id", destination: "/customers", permanent: false },
      { source: "/contacts", destination: "/customers", permanent: false },
      { source: "/contacts/:id", destination: "/customers", permanent: false },
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
