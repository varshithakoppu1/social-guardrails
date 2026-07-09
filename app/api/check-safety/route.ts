// app/api/check-safety/route.ts
//
// ⚠️ DATA HANDLING NOTE — READ BEFORE USING WITH REAL USERS
// ------------------------------------------------------------------
// This endpoint forwards content to NVIDIA's TRIAL API (build.nvidia.com).
// Per NVIDIA's API Trial Terms of Service, that tier is for testing and
// prototyping only — not production use with real user data — and
// NVIDIA does not represent its trial servers as suitable for personal
// or sensitive data. Use placeholder images/captions while developing.
// Moving to real users later requires NVIDIA's production/enterprise
// tier and a fresh read of https://privacy.nvidia.com at that time.
//
// This route itself stores nothing — each request is handled and
// discarded. See lib/rateLimit.ts for the one deliberate exception
// (a short-lived in-memory counter, not persisted content).
// ------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { checkContentSafety, NvidiaApiError } from "@/lib/nvidia";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateCheckSafetyRequest } from "@/lib/validation";

export const runtime = "nodejs";

function getClientIdentifier(req: NextRequest): string {
  // Vercel populates x-forwarded-for; fall back to a constant so
  // local dev doesn't throw.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function POST(req: NextRequest) {
  // --- 1. Auth: require the caller to present our own API key ---
  const expectedKey = process.env.APP_API_KEY;
  if (expectedKey) {
    const providedKey = req.headers.get("x-api-key");
    if (providedKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // --- 2. Rate limit (see lib/rateLimit.ts for scope/limitations) ---
  const identifier = getClientIdentifier(req);
  const rateLimit = checkRateLimit(identifier);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // --- 3. Parse + validate body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateCheckSafetyRequest(body);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // --- 4. Call NVIDIA, translate errors into clean HTTP responses ---
  try {
    const verdict = await checkContentSafety(
      validation.data.caption,
      validation.data.imageBase64
    );
    return NextResponse.json(verdict, {
      status: 200,
      headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
    });
  } catch (err) {
    if (err instanceof NvidiaApiError) {
      // Don't leak NVIDIA's raw error detail to the client; log it
      // server-side and return a clean message.
      console.error("NVIDIA API error:", err.status, err.detail);
      return NextResponse.json(
        { error: "Content safety check failed. Please try again." },
        { status: err.status >= 500 ? 502 : 500 }
      );
    }
    console.error("Unexpected error in check-safety:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
