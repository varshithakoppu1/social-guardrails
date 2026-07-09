import { NextRequest, NextResponse } from "next/server";

// Gates the entire app behind a single shared password (HTTP Basic Auth).
// Set SITE_PASSWORD in the environment to enable; leave it unset to keep
// the app fully public (e.g. for local development).
export function middleware(req: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const [, password] = Buffer.from(encoded, "base64").toString().split(":");
      if (password === sitePassword) return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Guardrails Console"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
