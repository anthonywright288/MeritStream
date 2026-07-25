---
title: "MeritStream v1 — GitHub signals to USDC payout agent on Arc"
description: "4-day hackathon build: create team, live signals, cron/manual settlement, per-member USDC payouts with audit trail, deployed on Vercel."
status: pending
priority: P1
effort: 4d
branch: master
tags: [hackathon, arc-testnet, viem, nextjs, supabase, usdc, payout-agent]
created: 2026-07-24
---

# MeritStream v1 — Implementation Plan

PRD (source of truth for scope): `MeritStream-PRD-EN.md` (root).
Design (source of truth for architecture): `plans/reports/brainstorm-260724-1157-meritstream-v1-design.md`.

Payout agent: GitHub commits + merged PRs per member -> weighted points -> USDC base-unit shares -> sequential onchain transfers from HD-derived per-team pool wallet on Arc Testnet. Zero LLM. Deterministic, auditable.

## Locked architecture (do not change)
- Stack: next@16.x (App Router), viem@2.x, @supabase/supabase-js@2.x, Tailwind v4, shadcn CLI latest, Vercel Cron, TypeScript. Tests: vitest (lib/points).
- Chain: Arc Testnet chainId 5042002, RPC `https://rpc.testnet.arc.network` (aggressive rate limits -> retry/backoff wrapper, sequential transfers awaiting receipts). USDC `0x3600000000000000000000000000000000000000` (6 decimals). Gas paid in USDC (verify Phase 1 real tx; if false -> `plans/PRD-ERRATA.md`).
- Pool wallets: HD-derived per team from `POOL_WALLET_MNEMONIC` + `teams.wallet_index` (viem `mnemonicToAccount` addressIndex). One secret, no commingling.
- Auth: admin token per team, shown once at create, SHA-256 hash in `teams.admin_token_hash`, required for mutations.
- Settlement: one shared engine, called by Vercel Cron `POST /api/agent/run` (CRON_SECRET, all due teams) and manual `POST /api/teams/[id]/settle` (admin token). Per-payout status for resume-from-first-unpaid.
- Module layout (kebab-case, <200 LOC/file): `lib/github/`, `lib/points/`, `lib/wallet/`, `lib/settlement/`, `lib/supabase/`.
- **Vercel Hobby cron = max 1 run/DAY** (verified fact from prior project — do not re-discover). Daily `0 0 * * *` only; demo timing via manual "Settle now". First production deploy at START of Phase 3 (deploy-first, fail-fast on env/timeout/cron), NOT at Phase 4.

## Phases

| # | Phase | Status | Depends on |
|---|-------|--------|-----------|
| 1 | [Skeleton, HD signer + gas verify, GitHub fetchers, points](phase-01-skeleton-signer-github-fetchers-points.md) | pending | — |
| 2 | [Create-team flow + dashboard (live signals)](phase-02-create-team-flow-and-dashboard.md) | pending | Phase 1 |
| 3 | [DEPLOY-FIRST + settlement engine + cron + history](phase-03-settlement-engine-cron-and-history.md) | pending | Phase 1, 2 |
| 4 | [Public page, polish, final redeploy, demo](phase-04-public-page-polish-deploy.md) | pending | Phase 1-3 |

## Key cross-phase dependencies
- Phase 2 needs Phase 1 lib (`lib/github/*`, `lib/points/compute-shares.ts`, `lib/wallet/derive-pool-account.ts`, `lib/supabase/*`) and DB schema applied.
- Phase 3 settlement engine reuses Phase 1 fetchers + points + wallet derivation, writes `settlements`/`payouts`; Phase 2 dashboard reads them.
- FIRST production deploy = Phase 3 step 0 (before engine work; cron only runs for real on production). Phase 4 = final redeploy + demo only.
- Gas-in-USDC assumption (Phase 1) gates the entire payout mechanism. Verify FIRST.

## Phase-gate protocol (per CLAUDE.md)
Each phase ends with AUDIT GATE -> write `plans/PHASE{N}-AUDIT.md` with real run evidence, commit with explicit paths, then STOP for user approval before next phase. Never start a phase without explicit approval.

## Unresolved (resolve during Phase 1)
- Arc testnet USDC faucet location/amount.
- Gas-in-USDC confirmation via first real tx.

## Red Team Review

### Session — 2026-07-24
**Findings:** 12 deduped from 28 raw (3 hostile reviewers) (12 accepted, 0 rejected)
**Severity breakdown:** 5 Critical, 5 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|-----------|
| C1 | Buffer double-count -> all settlements insufficient_funds | Critical | Accept | Phase 1, 3 |
| C2 | Double-pay: write-after-transfer + retry-on-broadcast | Critical | Accept | Phase 1, 3 |
| C3 | No UNIQUE constraints behind idempotency claim | Critical | Accept | Phase 1, 3 |
| C4 | Resume re-freezes snapshot, drifts amounts | Critical | Accept | Phase 3 |
| C5 | GitHub fetch error during freeze zeroes members | Critical | Accept | Phase 2, 3 |
| H1 | insufficient_funds/crashed settlements = cron dead-end | High | Accept | Phase 3 |
| H2 | Force-settle window semantics undefined | High | Accept | Phase 3 |
| H3 | members.created_at missing; memberSince unwired | High | Accept | Phase 1, 2 |
| H4 | Snapshot-vs-live wallet contradiction; localStorage token | High | Accept | Phase 2, 3 |
| H5 | No derived-address vs pool_address assertion | High | Accept | Phase 3 |
| M1 | Fractional/negative weights break bigint math | Medium | Accept | Phase 1, 2 |
| M2 | Create-team multi-write not atomic | Medium | Accept | Phase 2 |
