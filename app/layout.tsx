import type { Metadata, Viewport } from "next";
import SwRegister from "@/components/SwRegister";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeRegistry from "@/components/ThemeRegistry";
import NavGuard from "@/components/layout/NavGuard";
import AuthProvider from "@/components/AuthProvider";
import WorkspaceProvider from "@/components/WorkspaceProvider";
import { LayoutProvider } from "@/components/LayoutContext";
import { LAYOUT_BOOT_SCRIPT } from "@/lib/layoutBoot";
import { BrandProvider } from "@/components/BrandContext";
import { BRAND_BOOT_SCRIPT } from "@/lib/brandTheme";

// ── Inter: universal font family ──────────────────────────────────
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ServiceOps",
  description: "Schedule, dispatch, track and invoice field work in one place.",
  manifest: "/manifest.webmanifest",
  applicationName: "ServiceOps",
  appleWebApp: { capable: true, title: "ServiceOps", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F59E0B" }, { media: "(prefers-color-scheme: dark)", color: "#111111" }],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} style={{ fontFamily: "var(--font-inter)" }} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: LAYOUT_BOOT_SCRIPT + BRAND_BOOT_SCRIPT }} /></head>
      <body suppressHydrationWarning>
        <SwRegister />
        <AuthProvider>
          <LayoutProvider>
          <WorkspaceProvider>
            <BrandProvider>
            <ThemeRegistry>
              <NavGuard />
              {children}
            </ThemeRegistry>
            </BrandProvider>
          </WorkspaceProvider>
          </LayoutProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
