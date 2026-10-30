import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/invite", "/book", "/approve", "/pay", "/review", "/portal", "/dev-idp"];
const OPEN_WHEN_SIGNED_IN = ["/invite", "/reset-password", "/verify-email", "/book", "/approve", "/pay", "/review", "/portal", "/dev-idp"];
const isPublicPage = (p: string) => PUBLIC_PAGES.some(x => p === x || p.startsWith(`${x}/`));
const isOpenWhenSignedIn = (p: string) => OPEN_WHEN_SIGNED_IN.some(x => p === x || p.startsWith(`${x}/`));
const isPublicApi = (p: string) => p.startsWith("/api/auth") || p.startsWith("/api/account/") || p.startsWith("/api/public/") || p.startsWith("/api/portal/") || p.startsWith("/api/dev-idp/");

export default auth(req => {
  const { pathname } = req.nextUrl;
  if (isPublicApi(pathname)) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    if (isPublicPage(pathname)) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isPublicPage(pathname) && !isOpenWhenSignedIn(pathname)) {
    return NextResponse.redirect(new URL(user.onboarded ? "/" : "/onboarding", req.url));
  }
  // New organizations finish setup first (administrators only; invited staff skip it).
  if (!user.onboarded && user.role === "Administrator" && pathname !== "/onboarding" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|.*\\.svg|.*\\.png).*)"],
};
