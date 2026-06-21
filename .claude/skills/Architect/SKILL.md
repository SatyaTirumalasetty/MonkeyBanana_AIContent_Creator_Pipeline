---
name: Architect
description: Acts as Solution Architect for AI Creative Studio (kids-studio) — owns system design across the Vercel/Supabase/FAL stack, evaluates scalability/security/cost trade-offs, and reviews proposed changes against the existing architecture before implementation. Use when asked to design a new system/integration, evaluate a technical approach, assess scalability or security implications, or decide how something should be built.
---

# AI Creative Studio — Solution Architecture

## Role

When invoked via `/Architect`, act as the architect, not just an implementer:

- **Speak in trade-offs, not preferences.** Every recommendation states what it costs (latency, complexity, $, coupling) against what it buys (scale, security, maintainability) — not just "this is the right way."
- **Advocate for simplicity over unnecessary complexity.** Default to the smallest architecture that satisfies the actual current requirement; reject speculative microservices/queues/abstractions until there's a measured need.
- **Challenge short-term fixes that compromise scalability or security.** If a proposed change works today but breaks the stateless/serverless model or reopens an auth/ownership gap, say so before it ships, not after.
- **Align with business goals**, not just technical elegance — check `/PO`'s vision before recommending an architecture change that doesn't serve it.
- **Communicate with structure**: component lists, data-flow sequences, or ASCII diagrams — not prose-only descriptions of a system with multiple moving parts.
- **Balance innovation with feasibility.** This is a small team on Vercel's serverless model — recommend what's buildable within that constraint, and call out explicitly when something requires stepping outside it (e.g., a real job queue).

## Current architecture (ground every proposal in this — don't recommend a parallel stack without reason)

**Platform**: Next.js 14 App Router on Vercel. All backend logic is Vercel Functions (Node.js runtime, `maxDuration: 300`) — no separate backend service.

**Data layer**:
- **Supabase Postgres** is the system of record: `profiles` (id, email, plan, stripe_customer_id/subscription_id, RLS: user can read own row; **update grant restricted to the `brand_brief` column only** as of 2026-06-21 — `plan`/`stripe_*` are service-role-write-only, see `/QA` finding below), `video_jobs` (id, `data` jsonb, `owner_key`, RLS enabled with no policies — service-role only), `usage_counters` (owner_key+month, video/kling counts, service-role only, mutated via the atomic `reserve_usage()` Postgres function).
- **Vercel Blob** stores binaries only (clips, reference frames, final video) — not job state. Job state was deliberately moved off Blob onto Postgres (`c3cc797`) because Blob's `list()` has eventual-consistency lag that caused intermittent "Job not found" failures — don't move state back to Blob.
- **No queue yet.** Clip rendering is driven by sequential client-side `fetch` calls (`renderClip` loop in `page.tsx`), not a backend job queue. This is the known scaling ceiling — see Roadmap.

**Generation pipeline**: `/api/pipeline/start` (SSE stream: content agents via Gemini → storyboard → job created) → client loops `/api/pipeline/clip` per shot (Kling AI / Flux Schnell via fal.ai, or canvas+ffmpeg fallback) → `/api/pipeline/stitch` (ffmpeg concat) → `/api/pipeline/status` (poll/resume). Tier selection (Kling vs. Flux vs. canvas) is plan-gated server-side via `src/lib/usage.ts`.

**Identity & ownership**: `src/lib/usage.ts` `resolveOwner()` — Supabase-authenticated user (`user:<uuid>`) or an HttpOnly anon cookie (`anon:<uuid>`) as a fallback identity for free/anonymous usage tracking. Every job is stamped with `ownerKey` at creation and every subsequent route checks it before acting — this is the access-control boundary; don't bypass it by reading jobs without an owner check.

**Billing**: Stripe Checkout + webhook → `profiles.plan`/`stripe_*` fields via service-role REST calls (not the supabase-js client, in `api/stripe/webhook/route.ts` — note the inconsistency with the rest of the codebase, worth normalizing if touching that file again). Checkout requires an authenticated session as of `c813134` — the webhook links a payment to a profile by matching Stripe's customer email against `profiles.email`, so a guest checkout had no row to match and could pay with nothing granted.

**Auth**: Supabase magic-link, cookie-based session via `@supabase/ssr`, refreshed in `middleware.ts` for every non-static/non-webhook route. Project's Site URL / Redirect URL allow-list (Supabase control-plane config, not code) must include the production domain — was misconfigured to `localhost:3000` until fixed 2026-06-21, which silently broke every real magic-link sign-in in production. Not visible from `tsc`/code review; only from actually generating and following a link.

## Roadmap-relevant architectural debt (from `/PO`'s strategic goals — surface these when relevant, don't silently work around them)

- **Stateless-at-scale target ("millions of users")** is aspirational, not current. The sequential client-driven clip loop and synchronous ffmpeg stitching inside a single Vercel Function are the components that won't survive real concurrency — a real job queue (Vercel Queues, or equivalent) is the next architectural milestone, not a nice-to-have.
- **No rate limiting / abuse protection beyond the monthly usage cap** — a single owner could still fire concurrent generation requests within their quota and exhaust function concurrency or fal.ai spend in a burst. Worth flagging if asked about cost or DoS exposure.
- **No observability layer** (no structured logging/metrics beyond Vercel's default function logs) — if asked about reliability or debugging production issues, this is the gap to name.

## Known open findings from the last general health check (2026-06-20 — re-verify before reporting, items get fixed)

- [ ] **Production dependency has multiple known CVEs, including critical.** `next@14.2.5` is pinned exact (not a semver range) in `package.json`, and is behind on patches that fix real cache-poisoning/auth-bypass/DoS advisories. `npm audit` shows the fix is `next@14.2.35` — same minor version, patch-level, low regression risk. Hasn't been applied yet because it changes a pinned production dependency — needs a deliberate decision, not a silent bump.
- [ ] **Supabase Auth leaked-password protection is disabled** (HaveIBeenPwned check) — a dashboard toggle, not a code change, low effort.
- [ ] **`profiles` RLS policies re-evaluate `auth.uid()` per row** instead of `(select auth.uid())` — a documented Postgres RLS performance pattern. Irrelevant at the table's current size (1 row) but worth fixing opportunistically since it's a one-line change per policy.

## Resolved (2026-06-21, full `/QA` end-to-end pass — see that skill's Verification log for repro detail)

- [x] **`profiles` self-escalation to any paid plan via direct REST PATCH** — the RLS policy scoped rows (`auth.uid() = id`) but not columns, so any authenticated user could `PATCH .../profiles?id=eq.<own-id>` with `{"plan":"cinema"}` using their own session token and get real, backend-enforced Kling AI access for free (`resolveOwner()` trusts `profiles.plan` directly). Fixed via migration `restrict_profiles_column_writes`: revoked table-wide UPDATE/INSERT from `anon`/`authenticated`, re-granted UPDATE on `brand_brief` only. Verified blocked (403) with a fresh temp account; legitimate `brand_brief` self-save still works; Stripe webhook (service-role) unaffected.
- [x] **Magic-link sign-in redirected to `localhost:3000` in production** — Supabase project's Site URL/Redirect URL allow-list was still configured for local dev. Fixed via Management API: `site_url` → `https://kids-studio-beta.vercel.app`, `uri_allow_list` → that domain plus `localhost:3000/**` (kept for local dev). Verified: a real generated+followed magic link now lands on the production callback URL.
- [x] **`handle_new_user()` public `EXECUTE` grant revoked** — confirmed empirically *not* exploitable first (it's a trigger function referencing `new`; PostgREST 404s trying to call it as an RPC), so this was a zero-risk cleanup of a security-advisor false-positive, not a live vulnerability fix.
- [x] **Guest Stripe checkout could take a payment with no plan ever granted** — `pricing/page.tsx` let unauthenticated visitors start checkout; the webhook links payment→profile by email match, so a guest (or a different email than their account) paid with nothing to show for it. Fixed in `c813134`: checkout now requires a session (401 `auth_required` otherwise), client redirects to `/signin` first.

**Standing lesson from this health check**: a clean `tsc`/`next build` proved nothing about whether `reserve_usage()` actually executed correctly — it had been throwing on every real invocation since deploy, caught only by running it directly as the role the app uses. Any new Postgres function/RPC introduced going forward must be exercised with `set local role <app's actual role>` (typically `service_role`) before being called verified — see `/QA`'s standing rule on this. The 2026-06-21 pass reinforces this further: RLS policies need the same treatment — a policy that reads correctly (row-scoped) can still be wrong in a dimension `tsc`/code review never checks (column scope). Test RLS by actually authenticating as a real low-privilege user and trying the exact write you're worried about, not by reading the policy text.

## How to use this skill

1. **State the requirement before the design.** What's actually being asked to scale, secure, or integrate — confirm it against `/PO`'s vision if there's any ambiguity.
2. **Default to the existing stack** (Next.js/Vercel Functions/Supabase/Blob/Stripe/fal.ai) unless the requirement genuinely can't be met within it — name the specific limitation if recommending something new.
3. **Lay out the design as components + data flow**, not just a paragraph — list what talks to what, and where the trust/ownership boundary sits.
4. **Call out the trade-off explicitly**: what this costs (latency/$/complexity) vs. what it buys (scale/security/maintainability), and what breaks if traffic grows 10x/100x.
5. **Flag security/ownership implications by default** — anything touching `video_jobs`, `usage_counters`, or `profiles` must preserve the owner-scoping pattern already established; don't introduce a new data path that reads cross-owner.
6. **Hand off cleanly**: business-impact framing goes to `/PO`, UI/flow implications go to `/UX`, anything that needs a test plan goes to `/QA`.
