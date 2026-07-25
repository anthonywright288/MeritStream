# PRD Errata

Deliberate, user-approved deviations from `MeritStream-PRD-EN.md`. External-fact
conflicts (per PRD CONFLICT PROTOCOL) would also land here — none found so far:
all PRD external facts verified correct on 2026-07-24 (chain 5042002, RPC, USDC
address/decimals, Multicall3From bytecode, GitHub endpoints, npm packages).

## Schema deviations from PRD section 6b (red-team driven, approved 2026-07-24)

| # | PRD 6b says | Implemented as | Why |
|---|-------------|----------------|-----|
| 1 | `payouts.tx_hash TEXT NOT NULL` | NULLABLE | [RT-C2] payout row is written BEFORE broadcast (status 'sending' flow prevents double-pay); hash is null until broadcast |
| 2 | `members` has no timestamp | `created_at TIMESTAMPTZ DEFAULT NOW()` added | [RT-H3] PRD edge rule "mid-cycle join accrues from the moment added" is unenforceable without the join timestamp |
| 3 | `payouts.status` absent; statuses implied paid-only | `pending\|sending\|paid\|failed` + `settlements.status` `running\|paid\|no_activity\|partial\|insufficient_funds` (default 'running', not PRD's 'paid') | [RT-C2][RT-C3] resume-safety + run-claim; status is earned, never assumed |
| 4 | `settlements.snapshot JSONB NOT NULL` | NULLABLE | [RT-C4] settlement row is created+claimed before the strict freeze writes the snapshot |
| 5 | (env) `POOL_WALLET_PRIVATE_KEY` | `POOL_WALLET_MNEMONIC` | approved design: HD-derived per-team pool wallets (brainstorm decision #1) |

Evidence: `db/schema.sql` comments carry the same [RT-*] markers; red-team session
table in `plans/260724-1157-meritstream-v1/plan.md`.

## Implementation deviations from plan text (not PRD)

| # | Plan said | Implemented as | Why |
|---|-----------|----------------|-----|
| 1 | `fetch-merged-prs` paginate `sort=created`, early-stop on `created_at < since` | `sort=updated`, early-stop when whole page `updated_at < since` | sort=created early-stop would MISS old PRs merged recently (merged_at updates updated_at, so the updated-desc stop is safe) |

## Resolved external facts

- **Gas-in-USDC: CONFIRMED 2026-07-25** by real tx
  `0x856710364c8c29d869d8a2c7dc35051f12c90dc0eb90a703cc2c85aa485007b8`
  (status success). Measured: 1,849 base units = 0.001849 USDC per transfer
  (gasUsed 73,938 x 25 gwei; native decimals 18 confirmed — native fee raw
  1848450000000000 / 1e18 matches the ERC-20 delta). 1 USDC buffer covers
  ~540 transfers. No errata needed — PRD assumption stands.
