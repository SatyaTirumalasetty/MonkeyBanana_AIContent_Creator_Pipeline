---
name: PO
description: Product-owner priority list for AI Creative Studio (kids-studio). Use when asked to review product strategy, prioritize fixes, audit the product end-to-end, or decide "what's next" for the platform.
---

# AI Creative Studio — Product Owner Priority List

This is the live priority backlog from the most recent end-to-end product audit (2026-06-20). When invoked via `/PO`, re-check the current state of each item against the codebase and the live production site (`https://kids-studio-beta.vercel.app`) before reporting — items may have been fixed since this file was last updated. Update this file's checkboxes/status as items get resolved.

## How to use this skill
1. Re-verify each open item's status (grep the relevant code, or hit the live site) rather than assuming the list is still accurate.
2. Report status grouped by priority tier, noting any items that have been resolved or have changed.
3. Recommend the single next action — don't let the user diffuse focus across multiple P0s at once.
4. After meaningful work, update this file (mark done, add newly discovered issues, re-prioritize) so the next `/PO` invocation reflects reality.

## P0 — Blockers (revenue capture / compliance)

- [ ] **No server-side plan/usage enforcement.** None of `/api/pipeline/start`, `/clip`, `/stitch` check auth, plan, or usage. The "3 free videos/month" counter is `localStorage`-only (trivially bypassed) and never disables the Generate button even when "limit reached" is displayed. Paying Creator/Studio/Cinema customers get *identical* backend behavior to anonymous free users — no code path reads `profiles.plan` during generation. This means: (a) zero cost control against abuse, (b) the $19.99–$149 tiers don't currently unlock anything, so there's no functioning reason to pay.
  - Fix: add a server-side usage table (Supabase) keyed to user id (or IP for anonymous), check it + `profiles.plan` at the top of `/api/pipeline/start`, reject or downgrade quality when over limit.
- [ ] **No privacy policy or terms of service page.** `/privacy` and `/terms` both 404. The pricing FAQ claims "your content is private" with no policy backing it. This will likely block Stripe's live-mode account activation review (Stripe requires a visible privacy/ToS link for businesses taking payment).

## P1 — Fix soon (quality / retention)

- [ ] **Markdown rendered as raw text in generated scripts.** The script panel (`src/app/page.tsx`, `whitespace-pre-wrap` div) does not parse markdown. Content types `advertisement`, `educational`, `short_film`, and `custom` produce LLM output with `**Visuals:**` / `**Voiceover:**` style headers, which render as literal asterisks. Only `kids_rhyme`/`poem` look clean today — that's 5 of 7 content types affected.
  - Fix: render with a lightweight markdown parser, or instruct the content-generation prompts to avoid markdown formatting.
- [ ] **No video history / gallery.** Generated video state lives in a single `localStorage` slot (`ai_studio_result_v2`) that's overwritten by the next generation. Once a user generates a new video, all prior ones become inaccessible from the UI (though the files remain orphaned in Vercel Blob). Paying for "Team workspace" implies persistent shared work, which doesn't exist.
  - Fix: persist job history per user_id in Supabase, add a `/videos` or "My Videos" view.

## P2 — Polish (worth doing, not urgent)

- [ ] **No Open Graph / Twitter Card / favicon.** Checked page `<head>` directly — no `og:title`, `og:image`, or favicon tags. Ironic for a product whose purpose is making shareable social content; sharing the studio's own link shows a blank/unbranded preview, costing free distribution.
- [ ] **"Pipeline complete!" banner fires before the video actually finishes rendering.** The `complete` flag is set when the SSE `complete` event arrives (script/storyboard/captions ready), which happens *before* `renderVideo()` finishes stitching clips. A user can see "Ready to post" while the video panel still shows "Rendering clip 6/12."
- [ ] **No upfront wait-time framing.** First-time users get no expectation-setting (e.g., "this takes about 90 seconds") before starting generation — just a progress bar with no context.

## Resolved (for reference — do not re-flag)

- [x] Stitch race condition causing "Job not found" / video generation silently failing (fixed 2026-06-20: job state moved from Vercel Blob `list()` to Supabase Postgres — see commit `c3cc797`).
- [x] Rainbow gradient kids-style branding replaced with professional Inter/Outfit + indigo design system, mobile-first responsive layout (commit `6e960af`).
- [x] Supabase auth (magic link) + Stripe subscriptions (checkout, webhook, billing portal) wired end-to-end and verified (commits `fad4605`, `d85913c`).
