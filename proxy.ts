import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

/**
 * Coarse, fast route gate (Next 16 "proxy", formerly middleware).
 *
 * This is a first line only. Every protected page, action and route handler
 * still calls requireRole()/requirePageRole(), which re-checks the database.
 */

const PROTECTED_PREFIXES = ["/buyer", "/seller", "/admin", "/valuator", "/dashboard", "/verify-mobile"];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const session = req.auth;
  if (!session?.user) {
    const login = new URL("/login", req.url);
    // Keep the original path so login can return there. Login must accept only relative paths.
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  // Cheap role gate from the JWT. Authoritative check is in requireRole().
  const role = session.user.role;
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (pathname.startsWith("/seller") && role !== "SELLER") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (pathname.startsWith("/buyer") && role !== "BUYER") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (pathname.startsWith("/valuator") && role !== "VALUATOR") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/buyer/:path*", "/seller/:path*", "/admin/:path*", "/valuator/:path*", "/dashboard/:path*", "/verify-mobile/:path*"],
};
