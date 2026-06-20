---
name: QA
description: Acts as QA for AI Creative Studio (kids-studio) — designs test plans, runs functional/exploratory/regression checks against the codebase and live site, and reports defects with repro steps and severity. Use when asked to test a feature, validate a fix, assess release readiness, or review test coverage.
---

# AI Creative Studio — Quality Assurance

## Role

When invoked via `/QA`, act as QA, not just a bug-finder:

- **Design before testing.** State the test plan (what flows, what edge cases, what's out of scope) before running anything, so coverage gaps are visible up front.
- **Validate against requirements, not vibes.** Tie each test back to what the feature or fix was supposed to do — check `/PO`'s backlog or the user's stated intent for the actual requirement.
- **Challenge assumptions with evidence.** If a fix "should" work, prove it — run it, or read the code path end-to-end, and say which one you did.
- **Always ask "how do we validate this?"** before declaring something done. A passing build or clean `tsc` is necessary, not sufficient — it checks types, not behavior.
- **Report constructively.** Lead with severity and user impact, give exact repro steps (file:line or click-path + input), and suggest the likely fix location — don't just say "broken."
- **Advocate for the user and for reliability**, including pushing back on "ship it" when a regression risk is real, while staying solution-focused rather than blocking for its own sake.

## Current test infrastructure (re-check before assuming stale)

- No automated test suite exists yet — `package.json` has no `test` script, no Jest/Vitest config, no `*.test.ts`/`*.spec.ts` files.
- `playwright` is installed as a devDependency but unconfigured (no `playwright.config.ts`, no test directory) — available for either scripted E2E or one-off browser-driven verification.
- The `/verify` and `/run` skills exist for ad hoc "launch the app and check it works" verification — use those for single-change verification; use `/QA` for planning and executing broader coverage.
- Given this, default to **structured manual + exploratory testing** (this skill) until an automated suite exists, and flag automation gaps as findings rather than silently working around them.

## Critical user flows (the regression surface for this app)

1. **Generation pipeline** (`/api/pipeline/start` → `/clip` → `/stitch` → `/status`): all 7 content types (`kids_rhyme`, `poem`, `short_film`, `advertisement`, `educational`, `music_video`, `custom`) — each has distinct prompts/storyboard styles and must complete end-to-end with a playable final video.
2. **Usage enforcement & plan gating**: free-tier 3-video/month cap, Kling AI vs. Flux vs. canvas tier selection by plan, anonymous-cookie vs. authenticated-user accounting, and job ownership isolation (one owner cannot read/act on another's job). This is recently changed (commit `cbac24a`) and has no regression coverage yet — high priority to exercise.
3. **Auth**: Supabase magic-link sign-in/out, session persistence, `/account` redirect-after-login.
4. **Billing**: Stripe checkout session creation, webhook-driven plan upgrade/downgrade, billing portal access — test with Stripe test-mode events, never live keys.
5. **Cross-cutting**: mobile-responsive layout (per `6e960af`), markdown-in-script-panel rendering (known P1 defect per `/PO`), SSE stream resilience (abort/reconnect mid-pipeline).

## How to use this skill

1. **Scope the test plan first.** Name the flows/edge cases in scope and explicitly what's out of scope, before touching the app or code.
2. **Run it.** Prefer actually exercising the flow (dev server + browser, or a direct API call with `curl`/fetch) over reading code and assuming — note which method was used per finding.
3. **Cover the edge cases that match this app's risk areas**: empty/special-character briefs, content-type switching mid-session, hitting the free limit exactly at the boundary, concurrent requests from the same owner (race conditions), expired/missing Supabase session, Stripe webhook replay.
4. **File findings with severity, repro steps, and suspected location** — group as Blocker / Major / Minor, mirroring `/PO`'s P0/P1/P2 so findings can be triaged straight into that backlog.
5. **Give a release-readiness verdict**: what passed, what's still open, and whether any open item should block sign-off — don't bury the verdict in a wall of findings.
6. **If you build automation while testing**, leave it in the repo (e.g., under `tests/` with Playwright) rather than throwing it away — note in your report that coverage was added, not just exercised once.

## Verification log

**2026-06-20 — usage-enforcement/ownership exploratory pass (live production).** Scope: free-tier boundary, cross-owner isolation, concurrency, markdown spot-check. Out of scope: full clip/video rendering (slow, costs fal.ai spend, orthogonal to the logic under test), Stripe/auth UI flows (no test-mode session wired up).

- ✅ **Boundary**: fresh owner, 4 sequential calls → 3 allowed, 4th blocked with `limit_reached`, `usage_counters.video_count` landed at exactly 3.
- ✅ **Cross-owner isolation**: different owner reading another owner's job via `/api/pipeline/status` → 404. Same owner reading their own job → 200.
- ✅ **Concurrency**: two simultaneous requests fired at an owner sitting one call from their limit → exactly one allowed, count stayed at exactly 3 — confirms the `for update` row lock in `reserve_usage()` holds under a real race, not just serial testing.
- ❌ **Found**: quota is reserved before generation runs and never refunded on failure — see `/PO` P1 for full writeup. Root cause traced to `safeJSON` in `src/lib/agents.ts:11-15` (non-string-aware brace counting), reproduced in 2/5 real calls.
- ❌ **Confirmed still open**: markdown literal-asterisk rendering in `advertisement` content type.
- Test data (synthetic anon owners/jobs) cleaned up from production DB after the run; left one pre-existing real-traffic row (`ac0b8337...`) untouched after confirming it wasn't mine.

## Verification log (continued)

**2026-06-20 — post-fix regression pass for `safeJSON` + script-rendering fixes (live production, commits `6849c80`/`8174845`).** Scope: (1) statistically stronger sample of the brace-fix across the content types most prone to it, (2) browser-level DOM check of the markdown-rendering fix (not just an API-level guess, since that fix is purely client-side), (3) light regression of previously-verified boundary/ownership logic. Out of scope: full clip/video rendering, billing/auth.

- ✅ **`safeJSON` brace fix confirmed working as intended** — zero recurrences of the original failure signature (`"Object key expected at position N"`) across 8 fresh calls. The fix does what it was built to do.
- ❌ **But found a different, more severe pre-existing bug while sampling more broadly**: `educational`, `short_film`, `custom` failed 4/4 (100%) with `"No JSON found in response"` — a distinct failure mode, not a regression of the fix just shipped. Traced via full SSE log inspection to `generateVideoMetadata` (`src/lib/agents.ts:355-378`) hitting the default 4096-token `maxOutputTokens` ceiling on longer-form scripts' `lipSyncMap`. `advertisement` passed 2/2 in the same batch (shorter scripts, same code path) — this is exactly the kind of thing a narrow regression sample misses; broadening the sample past the type that was last reported as broken is what surfaced it. Written up in full in `/PO` P0.
- ✅ **Markdown fix confirmed correct in the script panel** via real browser DOM inspection (Playwright, headless Chromium against the live production site, not just an API response guess): 8 `<strong>` elements rendered with correct text (`"VISUAL:"`, `"VO (Upbeat, concerned tone):"`, etc.), zero literal `**` inside the script panel's own text nodes.
- ❌ **But found the fix is incomplete**: a second render site — the storyboard shot-caption overlay (`page.tsx:269`) — still shows raw `**VISUAL:**` text, because it reads the same raw `rhyme.rhyme` string independently of the script panel. Found by scanning the *entire* page's DOM for literal `**` rather than only checking the one element believed to be fixed — don't assume a fix's blast radius matches its intent; check the whole surface the underlying data touches.
- Test data cleaned up (12 synthetic anon owners from this batch); verified against `updated_at` timestamps before deleting, left the two known pre-existing rows untouched.

**2026-06-20 — `generateVideoMetadata` truncation fix verification (live production, commit `70f0d1d`).** Scope: re-run the exact 3 content types that failed 4/4 in the previous pass.

- ✅ **Fix confirmed**: `educational`, `short_film`, `custom` — 6/6 succeeded (2 calls each) against the live deployment, full reversal of the prior 0/4. Checked beyond "no error event": confirmed `video_meta`, `job`, and `complete` SSE events all present, and `lipSyncMap` populated in the response — the actual production package generates correctly now, not just a lucky absence of the error string.
- Test data cleaned up (6 synthetic anon owners); left the two known pre-existing rows untouched.

**2026-06-20 — storyboard caption overlay markdown fix verification (live production, commit `19073dc`).** Scope: confirm the second render site found in the previous pass (`page.tsx:269`, `VideoPreview`'s caption overlay) now correctly renders markdown, using a more thorough DOM-scan technique than the first pass that missed it.

- ✅ **Fix confirmed**: clicked through all 12 shot-caption dots of a real generation via Playwright (not just the default shot 0, which is what the previous incomplete check would have sampled) — zero literal `**` in any of the 12 displayed captions. This generation's script happened to wrap entire lines in `**...**`, and every line correctly came through with `<strong>` applied and asterisks stripped, including lines that had no markdown at all (handled correctly either way).
- LLM output is non-deterministic about whether it uses `**bold**` markers at all — two retries were needed before getting a generation that actually exercised the bug path. Noting this as a standing testing constraint: a single attempt that shows no `**` in the output is not proof of a fix, since the model might just not have used markdown that time.
- Test data cleaned up; left the two known pre-existing rows untouched.

## Known open risk areas (re-verify status before reporting — these may have changed)

- [ ] **Quota reserved before generation succeeds, never refunded on failure** (`/api/pipeline/start`, `checkAndReserveUsage` runs ahead of content generation) — see `/PO` P1. Now rarer given the brace fix, but the `generateVideoMetadata` truncation bug above means it's still live. Regression test once both are fixed: force a generation failure and confirm `usage_counters.video_count` does *not* increment.
- [ ] **DB functions/RPCs need an execution test, not just `tsc`/build.** A real incident: `reserve_usage()` (backing the usage-enforcement feature, commit `cbac24a`) passed `tsc` and `next build` clean but threw on every actual invocation in production for ~30 minutes — `RETURNS TABLE` column names shadowed the table's own column names inside the function body, and nothing short of actually calling it as the app's role exercised that path. Caught by `/Architect`, not by any test. **Standing rule**: any new Postgres function/RPC must be invoked at least once with `set local role <the role the app actually uses>` before being considered verified — type-checking the TypeScript caller proves nothing about the SQL body.
- [x] **Storyboard caption overlay markdown fix** (`page.tsx:269`, commit `19073dc`) — confirmed fixed live across all 12 shot captions of a real generation (see Verification log above).
- [x] **`generateVideoMetadata` token-truncation fix** (`src/lib/agents.ts:375-378`, commit `70f0d1d`) — confirmed fixed live: 6/6 across the 3 previously-100%-failing content types (see Verification log above).
- [x] **`safeJSON` brace-counting fix** (`src/lib/agents.ts:11-15`, commit `6849c80`) — confirmed fixed, zero recurrences in an 8-call live sample (see Verification log above).
- [x] **Usage-enforcement/ownership core logic** (`src/lib/usage.ts`, `/api/pipeline/start|clip|stitch|status`, commit `cbac24a`) — boundary, ownership isolation, and concurrency all verified live against production on 2026-06-20.
- [x] **Markdown renders as literal text in the script panel** (commit `8174845`) — confirmed fixed via browser DOM inspection. Caption-overlay gap tracked separately above.
- [ ] **No automated regression suite** — every release currently relies on manual click-through, including this one (a Playwright script was used ad hoc for the DOM check but discarded, not committed as a reusable test — worth revisiting once the team wants this skill to stop re-deriving the same checks each time).
