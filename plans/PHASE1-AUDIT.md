# PHASE 1 AUDIT — Skeleton, HD Signer + Gas Verify, GitHub Fetchers, Points

Date: 2026-07-25 | Phase file: `plans/260724-1157-meritstream-v1/phase-01-skeleton-signer-github-fetchers-points.md`

## Step 1 — PRD deviations (all deliberate, cross-referenced in plans/PRD-ERRATA.md)

1. `payouts.tx_hash` NULLABLE (PRD: NOT NULL) — [RT-C2] row written before broadcast
2. `members.created_at` added (PRD: absent) — [RT-H3] mid-cycle join rule needs it
3. `payouts.status` pending|sending|paid|failed + `settlements.status` running|paid|no_activity|partial|insufficient_funds, default 'running' (PRD: default 'paid') — [RT-C2][RT-C3]
4. `settlements.snapshot` NULLABLE (PRD: NOT NULL) — [RT-C4] row created before strict freeze
5. Env `POOL_WALLET_MNEMONIC` replaces `POOL_WALLET_PRIVATE_KEY` — approved HD design
6. Beyond PRD/plan text: `fetch-merged-prs` uses `sort=updated` (plan said `sort=created`) — created-sort early-stop would MISS old PRs merged recently; deviation documented in errata
7. Schema hardening beyond PRD: CHECK integer weights, NOT NULL FKs, index `payouts(settlement_id)`, RLS ON all 4 tables zero policies (review finding — anon key could otherwise rewrite `members.wallet_address` = theft path)

## Step 2 — Real-run evidence

- **Gas-in-USDC CONFIRMED (the phase's gating fact):** real Arc transfer
  tx `0x856710364c8c29d869d8a2c7dc35051f12c90dc0eb90a703cc2c85aa485007b8`, status success.
  Sender 0x9CcDb4ECc1ea8BCBeC896420AC5053268883a1a2 (HD index 0, faucet-funded 20 USDC) -> 0.01 USDC to index 1.
  Sender drop 0.011849 = transfer 0.010000 + **gas 0.001849 USDC (1,849 base units)**.
  gasUsed 73,938 x effectiveGasPrice 25 gwei; native fee raw 1848450000000000 = ERC-20 delta at 18 native decimals (decimals assumption confirmed).
  **[RT-C1] headroom: 1 USDC buffer / 1,849 = ~540 transfers** >> any realistic team size. Buffer stands.
- **Tests: 16/16 pass** (`npm test`, vitest). Build clean (`npm run build`, Next 16.2.11, TS strict, 0 errors). Lint clean on app code. Coverage 100% lines+branches on `compute-shares.ts` (tester report: `plans/260724-1157-meritstream-v1/reports/tester-260724-1624-phase1-validation.md`).
- **Fetchers live-verified** vs vercel/next.js, author styfle, window 2026-06: commits 2 (SHAs b229f640, 70703e6f — match independent `gh api` check), merged PRs 2 (#94953, #93979).
- **Supabase schema applied & behaviorally verified** (project nlivauxsfybtocycdoud): 4/4 tables 200; CHECK fractional weight -> 23514; UNIQUE(team_id,cycle_end) dup -> 23505; UNIQUE(settlement_id,member_id) dup -> 23505; RLS: anon INSERT -> 42501, anon SELECT -> [] while row existed (service key sees it). Test rows cleaned (4x DELETE 204, teams []).

## Step 3 — Edge cases tested (5+)

| # | Edge case | Result |
|---|-----------|--------|
| 1 | PR merged just outside window (May window vs known June merges) | #94953/#93979 correctly ABSENT; only #94246 returned |
| 2 | Nonexistent/unlinked author (`no-such-user-xyz-999`) | 0 commits, no error (PRD unlinked-email caveat behaves as documented) |
| 3 | Unfunded derived address (HD index 5) | balance 0n; verify-script guard exits with funding instructions before any broadcast |
| 4 | Invalid ISO window (`not-a-date`) | throws `Invalid window:` — no silent 0-count, no unbounded pagination |
| 5 | Double-insert settlement + payout (idempotency backstop) | DB rejects with 23505 on both UNIQUE constraints |
| 6 | RPC rate limit (-32011 observed during dev) | `withRetry` backoff succeeded (verify script receipt-poll survived limits); deterministic errors now rethrow immediately |

## Step 4 — Bugs found & fixed (regression locked per CLAUDE.md rule 11)

| Bug (source) | Fix | Regression test |
|--------------|-----|-----------------|
| tsconfig target ES2017 broke bigint literals (build) | target ES2020 | build itself |
| Schema lacked RLS while anon key ships in bundle (review Critical) | RLS ON x4 zero policies | behavioral test step 2 (42501/[]) |
| Case-sensitive PR author compare silently zeroes a member's PRs (review High) | lowercase both sides | live check + code comment |
| Member signals unvalidated -> fractional/negative could corrupt settlement (review Med) | integer>=0 guard in computeShares | 2 tests (`rejects fractional/negative member signals`) |
| Closed-interval window could double-count boundary merge (review Med) | half-open [since, until) | May-window live test |
| Invalid ISO -> NaN -> silent 0 + unbounded pagination (review Med) | throw on invalid window | test in step 3 + live check |
| withRetry retried permanent errors (review Med) | `isTransientRpcError` default filter | code path (deterministic errors rethrow) |
| No fetch timeout (review Low) | AbortSignal.timeout(15s) | code |
| shadcn CLI in runtime deps (review Low) | moved to devDependencies | package.json |

Plus 5 property tests added by tester (huge pool, 100-member skew, zero pool, dust bound): invariant `sum(amounts)+dust == pool` holds in all.

## Step 5 — Post-fix re-run

`npm test` 16/16 green + `npm run build` clean AFTER all fixes (final run 2026-07-24 16:26, re-verified with commit state below).

## Step 6/7 — Commits (explicit paths, no `git add -A`)

```
08dde31 docs: add v1 plan with red-team review, phase 1 audit, and errata
1e574b2 feat: add Supabase schema with RT constraints, RLS, and clients
628c5a3 feat: add GitHub signal fetchers and points formula with tests
35c80ab feat: add Arc chain client, HD pool wallet derivation, and gas verify script
3173092 feat: scaffold Next.js 16 skeleton with Tailwind v4 and shadcn
6ef856e docs: add MeritStream PRD and plan templates
cad5967 feat: add claude workspace config and workflow rules
```
`git status`: nothing to commit, working tree clean. Secret scan pre-commit: clean
(.env.local untracked, only variable-name references in docs). Push to origin pending user OK.
(This audit file's own commit hash follows it — the log above was captured at commit time.)

## Unresolved questions

- None blocking. Carry to Phase 2: create-team flow consumes fetchers/wallet/schema; faucet cadence 20 USDC/2h per address noted for demo funding (need ~2-3 claims for a 50+ USDC demo pool, or Circle Discord request).
