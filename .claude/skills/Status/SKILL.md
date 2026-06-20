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

- `/PO` — product vision, prioritized backlog (P0/P1/P2), the source of truth for "what's broken and how much does it matter."
- `/QA` — test plans, exploratory/regression findings, verification log of what's actually been proven to work (not just typechecked).
- `/UX` — design system, usability findings, flow critiques.
- `/Architect` — system design, architecture debt, the place security/scalability findings from health checks live.

All four cross-reference each other and should already reflect current reality as of their own "last updated" content — this file is a layer above them: the narrative of *what just happened* and *what's next*, not a duplicate of their detailed backlogs.

## Current state (as of 2026-06-20)

**In production right now**: commit `8174845` (the last one actually deployed and confirmed `READY` on Vercel). One commit ahead of that locally and **not yet pushed**: `13cb933` (skill/docs-only, no app code — low risk to push whenever).

**What's live and working**:
- Server-side usage enforcement + job ownership (`cbac24a`) — verified end-to-end live, including a same-day production outage in `reserve_usage()` that was caught and fixed at the DB layer (see `/PO` Resolved).
- `safeJSON` brace-matching fixed to be string-aware (`6849c80`) — verified, zero recurrences in an 8-call live sample.
- Script panel renders `**label**` markdown as bold instead of literal asterisks (`8174845`) — verified via real browser DOM inspection.

**What's broken right now, in priority order** (full detail in `/PO`):
1. **P0 — `educational`/`short_film`/`custom` content types fail ~100% of the time.** `generateVideoMetadata` (`src/lib/agents.ts:355-378`) hits the default 4096-token `maxOutputTokens` ceiling on longer scripts' `lipSyncMap`, truncating the response to nothing parseable. `advertisement` (shorter scripts) is fine. **This is the single highest-leverage open item** — one-line fix (raise `maxOutputTokens` for that call), found via `/QA`, not yet fixed. User has not yet said go-ahead on this fix as of the last turn.
2. **P0 — no privacy policy / terms of service page.** Blocks Stripe live-mode activation. Not started.
3. **P1 — markdown fix is incomplete.** Storyboard caption overlay (`page.tsx:269`) reads the same raw script string independently and still shows literal `**`. Not started.
4. **P1 — quota not refunded on failed generation.** Defense-in-depth gap; rarer now but still live because of finding #1 above. Not started.
5. **P1 — no video history/gallery UI.** Data layer supports it (`owner_key` scoping exists); no UI. Not started.
6. Various P2 polish items — see `/PO`.

## Last session

**2026-06-20**: Built server-side usage enforcement + job ownership from scratch (`cbac24a`), caught and fixed a same-day production outage in the new DB function (`/Architect`'s health check), hardened that function against unnecessary PUBLIC exposure, ran a `/QA` exploratory pass that found and fixed two real bugs (`safeJSON` truncation bug, markdown rendering), then a second `/QA` pass that found two *more* pre-existing bugs while validating the fixes (the `generateVideoMetadata` truncation bug above, and the incomplete markdown fix above). Created the `/PO`, `/QA`, `/UX`, `/Architect`, and this `/Status` skill over the course of the session. Ended mid-conversation waiting on user go-ahead to fix the `generateVideoMetadata` truncation bug.

**Next action, if no other instruction is given**: fix the `generateVideoMetadata` `maxOutputTokens` truncation bug (P0 #1 above) — it's a one-line change with the highest leverage of anything currently open.
