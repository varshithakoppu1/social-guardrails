// lib/rateLimit.ts
//
// ⚠️ LIMITATION — READ THIS
// ------------------------------------------------------------------
// This is an IN-MEMORY, per-instance rate limiter. It works, but it
// has a real gap: serverless platforms (Vercel included) can spin up
// multiple isolated instances of your function under load. Each
// instance has its own copy of this Map, so a caller hitting a
// different instance on their next request gets a fresh limit.
//
// In practice this means: this protects you from a single client
// hammering one warm instance, but NOT from distributed abuse across
// many instances.
//
// For a true global rate limit in production, swap this module for
// a shared store — Upstash Redis (has a free tier, pairs natively
// with Vercel) is the standard choice. The interface below
// (checkRateLimit) is written so that swap only touches this file.
// ------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(identifier);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    buckets.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetAt };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - existing.count,
    resetAt: existing.resetAt,
  };
}
