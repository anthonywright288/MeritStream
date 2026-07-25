# Phase 1 — Skeleton, HD Signer + Gas Verify, GitHub Fetchers, Points Formula

## Context Links
- PRD: `MeritStream-PRD-EN.md` sections 2, 3, 6, 8 (Day 1), appendix env.
- Design: `plans/reports/brainstorm-260724-1157-meritstream-v1-design.md` (verified facts, module layout, rate-limit notes).
- Overview: `plan.md`.

## Overview
- **Priority:** P1 (blocks everything).
- **Status:** pending.
- **Description:** Stand up the Next.js App Router project, DB schema, chain client with retry/backoff, HD pool-wallet derivation, and a REAL verification transfer proving gas is paid in USDC. Build the two GitHub fetchers and the pure points/shares function with vitest unit tests. No UI beyond a placeholder home page.

## Key Insights
- Arc RPC rate-limits aggressively (~4 rapid reqs). Every chain read/write MUST go through one retry/backoff wrapper. Transfers are sequential, each awaiting its receipt.
- `pulls?state=closed` INCLUDES unmerged PRs (`merged_at: null`) and defaults to `sort=created`. Must filter `merged_at != null` AND `merged_at` within cycle window, and paginate (per_page=100, follow until short page).
- `commits?author=&since=&until=` returns commits by GitHub-linked email; unlinked-email commits are invisible (PRD caveat — surface to users later).
- Gas-in-USDC is an assumption. If the verification tx shows a native-token gas deduction / fails for missing native balance -> STOP, write `plans/PRD-ERRATA.md`, do not work around.
- Tailwind v4 uses CSS-first config (`@import "tailwindcss"` + `@theme`), NOT `tailwind.config.js` v3 patterns. shadcn CLI latest targets v4.
- USDC is 6 decimals: 1 USDC = `1_000_000` base units. All money math in base units (bigint), never floats.

## Requirements
### Functional
- FR1: `pnpm dev` (or npm) boots a Next.js App Router app with a placeholder `/` page.
- FR2: Supabase schema applied = PRD 6b + deltas:
  - `teams.wallet_index INT UNIQUE`, `teams.admin_token_hash TEXT`.
  - `[RT-C2]` `payouts.status TEXT DEFAULT 'pending'` allows `pending|sending|paid|failed` (was `pending|paid|failed`; `sending` = broadcast issued, receipt not yet confirmed).
  - `[RT-C2]` `payouts.tx_hash TEXT NULLABLE` — **deliberate deviation from PRD 6b (NOT NULL)**. Reason: a payout row is written BEFORE its transfer is broadcast, so tx_hash is null until broadcast. Record in `plans/PRD-ERRATA.md`.
  - `[RT-H4]` `payouts.dest_address TEXT` — the ACTUAL destination address the transfer paid (recorded at send time from the CURRENT member wallet). It is the real audit trail and may differ from the frozen snapshot wallet if the member's wallet was edited between freeze and pay.
  - `[RT-C3]` `settlements.status` allows `running|paid|no_activity|partial|insufficient_funds` (added `running` = a run has claimed this settlement and is mid-flight).
  - `[RT-C3]` `UNIQUE(team_id, cycle_end)` on `settlements` — backs idempotent settlement create.
  - `[RT-C3]` `UNIQUE(settlement_id, member_id)` on `payouts` — backs idempotent payout upsert (one payout per member per settlement).
  - `[RT-H3]` `members.created_at TIMESTAMPTZ DEFAULT NOW()` — **deviation from PRD 6b (absent)**. Reason: mid-cycle join rule needs a per-member join timestamp; record in `plans/PRD-ERRATA.md`.
- FR3: `deriveTeamPoolAccount(index)` returns a viem account from `POOL_WALLET_MNEMONIC` at `addressIndex=index`.
- FR4: Chain client reads USDC `decimals()` (=6) and an address balance, through retry/backoff.
- FR5: A one-off script performs a REAL USDC transfer on Arc from a funded pool address, awaits receipt, prints tx hash + gas token used. Confirms gas-in-USDC.
- FR6: `fetchCommits(repo, author, since, until)` returns counted commits (array + count) with html_url + sha.
- FR7: `fetchMergedPrs(repo, author, since, until)` returns PRs where `merged_at` in window, paginated, with html_url + number.
- FR8: `computeShares(members, weights, poolBaseUnits)` pure fn -> per-member points, percentage, floored base-unit amount, dust remainder. Handles zero total points (no division by zero).
  - `[RT-C1]` **`poolBaseUnits` is the DISTRIBUTABLE amount, not the raw pool balance.** Callers (dashboard projection AND settlement freeze) MUST pass `distributable = max(0n, balanceAtFreeze - GAS_BUFFER_BASE_UNITS)`. The buffer is subtracted BEFORE shares are computed so projection == settlement and the balance gate cannot double-count the buffer (see phase-03 RT-C1). `computeShares` itself stays buffer-agnostic (pure): it only ever sees distributable.
  - `[RT-M1]` **Weight validation is the caller's responsibility, but `computeShares` must not silently corrupt on bad weights.** Weights are positive integers (validated server-side in phase-02). Points math is bigint: `points = commits*commitWeight + prs*prWeight`. Fractional/negative weights are rejected upstream; if they somehow reach the fn, behavior is covered by the test matrix.

### Non-functional
- Every file <200 LOC, kebab-case.
- All chain calls wrapped in retry/backoff. GitHub calls send optional `Authorization: Bearer ${GITHUB_TOKEN}`.
- Points fn covered by vitest with edge cases (see test matrix).

## Architecture
### Data flow
```
GitHub REST (public) --fetch--> lib/github/{fetch-commits,fetch-merged-prs}.ts
   -> {author, count, items[]}
Members + weights + pool base units --> lib/points/compute-shares.ts (pure)
   -> [{memberId, points, pct, amountBaseUnits}], dustBaseUnits
POOL_WALLET_MNEMONIC + index --> lib/wallet/derive-pool-account.ts --> viem Account
Account + viem walletClient (Arc) --> lib/wallet/transfer-usdc.ts --> txHash (Phase 3 reuses)
All RPC --> lib/wallet/rpc-retry.ts (backoff wrapper)
```
### Components
- `lib/arc/chain.ts`: viem `defineChain` for Arc (id 5042002, RPC, native currency stub), exported `publicClient`.
- `lib/wallet/rpc-retry.ts`: `withRetry(fn, {retries, baseDelayMs})` exponential backoff on rate-limit/timeout.
- `lib/wallet/derive-pool-account.ts`: `mnemonicToAccount(mnemonic, { addressIndex })`.
- `lib/wallet/usdc.ts`: USDC address const, minimal ERC-20 ABI (`decimals`, `balanceOf`, `transfer`), helpers `readUsdcBalance`, `usdcDecimals`.
- `lib/github/gh-fetch.ts`: shared fetch wrapper (headers, error handling, pagination helper).
- `lib/points/compute-shares.ts`: pure computation.
- `lib/supabase/client.ts` (browser anon) + `lib/supabase/admin.ts` (service role, server only).

## Related Code Files
### Create
- `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (Tailwind v4 `@import`).
- `.env.example` (env deltas below), `.gitignore` (ensure `.env*` except example).
- `vitest.config.ts`.
- `lib/arc/chain.ts`, `lib/wallet/rpc-retry.ts`, `lib/wallet/derive-pool-account.ts`, `lib/wallet/usdc.ts`.
- `lib/github/gh-fetch.ts`, `lib/github/fetch-commits.ts`, `lib/github/fetch-merged-prs.ts`.
- `lib/points/compute-shares.ts`, `lib/points/compute-shares.test.ts`.
- `lib/supabase/client.ts`, `lib/supabase/admin.ts`.
- `scripts/verify-gas-in-usdc.ts` (one-off real transfer), `db/schema.sql`.
### Modify
- none (fresh project).
### Delete
- none.

## Implementation Steps
1. Scaffold: `npx create-next-app@16 . --ts --app --tailwind --eslint` (or manual). Confirm Tailwind v4 (`app/globals.css` has `@import "tailwindcss";`, no v3 `tailwind.config.js` content array). Add `app/page.tsx` placeholder "MeritStream".
2. Init shadcn: `npx shadcn@latest init` (choose defaults compatible with v4). Do not add components yet.
3. Install deps: `viem@2`, `@supabase/supabase-js@2`, `vitest`, `@types/node`. Add `vitest.config.ts` and `"test": "vitest run"` script.
4. Write `.env.example` with the env deltas (below). Copy to `.env.local` locally, fill Supabase + `POOL_WALLET_MNEMONIC` (a fresh throwaway mnemonic) + optional `GITHUB_TOKEN`.
5. Create `db/schema.sql` = PRD 6b + deltas. Apply via Supabase SQL editor. Verify tables exist.
6. `lib/arc/chain.ts`: `defineChain({ id: 5042002, rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL] } }, nativeCurrency: { name:'USDC', symbol:'USDC', decimals:18 } })` — note: native decimals unknown yet; Step 9 confirms. Export a `publicClient`.
7. `lib/wallet/rpc-retry.ts`: `withRetry` — catch errors, exponential backoff (base 500ms, factor 2, max 5 tries), rethrow after exhaustion. Every RPC in codebase goes through it.
8. `lib/wallet/usdc.ts` + `lib/wallet/derive-pool-account.ts`: ERC-20 ABI subset; `readUsdcBalance(address)` via retry; `deriveTeamPoolAccount(index)` -> `mnemonicToAccount(env.POOL_WALLET_MNEMONIC, { addressIndex: index })`.
9. **Gas verification (critical):** `scripts/verify-gas-in-usdc.ts`: derive account index 0, print its address. FIND Arc testnet USDC faucet (research: Arc docs / discord / faucet URL), fund the address with test USDC. Then send a small USDC `transfer` (e.g. 0.01 to index 1), await receipt via retry. Log: tx hash, `effectiveGasPrice`, `gasUsed`, and USDC balance before/after. Confirm the fee asset is USDC. If native (non-USDC) gas is required or tx reverts for missing native balance -> STOP, write `plans/PRD-ERRATA.md` (what PRD says vs reality + evidence), report to user.
   - `[RT-C1]` **MEASURE and RECORD the actual USDC gas cost of one `transfer`** (`effectiveGasPrice * gasUsed` converted to USDC base units). The 1 USDC (`GAS_BUFFER_BASE_UNITS = 1_000_000n`) buffer doubles as the gas budget for the WHOLE settlement loop, so validate: `measuredGasPerTransfer * maxExpectedMembers <= 1_000_000n`. Record the measured per-transfer cost and the headroom in `plans/PHASE1-AUDIT.md`. If a realistic member count would exceed the 1 USDC buffer -> flag in `plans/PRD-ERRATA.md` and report (buffer size is a settlement-safety parameter, not a free choice).
10. `lib/github/gh-fetch.ts`: `ghGet(path, {token})` with `Accept: application/vnd.github+json`, optional bearer; `paginate(path)` follows `Link` header until short/empty page.
11. `lib/github/fetch-commits.ts`: `fetchCommits(repo, author, sinceISO, untilISO)` -> GET `/repos/{repo}/commits?author={author}&since={since}&until={until}&per_page=100`, paginate, map to `{sha, html_url, message}`, return `{count, items}`.
12. `lib/github/fetch-merged-prs.ts`: `fetchMergedPrs(repo, author, sinceISO, untilISO)` -> GET `/repos/{repo}/pulls?state=closed&per_page=100&sort=created&direction=desc`, paginate, FILTER `pr.merged_at != null && pr.user.login == author && merged_at in [since,until]`. Stop paginating early when `created_at < since` (older than window). Return `{count, items:[{number, html_url, merged_at}]}`.
13. `lib/points/compute-shares.ts`: input `{members:[{id, commits, prs}], commitWeight, prWeight, poolBaseUnits: bigint}`. points = commits*commitWeight + prs*prWeight. If totalPoints==0 -> return all zero amounts + `noActivity:true` + dust=poolBaseUnits. Else amount_i = floor(poolBaseUnits * points_i / totalPoints) in bigint; dust = poolBaseUnits - sum(amount_i). Return per-member `{points, pct, amountBaseUnits}` + `dustBaseUnits` + `noActivity:false`.
14. `lib/points/compute-shares.test.ts`: vitest covering the test matrix. Run `npm test`, all green.
15. `lib/supabase/client.ts` (anon, `NEXT_PUBLIC_*`) + `lib/supabase/admin.ts` (`SUPABASE_SERVICE_ROLE_KEY`, guard against client import).
16. Run `npm run build` — zero type/compile errors. Commit with explicit paths.

### Env deltas (`.env.example`)
```
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_MULTICALL3FROM=0x522fAf9A91c41c443c66765030741e4AaCe147D0
POOL_WALLET_MNEMONIC=
GITHUB_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Todo List
- [ ] Next.js 16 App Router scaffold boots, Tailwind v4 confirmed (no v3 config)
- [ ] shadcn CLI initialized
- [ ] deps installed (viem, supabase-js, vitest)
- [ ] `db/schema.sql` = PRD 6b + deltas, applied to Supabase
- [ ] `lib/arc/chain.ts` + `rpc-retry.ts` (backoff wrapper)
- [ ] `derive-pool-account.ts` + `usdc.ts` (balance read works)
- [ ] Arc USDC faucet located, index-0 address funded
- [ ] `verify-gas-in-usdc.ts` real transfer, receipt, gas-in-USDC CONFIRMED (or PRD-ERRATA written)
- [ ] `[RT-C1]` measured per-transfer USDC gas cost recorded; headroom vs 1 USDC buffer × max members validated
- [ ] `fetch-commits.ts` returns real counts against a known repo
- [ ] `fetch-merged-prs.ts` filters merged_at + author + window, paginates
- [ ] `compute-shares.ts` pure fn
- [ ] `compute-shares.test.ts` all pass
- [ ] supabase client + admin
- [ ] `npm run build` clean
- [ ] committed with explicit paths

## Success Criteria
- Observable: `npm test` passes; `npm run build` clean; verification script prints a real Arc tx hash with USDC-denominated gas; `fetchCommits`/`fetchMergedPrs` return correct counts for a manually verified public repo/window; `computeShares` output sums (amounts + dust) exactly equals pool base units.
- Gas-in-USDC assumption resolved (confirmed or ERRATA filed).

## Test Matrix (vitest — `compute-shares.test.ts`)
- Unit: normal 3-member split (PRD example: 70/42/28 pts, 1000 USDC -> 500/300/200) exact.
- Unit: zero total points -> `noActivity:true`, all amounts 0, dust == pool, no throw.
- Unit: rounding dust — amounts + dust == poolBaseUnits (indivisible pool, e.g. 3 members 1 pt each of 1_000_000 -> 333333*3 + dust 1).
- Unit: single member gets 100%.
- Unit: member with 0 points among active members gets 0.
- `[RT-C1]` Unit: **fully funded pool with buffer produces `paid`, not `insufficient_funds`.** Given `balance` and `GAS_BUFFER_BASE_UNITS`, `distributable = balance - buffer`; `computeShares(..., distributable)` -> `sum(amounts)+dust == distributable` AND `sum(amounts) <= balance - buffer`. Assert the settlement balance gate (`balance - buffer >= sum(amounts)`) passes (i.e. would NOT flip to insufficient_funds) for a pool that covers shares once the buffer is reserved. (Regression for the buffer double-count bug.)
- `[RT-M1]` Unit: fractional weight (e.g. `commitWeight=1.5`) -> REJECTED (validation throws / caller guard); never enters bigint math.
- `[RT-M1]` Unit: zero for BOTH weights -> all points 0 -> `noActivity:true` path (no division by zero), pool rolls over.
- `[RT-M1]` Unit: negative weight (e.g. `prWeight=-1`) -> REJECTED.
- Integration (manual, not CI): fetchers against a real public repo with known activity in a fixed window; gas-verify script real tx.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Gas NOT in USDC | Low | Critical | Verify FIRST (step 9); ERRATA + stop if false |
| Arc RPC rate limit blocks dev | High | Med | `withRetry` on all calls; sequential; low req volume |
| Faucet not found / empty | Med | High | Research early day 1; ask user; fallback ask organizers |
| `pulls` filter wrong (counts unmerged) | Med | High | Explicit merged_at+window filter + test on known PR |
| Tailwind v3 patterns leak in | Med | Low | Confirm `@import "tailwindcss"`, follow current shadcn docs |

## Security Considerations
- `POOL_WALLET_MNEMONIC` and `SUPABASE_SERVICE_ROLE_KEY` are server-only; never `NEXT_PUBLIC_`, never logged. `.gitignore` covers `.env*` (except `.env.example`).
- `lib/supabase/admin.ts` must be server-only (throw if bundled to client).
- Verification script uses a throwaway mnemonic (testnet only).

## MANUAL TEST GUIDE
1. Terminal: run `npm run dev`. Open `http://localhost:3000`. Expect: placeholder page renders "MeritStream". Failure symptom: build error overlay / 500.
2. Terminal: run `npm test`. Expect: all `compute-shares` tests pass (green summary). Failure: a red failing assertion — read which edge case.
3. Terminal: run the fetch check (a small `tsx scripts/...` or a temporary test) for a known repo/window. Expect commit + merged-PR counts matching what you see on GitHub for that author/window. Failure: 0 counts (check author email linkage or window) or 403 (add `GITHUB_TOKEN`).
4. Terminal: run `npx tsx scripts/verify-gas-in-usdc.ts`. Expect: prints funded address, a tx hash, and USDC balance decreasing by (transfer + gas), confirming gas paid in USDC. Failure symptom: "insufficient funds for gas" mentioning a non-USDC token, or revert -> STOP and file `plans/PRD-ERRATA.md`.
5. Supabase dashboard -> Table editor. Expect: `teams` (with `wallet_index`, `admin_token_hash`), `members` (with `created_at` `[RT-H3]`), `settlements` (status default, `UNIQUE(team_id, cycle_end)` `[RT-C3]`), `payouts` (status default 'pending', `tx_hash` NULLABLE `[RT-C2]`, `UNIQUE(settlement_id, member_id)` `[RT-C3]`) all present. Verify both unique constraints exist (Database -> Indexes or `\d`). Failure: missing table/column/constraint -> re-run `db/schema.sql`.

## AUDIT GATE
Before requesting approval for Phase 2: run AUDIT GATE (CLAUDE.md). Write `plans/PHASE1-AUDIT.md` with: PRD deviations (list the three deliberate schema deviations — `payouts.tx_hash` NULLABLE `[RT-C2]`, `members.created_at` added `[RT-H3]`, `payouts.status`/`settlements.status` new values — cross-referenced in `plans/PRD-ERRATA.md`), 5 edge cases tested (empty repo, unlinked email commits, PR merged just outside window, RPC rate-limit retry, faucet/underfunded address), bugs+fixes, regression tests added, the real gas-verify tx hash as evidence, `[RT-C1]` the MEASURED per-transfer USDC gas cost + computed headroom vs the 1 USDC buffer for the max expected member count, `git log --oneline` + clean `git status`. Then STOP for user approval.

## Next Steps
- Unblocks Phase 2 (create-team flow consumes fetchers + wallet derivation + schema).
- Carry forward: confirmed native/gas decimals into `lib/arc/chain.ts`; faucet URL noted for demo funding.
