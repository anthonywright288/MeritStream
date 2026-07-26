# MeritStream

> GitHub signals in, weighted USDC splits out, one automated settlement on Arc.

A payout agent that turns contribution into compensation. Connect a public
GitHub repo, register members with their wallets, fund a pool in USDC. Each
cycle the agent counts real work (commits + merged PRs per member), computes
weighted shares with a deterministic formula (zero LLM), and pays every member
in USDC on Arc Testnet — every payout links back to the exact commits that
earned it.

**Live:** https://meritstream-six.vercel.app

## How it works

- Signals: `commits` (1 pt) and `merged PRs` (3 pts) per member, weights
  configurable. Public GitHub REST, no OAuth.
- Split: `amount_i = floor(distributable * points_i / totalPoints)` in USDC
  base units (bigint end-to-end); `distributable = pool − 1 USDC gas buffer`;
  rounding dust stays in the pool.
- Settlement: Vercel Cron (daily) or the admin "Settle now" button. The engine
  freezes an immutable signal snapshot, then pays sequentially with per-payout
  resume safety (a crash can never double-pay).
- Gas on Arc is USDC itself (~0.0018 USDC per transfer, measured) — one asset
  for pool, payouts, and fees.

## Pages

| Route | What |
|-------|------|
| `/create` | Create a team (repo, members, weights, cycle). Shows the pool address + one-time admin token |
| `/team/[id]` | Live dashboard: points, projected shares, pool balance, Settle now |
| `/team/[id]/history` | Audit trail: frozen snapshots, per-member tx hashes on Arc explorer |
| `/t/[teamId]` | Public read-only transparency view — share it with contributors |

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Env (`.env.local`): Arc RPC/chain/USDC constants (defaults work),
`POOL_WALLET_MNEMONIC` (HD wallet — one mnemonic derives every team's pool),
`GITHUB_TOKEN` (rate limit 60→5000/h), `CRON_SECRET`, Supabase URL + keys.
Apply `db/schema.sql` then `db/migrations/*.sql` in the Supabase SQL editor.

Tests: `npm test` (40 vitest — money math, resume safety, window rules).

## Deploying

The Vercel project is **CLI-linked, NOT git-connected** (repo and Vercel live
on different accounts, so git auto-deploy is unavailable). Pushing to GitHub
does **not** deploy. To ship:

```bash
npx vercel deploy --prod --yes
```

Env vars live in Vercel project settings (beware: values must be BOM-free and
newline-free — see `plans/PHASE3-AUDIT.md` for the incident). Cron is
registered from `vercel.json` (daily — Vercel Hobby maximum; on-stage timing
uses Settle now).

## Demo

Follow `docs/demo-runbook.md` — a 3-minute script including the failure path
(double-settle → 409) and required wallet balances.

## Design notes

Architecture, red-team review (12 accepted findings), and per-phase audit
evidence live in `plans/`. The PRD is `MeritStream-PRD-EN.md`.
