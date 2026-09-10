import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  const authed = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!authed) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*", "/account", "/account/:path*", "/billing", "/billing/:path*"],
};
