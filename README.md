# Guardrails Console

A content moderation tool that checks an image + caption together using
NVIDIA's Nemotron 3.5 Content Safety model, wrapped in a clean API and
a console-style UI. Built as a portfolio piece demonstrating a
production-shaped (not just proof-of-concept) integration with a
third-party AI API.

**Live demo:** _add your Vercel URL here after deploying_

## Architecture

```
┌─────────────┐      POST /api/check-safety      ┌──────────────────┐
│  Browser UI │ ───────────────────────────────▶ │  Next.js Route    │
│ (page.tsx)  │                                    │  Handler (Node)   │
└─────────────┘                                    └──────────────────┘
                                                              │
                                        1. auth check ────────┤ lib/rateLimit.ts
                                        2. rate limit ────────┤ lib/validation.ts
                                        3. validate input ────┤
                                        4. call NVIDIA ───────┤ lib/nvidia.ts
                                                              ▼
                                                  ┌────────────────────────┐
                                                  │ NVIDIA Nemotron 3.5     │
                                                  │ Content Safety API      │
                                                  └────────────────────────┘
```

Each concern lives in its own module so the route handler stays
readable and each piece can be tested or swapped independently:

| File | Responsibility |
|---|---|
| `app/api/check-safety/route.ts` | Orchestrates the request: auth → rate limit → validate → call NVIDIA → respond |
| `lib/validation.ts` | Rejects malformed/oversized input before it costs an API call |
| `lib/rateLimit.ts` | Best-effort per-instance rate limiting (see limitations below) |
| `lib/nvidia.ts` | Talks to NVIDIA's API, parses its string response into typed JSON, maps errors to clean HTTP responses |
| `app/page.tsx` | Console-style UI: drop an image, write a caption, see the verdict |

## Setup

```bash
npm install
cp .env.example .env.local
# add your NVIDIA_API_KEY to .env.local
npm run dev
```

Get a free API key at [build.nvidia.com](https://build.nvidia.com).

## Deploying to Vercel

1. Push this repo to GitHub
2. Import it in Vercel
3. Add `NVIDIA_API_KEY` as an environment variable in the Vercel project settings
   (leave `APP_API_KEY` unset unless you've read the note in `.env.example`)
4. Deploy — Vercel auto-detects Next.js, no config needed

## Data handling

This project sends whatever image + caption you submit to **NVIDIA's
free trial API**. That tier's terms of service are for testing and
prototyping, not production use with real end-user data, and NVIDIA
does not represent its trial servers as suitable for personal or
sensitive data.

Practically, that means:
- No image or caption is stored by this app — every request is stateless
- Don't feed it real people's private photos while testing; use stock images
- If this ever needs to serve real users at scale, that's the point to
  move to NVIDIA's paid/enterprise tier and review
  [privacy.nvidia.com](https://privacy.nvidia.com) for current terms

## Known limitations (and how I'd fix them for real production use)

Being upfront about these is deliberate — a project that pretends to
have no tradeoffs is less credible than one that names them.

- **Rate limiting is per-instance, not global.** `lib/rateLimit.ts`
  uses an in-memory Map, which resets per serverless instance. Under
  real load with multiple warm instances, a determined caller could
  exceed the intended global limit. Fix: swap in Upstash Redis
  (`@upstash/ratelimit`), which is a drop-in replacement behind the
  same `checkRateLimit` interface and pairs natively with Vercel.
- **The optional API key isn't a strong secret if the public UI also
  needs to call the endpoint.** Any key shipped to the browser can be
  read from the network tab. Real protection here is the combination
  of server-side rate limiting + NVIDIA's own usage quota, not the key
  itself. A stronger setup would put this behind a signed, short-lived
  token issued per page load, or restrict the public demo to a fixed
  low quota and require real auth (e.g. NextAuth) for anything beyond
  that.
- **No persistence, by design.** This build intentionally keeps no
  history/logs of checks (a deliberate scope choice for this version).
  A "real" moderation product would need an audit log — which changes
  the privacy posture significantly and would need its own review.
- **No automated tests included.** For a larger version of this
  project, `lib/validation.ts` and `lib/nvidia.ts` are the two modules
  most worth unit testing, since they contain the actual logic; the
  route handler is thin orchestration.

## Tech stack

- **Next.js 14** (App Router) — API routes + frontend in one deployable unit
- **TypeScript** — strict mode
- **NVIDIA Nemotron 3.5 Content Safety** — the underlying moderation model
