---
name: Status
description: Session entry point for AI Creative Studio (kids-studio) — answers "where are we?" from this file directly instead of re-deriving project state from the codebase/git history each session. Use at the start of a session, or whenever asked for a status update, what's in progress, or what's next.
---

# AI Creative Studio — Session Status

**This file is the answer to "where are we?"** Read it first. Only fall back to grepping the codebase, `git log`, or hitting the live site when the user asks for something more specific than this file covers, or when something here looks contradicted by what you observe.

## Standing responsibility (read this even if you skip everything else)

**Whoever invokes this skill is responsible for keeping it current.** After any meaningful unit of work in this project — a fix, a deploy, a finding, a decision — update the "Current state" and "Last session" sections below before ending the turn. This file decays the moment it's not updated; treat it like the thing future-you will trust blindly, because that's exactly what's being asked for.

## Project identity

- **Product**: AI Creative Studio (formerly "Kids AI Video Studio") — turns a short brief into a publish-ready short-form video (script → storyboard → AI-rendered clips → captions) across 7 content types.
- **Repo**: `SatyaTirumalasetty/MonkeyBanana_AIContent_Creator_Pipeline`, branch `master`. Local path: `C:\My_World\Projects\kids-studio`.
- **Production**: `https://kids-studio-beta.vercel.app` — Vercel project `prj_CDFZEkIBvbxiJytr7DvqI6CtLBLg`, team `team_eE0VPdHT5g8S5GCil6FdhrAY`. Deploys automatically on push to `master` via GitHub integration.
- **Database**: Supabase project `imlwynwpveqehsfjxgql` (`kids-studio`). System of record for `profiles`, `video_jobs`, `usage_counters`. DB changes are applied directly via the Supabase MCP tools (`apply_migration`/`execute_sql`) — there are no `.sql` migration files checked into the repo, so **the database is ahead of git** for schema; this file is the only record of what's been applied unless `/Architect`'s file also has it.
- **Stack**: Next.js 14 App Router on Vercel Functions, Supabase (Postgres + auth), Vercel Blob (binaries only), Stripe (billing), fal.ai/Kling+Flux (video gen), Gemini 2.5 Flash Lite (content agents).

## Role skills (the team you're standing in for)

- `/PO` — product vision, prioritized backlog (P0/P1/P2), competitive landscape (named competitors, gap-filtering rule), build-vs-buy methodology (free/open-source checked first, then cost-vs-features), the source of truth for "what's broken and how much does it matter."
- `/QA` — test plans, exploratory/regression findings, verification log of what's actually been proven to work (not just typechecked).
- `/UX` — design system, usability findings, flow critiques.
- `/Architect` — system design, architecture debt, the place security/scalability findings from health checks live.

All four cross-reference each other and should already reflect current reality as of their own "last updated" content — this file is a layer above them: the narrative of *what just happened* and *what's next*, not a duplicate of their detailed backlogs.

## Current state (as of 2026-06-21)

**In production**: `c813134` (checkout now requires sign-in) — pushed. Plus two direct Supabase production fixes with no app-code deploy needed: `profiles` RLS column-write restriction, and Site URL/Redirect URL config. **No P0s remain open** — three were found and fixed in the same `/QA` pass today (see below); none are pending.

**What's live and working**:
- Server-side usage enforcement + job ownership (`cbac24a`) — verified end-to-end live, including a same-day production outage in `reserve_usage()` that was caught and fixed at the DB layer (see `/PO` Resolved).
- `safeJSON` brace-matching fixed to be string-aware (`6849c80`) — verified, zero recurrences in an 8-call live sample.
- Markdown (`**label**`) now renders as bold everywhere it's displayed: the script panel (`8174845`) and the storyboard caption overlay (`19073dc`) — both DOM-verified live via Playwright against production.
- All 7 content types now generate successfully (`70f0d1d`) — `generateVideoMetadata`'s `maxOutputTokens` raised from the 4096 default to 16384, fixing a 100% failure rate on `educational`/`short_film`/`custom`. Re-verified live post-deploy: 6/6 across the 3 previously-broken types, with `video_meta`/`job`/`complete` events and a populated `lipSyncMap` confirmed present, not just absence of error.
- `/privacy` and `/terms` pages added and linked from the homepage and pricing footers (`4a90db7`) — Stripe live-mode activation's blocking requirement is cleared. Content reflects real third-party data flows (Stripe, Supabase, Vercel, Google Gemini, fal.ai); placeholder contact emails (`privacy@`/`support@aicreativestudio.app`) still need swapping for real ones, and a legal review is recommended before relying on this for compliance in a specific jurisdiction.
- **Final videos now have narration audio** (`af85a81`) — was the single biggest gap in the product (every direct competitor ships narration; ours was silent). Uses Gemini's *native* TTS (`gemini-3.1-flash-tts-preview`) via the same SDK/API key already used for content agents — zero new credentials, better than the originally-planned Cloud TTS/Polly route. Verified at three levels before and after deploy: direct API call confirming the audio format, a full local end-to-end pipeline run through the real routes producing a file with confirmed video+audio streams, and a live production re-check of the synthesis step post-deploy (real `narrationAudioUrl`, downloaded and validated as a real WAV). All test data cleaned up.
- **Studio/Cinema "Custom brand brief memory" built** (`9bff296`) — the tier-promises-something-the-backend-doesn't-enforce gap is closed. Per-account `brand_brief` field, editable from `/account` (Studio/Cinema only), injected into content/storyboard/video-tone prompts. Verified for real with an isolated temp Supabase user (not the real account): confirmed the RLS-scoped query resolves correctly, and confirmed the real Gemini API actually works a deliberately distinctive brand phrase into generated output verbatim. Temp user deleted afterward.
- **`/videos` history/gallery page built and deployed** (`505d027`) — closes the no-video-history P1. New `/api/videos` route + `listJobsByOwner()` query `video_jobs` by `owner_key` (authed or anon-cookie, reusing `resolveOwner()`); new `/videos` page renders a poster grid with status/thumbnail/download, linked from the header as "My Videos." Verified live in production post-push: `GET /videos` → 200, `GET /api/videos` → real JSON jobs response.
- **Brief-first UI with auto-detected content type built** (`dc8e2e5`, **committed but not yet pushed/deployed**) — the textarea is now the primary action instead of a mandatory 7-tile category grid; a new `/api/classify-type` route (backed by `classifyContentType` in `agents.ts`) infers the content type from the typed brief. Originated from a user challenge questioning why the UI wasn't simpler — see `/PO`'s new standing instruction to proactively originate ideas, not just triage the existing backlog. Verified live against the dev server with three distinct briefs, all classified correctly.

**Today's `/QA` pass found and fixed three real, live production issues** (full repro/verification detail in `/QA`'s Verification log and `/Architect`'s Resolved section):
- **Critical**: any free user could self-escalate to Cinema plan via a direct Supabase REST call with their own session token (`profiles` RLS scoped rows but not columns) — fixed via DB migration, verified blocked.
- **Critical**: magic-link sign-in redirected to `localhost:3000` in production (Supabase Site URL/Redirect config, not app code) — fixed via Management API, verified the redirect now lands on production.
- **P1**: guest Stripe checkout could take a payment with no plan ever granted — fixed in `c813134` by requiring sign-in before checkout.
- Bonus zero-risk cleanup: revoked an unnecessary public `EXECUTE` grant on `handle_new_user()` surfaced by the security advisor (confirmed not exploitable first, hardened anyway).

**What's open right now, in priority order** (full detail in `/PO`):
1. **P1 — quota not refunded on failed generation.** Defense-in-depth gap; rarer now since the dominant failure causes are fixed. Not started. Now the highest-priority unbuilt item.
2. Various P2 polish items — see `/PO`.

## Last session

**2026-06-20 to 2026-06-21**: Built server-side usage enforcement + job ownership from scratch (`cbac24a`), caught and fixed a same-day production outage in the new DB function (`/Architect`'s health check), hardened that function against unnecessary PUBLIC exposure, then ran several rounds of `/QA` testing that together found and fixed five real bugs: `safeJSON` truncation (`6849c80`), markdown rendering in the script panel (`8174845`) and then the storyboard caption overlay (`19073dc`), a 100%-failure-rate token-truncation bug in `generateVideoMetadata` affecting 3 of 7 content types (`70f0d1d`), and added the missing privacy/ToS pages (`4a90db7`) closing out that P0. Created the `/PO`, `/QA`, `/UX`, `/Architect`, and this `/Status` skill over the course of the session. Enhanced `/PO` twice (Competitive Landscape, then build-vs-buy methodology) — researching surfaced the silent-video P0 and the unbuilt brand-brief-memory P1. Implemented the silent-video fix (`af85a81`): Gemini's native TTS, zero new credentials. Built the brand-brief-memory feature (`9bff296`). Built and pushed the `/videos` history page (`505d027`). Then, prompted by a direct user challenge ("why isn't this simpler?"), built the brief-first auto-detected-content-type UI (`dc8e2e5`) and pushed it (`c9b621a`) — added a standing `/PO` instruction to proactively originate ideas, not just triage the backlog. Finally ran a full `/QA` auth/profile-maintenance end-to-end pass using temp Supabase accounts (created, exercised, deleted — never more than one live at a time): found and fixed the plan-self-escalation RLS gap and the magic-link localhost-redirect config issue (the latter required a user-provided Supabase personal access token to call the Management API, since neither `execute_sql` nor app code can touch Auth's Site URL config), plus the guest-checkout plan-linking gap, plus a bonus advisor-flagged grant cleanup.

**Next action, if no other instruction is given**: the quota-not-refunded-on-failure defense-in-depth fix — make `checkAndReserveUsage` only reserve a slot after generation succeeds, or refund on failure. No other known issues are open.
