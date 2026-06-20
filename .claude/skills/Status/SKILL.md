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

**In production right now**: commit `4a90db7` — confirmed `READY` on Vercel and live-verified. **No P0s remain open.**

**What's live and working**:
- Server-side usage enforcement + job ownership (`cbac24a`) — verified end-to-end live, including a same-day production outage in `reserve_usage()` that was caught and fixed at the DB layer (see `/PO` Resolved).
- `safeJSON` brace-matching fixed to be string-aware (`6849c80`) — verified, zero recurrences in an 8-call live sample.
- Markdown (`**label**`) now renders as bold everywhere it's displayed: the script panel (`8174845`) and the storyboard caption overlay (`19073dc`) — both DOM-verified live via Playwright against production.
- All 7 content types now generate successfully (`70f0d1d`) — `generateVideoMetadata`'s `maxOutputTokens` raised from the 4096 default to 16384, fixing a 100% failure rate on `educational`/`short_film`/`custom`. Re-verified live post-deploy: 6/6 across the 3 previously-broken types, with `video_meta`/`job`/`complete` events and a populated `lipSyncMap` confirmed present, not just absence of error.
- `/privacy` and `/terms` pages added and linked from the homepage and pricing footers (`4a90db7`) — Stripe live-mode activation's blocking requirement is cleared. Content reflects real third-party data flows (Stripe, Supabase, Vercel, Google Gemini, fal.ai); placeholder contact emails (`privacy@`/`support@aicreativestudio.app`) still need swapping for real ones, and a legal review is recommended before relying on this for compliance in a specific jurisdiction.

**What's open right now, in priority order** (full detail in `/PO`):
1. **P0 — final videos ship with zero narration audio.** Newly discovered 2026-06-21 via competitive research: `generateVideoMetadata` generates a full `audioScript` + `lipSyncMap`, but no TTS step ever exists, and the final ffmpeg stitch is explicitly `a=0` (no audio track). Every competitor in this category (Synthesia, HeyGen, Fliki, InVideo AI, Pictory) ships narration as the category-defining feature. **This is the single highest-priority open item.** Provider decision is now made (see `/PO`): paid API (Google Cloud TTS or Amazon Polly Neural), not self-hosted open-source — Piper is genuinely free-and-architecture-compatible but audibly robotic, and the better open-source options (XTTS-v2/Bark) need GPU hosting that isn't actually free once ops is counted. Paid API cost is ~$0.01-0.03/video, negligible next to Kling's ~$7/clip. Not implemented yet — next concrete step is wiring the chosen API's output into `stitch/route.ts`'s ffmpeg call (`a=0` → `a=1`).
2. **P1 — Studio tier ($49.99/mo) sells "Custom brand brief memory" with zero backend implementation.** Newly discovered 2026-06-21, same pattern as the original usage-enforcement P0 from earlier in the project. Not started.
3. **P1 — quota not refunded on failed generation.** Defense-in-depth gap; rarer now since the two dominant failure causes (`safeJSON`, `maxOutputTokens`) are both fixed. Not started.
4. **P1 — no video history/gallery UI.** Data layer supports it (`owner_key` scoping exists); no UI. Cross-validated by competitive research as a category-standard expectation, not just an internal gap. Not started.
5. Various P2 polish items — see `/PO`.

## Last session

**2026-06-20 to 2026-06-21**: Built server-side usage enforcement + job ownership from scratch (`cbac24a`), caught and fixed a same-day production outage in the new DB function (`/Architect`'s health check), hardened that function against unnecessary PUBLIC exposure, then ran several rounds of `/QA` testing that together found and fixed five real bugs: `safeJSON` truncation (`6849c80`), markdown rendering in the script panel (`8174845`) and then the storyboard caption overlay (`19073dc`), a 100%-failure-rate token-truncation bug in `generateVideoMetadata` affecting 3 of 7 content types (`70f0d1d`), and added the missing privacy/ToS pages (`4a90db7`) closing out that P0. Every fix was verified live against production (not just typechecked/built), several requiring Playwright browser-level checks since they were client-side-only or behind a client-rendering bailout. Created the `/PO`, `/QA`, `/UX`, `/Architect`, and this `/Status` skill over the course of the session. Then enhanced `/PO` twice: first with a Competitive Landscape capability (named competitors, gap-filtering rule) — researching it surfaced the silent-video P0 and the unbuilt brand-brief-memory P1 — then with a build-vs-buy methodology (free/open-source checked first, then cost-vs-features, applied with real `WebSearch` pricing rather than remembered numbers). Used that methodology immediately on the pending TTS decision: ruled out self-hosted open-source (Piper is free but robotic; better-quality options need GPU hosting that isn't free once ops is counted) in favor of a paid API (Google Cloud TTS/Polly Neural), since the cost is negligible against existing Kling spend. No code shipped this session's final rounds — research, decisions, and backlog updates only.

**Next action, if no other instruction is given**: implement the TTS integration for the silent-video P0 — wire Google Cloud TTS or Amazon Polly Neural's output into `stitch/route.ts`'s ffmpeg call (`a=0` → `a=1`), time-aligned via the existing `subtitles`/`lipSyncMap` data.
