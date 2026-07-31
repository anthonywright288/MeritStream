# PHASE 4 AUDIT: Public Page, Polish, Demo, Final Redeploy

Date: 2026-07-26 | Phase file: `plans/260724-1157-meritstream-v1/phase-04-public-page-polish-deploy.md`
Production: **https://meritstream-six.vercel.app**

## Step 1: Deviations

1. Git-connect attempted, REFUSED by design constraint: Vercel account (lbngoc2712) lacks admin/write on `anthonywright288/MeritStream` (cross-account), error 400 "You need admin or write access". Per user decision: CLI deploy retained, documented in README "Deploying" (tồn đọng 3a resolved via fallback).
2. `state-message` shared component from plan text NOT built (YAGNI): dashboard already has loading/error/empty handling, create form has inline errors, history has empty state. No blank screens exist to fix.
3. Multicall3From stretch: NOT attempted (schedule: settlement loop works, ABI unverified). Documented abandon per phase file.
4. Second demo team = existing `v17oSNF_` renamed "Next.js Watch" (repo vercel/next.js, real members styfle/bgw), illustrates mid-cycle unsettled state; no new team needed (user constraint #4 satisfied with less).

## Step 2: Real-run evidence (production)

- `/t/[teamId]` live: `/t/75pw8g1f` + `/t/v17oSNF_` HTTP 200 unauthenticated; renders the same live signals READ-ONLY.
- Public page mutation surface: `readOnly` prop suppresses SettleNowButton render; page HTML/shell contains no "Settle now", no "admin token" strings (verified by curl grep); admin token itself lives only in sessionStorage of an admin who typed it, never served by any endpoint.
- Landing page links Create / Live demo team / Public view; README rewritten (setup, env, **Deploying** with the CLI-only warning, demo pointer); `docs/demo-runbook.md` = 3-minute script incl. deliberate failure path (double-settle → 409), minimum balances (pool ≥3 USDC, index-0 ≥5 USDC), faucet link, 3 pre-opened tabs, troubleshooting table (tồn đọng 3b resolved).
- Final redeploy: `vercel deploy --prod`, Aliased https://meritstream-six.vercel.app, 10 routes, build clean.

## Step 3: Edge cases tested

| # | Edge | Result |
|---|------|--------|
| 1 | `/t/does-not-exist` unauthenticated | 200 shell + client "Couldn't load team" error state, no crash, no redirect |
| 2 | All 8 routes incognito (no cookies) | 200 each, zero Vercel SSO redirects |
| 3 | Public page for unsettled team (`/t/v17oSNF_`) | renders live signals, no mutation controls |
| 4 | README + runbook links | 5/5 HTTP 200 (after fixing a regex artifact in the checker itself, not the docs) |
| 5 | Secret scan whole tracked tree | clean, only prose mentions of the words "private key/token" in docs |

## Step 4: Bugs found & fixed

| Bug | Fix |
|-----|-----|
| README claimed 48 tests (actual 40) | corrected before commit |
| (Phase 3 carry-over, resolved here) Vercel deploy knowledge trapped in one head | README "Deploying" section is now the durable record |

No new code bugs, Phase 4 is additive UI + docs; `readOnly` gate is the only logic added.

## Step 5: Post-fix re-run

40/40 vitest; `npm run build` clean, 10 routes incl. `ƒ /t/[teamId]`; production redeployed and all Step 2/3 checks run AFTER the final deploy.

## Step 6: Judge's-eye

Unauthenticated curl (no cookies = incognito equivalent): `/`, `/create`, `/team/75pw8g1f`, `/team/75pw8g1f/history`, `/t/75pw8g1f`, `/t/v17oSNF_`, `/t/does-not-exist`, signals API, ALL 200, no redirects.

## Step 7: Commits

Phase 4 commits + `git log`/clean status appended at commit time (this file included). v1 CLOSES with this phase: all PRD section 10 must-haves demonstrable on production.

## PRD section 10 must-have checklist

- [x] Create team with repo + members + weights (`/create`, atomic, validated)
- [x] Live signal tracking (dashboard 60s poll, cache, drawer with GitHub links)
- [x] Cron settlement with frozen snapshot (daily Vercel Cron + strict freeze)
- [x] Per-member USDC payouts with tx hashes (real Arc transfers, explorer links)
- [x] Audit trail payout → commits (history snapshot + tx + dest address)
- [x] Deployed on Vercel (public, no auth wall)

## Unresolved questions

- v2 backlog only (out of scope, from PRD/plan): Jira/Linear signals, review weights, private repos, SIWE, Multicall batch, server-side admin sessions.
- Demo-day operational: top up pool per runbook checklist; watch for the gh account flip from the other session before any push.
