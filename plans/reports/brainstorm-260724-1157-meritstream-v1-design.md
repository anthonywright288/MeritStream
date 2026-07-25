# Brainstorm Report: MeritStream v1 Design

Date: 2026-07-24 | PRD: `MeritStream-PRD-EN.md` (root) | Status: APPROVED by user

## Problem statement

Payout agent: GitHub signals (commits + merged PRs) -> weighted USDC splits -> batch settlement on Arc Testnet. Hackathon, ~4 days. PRD solid on scope/signals/edge-rules but left 4 architecture decisions open. Brainstorm resolved them.

## Pre-work: external facts verified (all real calls, 2026-07-24)

- Chain ID 5042002 = `eth_chainId` 0x4cef52 on `https://rpc.testnet.arc.network` MATCH
- USDC `0x3600...0000`: bytecode exists, `decimals()`=6, `symbol()`="USDC" MATCH
- Multicall3From `0x522f...47D0`: bytecode exists (ABI unverified, stretch-only) MATCH
- GitHub `commits?author&since&until` + `pulls?state=closed` (user.login, merged_at): structure confirmed via `gh api` on vercel/next.js MATCH
- npm: next@16.2.11, viem@2.55.8, @supabase/supabase-js@2.110.8, tailwindcss@4.3.3, shadcn@4.14.1 all exist
- No PRD-ERRATA needed.

## Decisions (4 questions, all resolved with user)

| # | Question | Decision | Rejected alternatives |
|---|----------|----------|----------------------|
| 1 | Pool wallet model (PRD: 1 private key, but multi-team) | **HD-derived per team**: `POOL_WALLET_MNEMONIC` env, derive by `teams.wallet_index` (viem HD). Per-team fund address + QR, no commingling, 1 secret | Single global wallet (DB-tracked balances, drift risk); per-team keys in DB (security risk) |
| 2 | Settlement trigger (PRD: cron only, demo needs live trigger) | **Cron + "Settle now" button** (admin), both call same settlement engine | Cron-only (fragile on stage); +15-min demo cycle (extra branch, unneeded) |
| 3 | Auth (PRD: none) | **Admin secret per team**: token generated at create, shown once, SHA-256 hash in DB, required for mutations (edit team, settle) | No auth (wallet-swap theft risk); SIWE (half-day cost, overkill) |
| 4 | Dashboard liveness | **Polling 60s + manual refresh** | Load-only (less wow); SSE/websocket (over-engineered on serverless) |

## Architecture (final)

```
Next.js App Router on Vercel
  pages: /create, /team/[id], /team/[id]/history, /t/[teamId] (public read-only)
  api:   POST /api/teams
         GET  /api/teams/[id]/signals      (polled 60s)
         POST /api/agent/run               (Vercel Cron daily, CRON_SECRET, all due teams)
         POST /api/teams/[id]/settle       (admin token, force flag, same engine)
  lib (kebab-case, <200 LOC each):
         github/fetch-commits.ts, github/fetch-merged-prs.ts
         points/compute-shares.ts          (pure fn, unit-tested Day 1)
         wallet/derive-pool-account.ts     (HD derive)
         settlement/run-settlement.ts      (snapshot -> loop transfers -> receipts, resume-safe)
         supabase/*
Supabase Postgres (PRD schema + deltas below)
```

## Schema deltas vs PRD

- `teams` + `wallet_index INT UNIQUE`, `admin_token_hash TEXT`
- `payouts` + `status TEXT DEFAULT 'pending'` (pending|paid|failed) -> resume-from-first-unpaid
- `settlements.status`: paid | no_activity | partial | insufficient_funds

## Env deltas vs PRD appendix

- `POOL_WALLET_PRIVATE_KEY` -> `POOL_WALLET_MNEMONIC`

## Kept from PRD verbatim

Points = pure function, zero LLM. Floor at 6-decimal base units, dust rolls over. Zero-activity -> skip settlement. Mid-cycle join accrues from join. Squash-merge earns both weights. 1 USDC gas buffer. Weights default commit=1 / PR=3 configurable.

## Implementation notes (from verification)

- Arc RPC rate-limits aggressively (hit at ~4 rapid reqs) -> wrap all chain calls with retry/backoff, sequential transfers awaiting receipts
- `pulls?state=closed` includes unmerged (merged_at null) + default sort=created -> must filter merged_at in cycle window + paginate
- Tailwind v4 + latest shadcn CLI -> follow current docs, not v3 patterns

## Risks

1. Testnet USDC source for demo unknown -> find Arc faucet Day 1
2. "Gas is USDC" unproven -> verify with first real tx Day 1; if false -> PRD-ERRATA
3. Payout loop mid-failure -> per-payout status + resume (designed in)

## Success criteria (unchanged from PRD)

Create team -> live signals -> cron/manual settlement -> per-member USDC tx hashes -> audit trail -> deployed on Vercel. Wow demo: live commit -> points jump -> settle -> 3 wallets paid, each linked to commits.

## Next steps

1. Implementation plan (plan mode, per Phase-Gated PRD Workflow) covering Day 1 scope
2. Day 1: skeleton, HD signer + gas-verification tx, GitHub fetchers, points formula + tests

## Unresolved questions

- Arc testnet USDC faucet location/amount (research Day 1)
- Multicall3From ABI (only if stretch goal reached)
