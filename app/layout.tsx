import type { Metadata } from "next";
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
