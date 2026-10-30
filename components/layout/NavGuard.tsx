"use client";
import { usePathname } from "next/navigation";
import AppHeader from "./AppHeader";
import Sidebar from "./Sidebar";

const NO_NAV = ["/login", "/register", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/invite", "/onboarding", "/book", "/approve", "/pay", "/review", "/portal", "/dev-idp"];

export default function NavGuard() {
  const pathname = usePathname();
  const hide = NO_NAV.some(p => pathname === p || pathname.startsWith(p + "/"));
  if (hide) return null;
  return (
    <>
      <AppHeader />
      <Sidebar />
    </>
  );
}
