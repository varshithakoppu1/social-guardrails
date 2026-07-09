import { NextRequest, NextResponse } from "next/server";

// Gates the entire app behind a single shared password, entered on
// /login (see app/login/page.tsx). Set SITE_PASSWORD in the
// environment to enable; leave it unset to keep the app fully public
// (e.g. for local development).
const PUBLIC_PATHS = ["/login", "/api/login"];

export function middleware(req: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const cookie = req.cookies.get("site_auth")?.value;
  if (cookie === sitePassword) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
