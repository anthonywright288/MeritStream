# Phase 3 — Settlement Engine + Cron + Settlement History

## Context Links
- PRD: `MeritStream-PRD-EN.md` sections 3, 5 (cycle settlement), 4.3 (history), 6 (all edge rules), 9 (risks), 6b schema.
- Design: brainstorm report (shared engine, per-payout status, resume, 1 USDC buffer, sequential transfers).
- Depends on: Phase 1 (fetchers, points, wallet, transfer, retry), Phase 2 (load-signals, cycle window, admin-token verify, dashboard).

## Overview
- **Priority:** P1 (the core value).
- **Status:** pending (blocked by Phase 1, 2).
- **Description:** START this phase with the FIRST PRODUCTION DEPLOY to Vercel (fail-fast: surfaces env vars, function timeouts, cron config issues while there is time to fix — cron only truly runs on production). Then build ONE settlement engine that: freezes a signal snapshot, computes shares, checks pool balance (with 1 USDC gas buffer), and pays each member via sequential USDC transfers awaiting receipts, recording per-payout status so a mid-run failure resumes from the first unpaid member. Wire it to Vercel Cron (`POST /api/agent/run`, CRON_SECRET, all due teams) and a manual admin "Settle now" (`POST /api/teams/[id]/settle`, admin token). Build the settlement history page (audit trail) with frozen snapshots.

## Key Insights
- `[RT-C3]` Idempotency is backed by DB CONSTRAINTS, not client behavior: `UNIQUE(team_id, cycle_end)` on settlements and `UNIQUE(settlement_id, member_id)` on payouts (added phase-01). Create settlement via `INSERT ... ON CONFLICT DO NOTHING` then re-read; then CLAIM the run with a compare-and-set: `UPDATE settlements SET status='running' WHERE id=? AND status NOT IN ('running')` — an invocation whose UPDATE affects 0 rows LOST the claim and exits WITHOUT touching the chain. Client-side button disable is NOT a defense (cron + manual can fire concurrently).
- `[RT-C2]` Write-ordering prevents double-pay. Payout row is persisted `{status:'sending'}` BEFORE the broadcast; `tx_hash` is written IMMEDIATELY after broadcast (before awaiting receipt); flipped to `paid` after the receipt confirms. `failed` = pre-broadcast error (safe to retry). `sending` WITH a tx_hash = post-broadcast, outcome unknown — on resume, CHECK that hash's receipt on-chain; NEVER blind re-send. Retries (`withRetry`) apply ONLY to reads and `waitForTransactionReceipt`, NEVER to the `writeContract`/send broadcast.
- `[RT-C4]` Resume MUST NOT re-freeze: if a settlement row already has a stored snapshot, LOAD it and use it; recompute `remainingTotal = sum(amounts of payouts not yet paid)` and gate on that (not the full total). Freeze happens ONLY on first creation; the snapshot is immutable.
- On re-run for an existing settlement, skip members already `paid`; verify `sending` rows on-chain (RT-C2); retry only clean `pending`/`failed`. Each transfer independent.
- Sequential is mandatory (Arc rate limits): one transfer, await receipt via `withRetry`, then next. Never parallelize transfers.
- `[RT-C1]` **Buffer is subtracted BEFORE shares are computed** to avoid a double-count that would make every settlement `insufficient_funds`. Shares are computed over `distributable = max(0n, balanceAtFreeze - GAS_BUFFER_BASE_UNITS)`. The pre-transfer balance check is then only a RE-READ SANITY check (`currentBalance - BUFFER >= remainingTotal`), because `total <= distributable` already holds by construction. The dashboard projection uses the identical distributable basis, so projection == settlement.
- Pre-settlement balance check `[RT-C1][RT-C4]`: required = `remainingTotal` (sum of not-yet-paid amounts, = full total on first run). If `currentBalance - BUFFER < remainingTotal` -> status `insufficient_funds`, pay nothing, surface message (per PRD: pause + notify, do NOT partial-pay on the check failure). (`partial` is the different case where the run started and a transfer failed mid-way after some went out.)
- Zero activity: `computeShares.noActivity` -> create settlement `status: no_activity`, pool rolls over (no payouts), close cycle, open next window.
- Snapshot is frozen JSON: raw per-member commits/PRs items + points + pct + amountBaseUnits + dust + weights + window + poolBalance + `[RT-C1]` distributable at freeze time. This is the immutable audit record; never mutated later. `[RT-C5]` It is written ONLY by a STRICT freeze (no member fetch errors) — a snapshot never contains an errored/zeroed member.
- Buffer: reserve exactly 1 USDC (1_000_000 base units) — never include in payouts, never transfer it out. `[RT-C1]` subtracted from balance to form `distributable` before shares are computed.
- `[RT-H1]` Cron is NOT only for newly-due teams. `dueTeams(now)` selects BOTH: (a) teams whose `cycle_end <= now` with NO settlement covering that window, AND (b) teams with a settlement in a NON-TERMINAL state that should be resumed — `running` that is stale/crashed, `partial`, or `insufficient_funds` where the balance now suffices. Resuming goes through the stored-snapshot path (RT-C4), never a re-freeze. Without (b), a crashed/underfunded settlement is a permanent dead-end. Guard with `CRON_SECRET` (header/bearer).
- `[RT-H2]` Forced settlement records `cycle_end = now`, so its window is `[cycle_start, now]`; the next cycle starts at `now`. Window-coverage checks use RANGE CONTAINMENT (does a settlement's `[cycle_start, cycle_end]` cover this window), NOT `cycle_end` equality. Double-force is prevented by the running-claim (RT-C3) + `UNIQUE(team_id, cycle_end)`. A commit pushed AFTER a force-settle falls into the NEXT window.
- `[RT-H5]` Mnemonic-mismatch guard: before ANY transfer, assert `deriveTeamPoolAccount(team.wallet_index).address === team.pool_address`. If the mnemonic env differs from the one that created the team, the derived signer would control a DIFFERENT wallet — hard-fail with an explicit `mnemonic mismatch` error status; never sign/broadcast.
- **VERIFIED FACT (user-confirmed from prior project, do not re-discover): Vercel Hobby plan allows cron at most ONCE PER DAY — no 5-minute/hourly schedules.** `0 0 * * *` daily is the only viable schedule. This is fine: demo timing is covered by manual "Settle now" (force), so a dense cron is not needed. Do not spend time attempting shorter schedules or "fixing" the cron cadence.
- DEPLOY-FIRST: production deploy happens at step 0 of this phase, BEFORE engine work. All later steps redeploy continuously; cron registration is verified in the Vercel dashboard on day one of this phase.
- Amounts already floored in base units by `computeShares`; dust stays in pool -> becomes part of next cycle's balance naturally (no explicit rollover transfer).

## Requirements
### Functional
- FR1: `runSettlement(teamId, {force})` engine: resolve window, `[RT-C3]` create-or-claim settlement (compare-and-set to `running`), `[RT-H5]` assert derived address == pool_address, `[RT-C4]` freeze snapshot ONLY on first creation (else load stored snapshot), `[RT-C1]` shares over distributable, balance re-read sanity check, sequential payouts with `[RT-C2]` write-before-broadcast per-payout status, finalize settlement status, open next cycle.
- FR2: Resume — re-invoking for an unfinished settlement `[RT-C4]` loads the STORED snapshot (never re-freezes), skips `paid` members, `[RT-C2]` verifies `sending`-with-tx_hash on-chain (never blind re-send), retries clean `pending`/`failed`; gates balance on `remainingTotal`.
- FR3: `POST /api/agent/run` — CRON_SECRET guarded; iterate all due teams `[RT-H1]` (newly-due AND resumable non-terminal); call engine; return summary.
- FR4: `POST /api/teams/[id]/settle` — admin-token guarded; `force` allowed (settle before cycle end for demo); `[RT-H2]` force records `cycle_end = now`; call engine.
- FR5: Settlement statuses: `running` (`[RT-C3]` claimed, in-flight), `paid` (all paid), `no_activity`, `insufficient_funds`, `partial` (some paid, some failed), plus a hard-fail `[RT-H5]` `mnemonic mismatch` surfaced as an error (no chain writes).
- FR8: `[RT-H5]` Mnemonic guard — engine asserts `deriveTeamPoolAccount(team.wallet_index).address === team.pool_address` before any transfer; mismatch aborts with explicit error, no signing.
- FR6: `/team/[id]/history` — list past settlements (date, pool amount, status); click -> frozen snapshot with per-member share + tx hash (link to Arc explorer) + counted commits/PRs. `[RT-H4]` Show BOTH the snapshot-time wallet AND the ACTUAL destination address the transfer paid (they can differ if the member's wallet was edited between freeze and pay) — the actual destination + tx hash is the real audit trail.
- FR7: Dashboard "Settle now" button triggers manual settle and refreshes. `[RT-H4]` The admin token is held in `sessionStorage` or entered per-action, NOT `localStorage` (an XSS-to-token-theft chain would let an attacker drain the pool; note as a v1 risk — v2 should move to server-side sessions).

### Non-functional
- Files <200 LOC, kebab-case. Engine split: window resolution, snapshot freeze, payout loop, finalize.
- All transfers via `lib/wallet/transfer-usdc.ts` + `withRetry`, sequential, receipt-awaited.
- Money in bigint base units end-to-end.

## Architecture
### Data flow
```
trigger (cron all-due+resumable | manual one team)
  -> runSettlement(teamId, force)
     1. window = cycleWindow(team) ; guard cycle_end<=now unless force
        [RT-H2] force -> cycle_end = now (window = [cycle_start, now])
     2. [RT-C3] INSERT settlement(team_id, cycle_end) ON CONFLICT DO NOTHING ; re-read row
        CLAIM: UPDATE ... SET status='running' WHERE id=? AND status NOT IN ('running')
        if 0 rows updated -> LOST claim -> exit, touch NOTHING on chain
     3. [RT-C4] if row already has stored snapshot -> LOAD it (do NOT re-freeze)
            else [RT-C5] snapshot = freezeStrict(load-signals, strict=true)   // any fetch err -> ABORT, no snapshot, stay retryable
                 persist snapshot (write-once) ; [RT-C1] distributable already baked in
     4. if noActivity -> settlement.status=no_activity ; open next cycle ; return
     5. [RT-H5] assert deriveTeamPoolAccount(team.wallet_index).address == team.pool_address
            else status='mnemonic mismatch' (error) ; return (no signing)
     6. [RT-C4] remainingTotal = sum(amount of payouts NOT yet paid)   // = full total on first run
        balance = readUsdcBalance(pool)   // re-read sanity check only (RT-C1)
        if balance - BUFFER < remainingTotal -> status=insufficient_funds ; return (pay nothing)
     7. account = deriveTeamPoolAccount(team.wallet_index)
        for each member in snapshot order:
           if payout.status==paid: skip
           if payout.status=='sending' AND has tx_hash: [RT-C2] check receipt on-chain
                 confirmed -> mark paid, skip ; not found -> (safe) may re-send ; NEVER blind re-send
           dest = CURRENT members.wallet_address ; [RT-H4] assert isAddress(dest)
           [RT-C2] upsert payout {status:'sending', dest} BEFORE broadcast
           txHash = writeContract transfer(dest, amount)   // NO retry on broadcast
           [RT-C2] write tx_hash immediately (still 'sending')
           waitForTransactionReceipt via withRetry -> confirmed -> {status:'paid'} | revert -> {status:'failed'}
     8. status = all paid ? paid : partial ; open next cycle window (starts at this cycle_end)
```
### Components
- `lib/settlement/run-settlement.ts` (orchestrator, thin).
- `lib/settlement/freeze-snapshot.ts` (build immutable snapshot from load-signals).
- `lib/settlement/pay-members.ts` (sequential loop, per-payout upsert, resume).
- `lib/settlement/finalize.ts` (compute settlement status, open next cycle).
- `lib/settlement/due-teams.ts` (teams with cycle_end<=now and no covering settlement).
- `lib/wallet/transfer-usdc.ts` (from Phase 1; used here) — `[RT-C2]` split into `broadcastUsdcTransfer` (single send, NO retry), `awaitUsdcReceipt` (retry), `getUsdcReceipt` (read-only resume check).
- `app/api/agent/run/route.ts`, `app/api/teams/[id]/settle/route.ts`.
- `app/team/[id]/history/page.tsx` + `components/history/settlement-row.tsx` + `snapshot-detail.tsx`.
- `components/dashboard/settle-now-button.tsx`.

## Related Code Files
### Create
- `lib/settlement/run-settlement.ts`, `freeze-snapshot.ts`, `pay-members.ts`, `finalize.ts`, `due-teams.ts`.
- `lib/wallet/transfer-usdc.ts` (if not built in Phase 1 verify script — extract to reusable module now).
- `app/api/agent/run/route.ts`, `app/api/teams/[id]/settle/route.ts`.
- `app/team/[id]/history/page.tsx`, `components/history/settlement-row.tsx`, `components/history/snapshot-detail.tsx`.
- `components/dashboard/settle-now-button.tsx`.
- `lib/settlement/constants.ts` (`GAS_BUFFER_BASE_UNITS = 1_000_000n`). `[RT-C1]` shared: the phase-02 dashboard also imports it for its distributable projection (define it wherever both can reach; single source of truth, no duplicated literal).
- `vercel.json` (cron schedule for `/api/agent/run`, daily; `[RT-H1]` explicit `maxDuration`).
### Modify
- `components/dashboard/dashboard-view.tsx` (add Settle-now button, link to history).
- `lib/supabase/admin.ts` (settlement/payout insert/upsert helpers if needed).
### Delete
- none.

## Implementation Steps
0. **DEPLOY FIRST (moved from Phase 4 by user decision):** push current master to GitHub; import project into Vercel; set ALL env vars (POOL_WALLET_MNEMONIC, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, CRON_SECRET + NEXT_PUBLIC_*); add `vercel.json` cron `{"path": "/api/agent/run", "schedule": "0 0 * * *"}` (daily — Vercel Hobby max, see Key Insights); `[RT-H1]` set `maxDuration` EXPLICITLY on `/api/agent/run` (and `/api/teams/[id]/settle`) in `vercel.json`/route config (sequential transfers + retries are slow; do NOT leave it to default) — pick the max the plan allows and verify a multi-member settle completes within it. Production build must pass; confirm the cron job appears in Vercel dashboard → Cron; smoke-test `/`, `/create`, `/team/[id]` and `GET /api/teams/[id]/signals` on the production URL. Fix any env/timeout issue NOW. Redeploy continuously through the rest of this phase.
1. Extract `lib/wallet/transfer-usdc.ts`. `[RT-C2]` **Split into distinct steps so retries never re-broadcast:** (a) `broadcastUsdcTransfer(account, to, amountBaseUnits)` -> viem walletClient `writeContract` USDC `transfer` -> returns `txHash`; this send is called EXACTLY ONCE, NO `withRetry` around it. (b) `awaitUsdcReceipt(txHash)` -> `waitForTransactionReceipt` via `withRetry` (reads are safe to retry); revert receipt -> throw. (c) `getUsdcReceipt(txHash)` -> read-only receipt check for resume (RT-C2). Callers persist the payout row transitions around these (see step 5); `transfer-usdc.ts` itself does no DB writes.
2. `lib/settlement/constants.ts`: `GAS_BUFFER_BASE_UNITS = 1_000_000n` (1 USDC).
3. `lib/settlement/freeze-snapshot.ts`: `freezeSnapshot(team, window)` -> `[RT-C5]` calls the shared core in STRICT mode (`loadSignals(..., { strict:true })`) so ANY member fetch error THROWS and the freeze aborts (settlement stays retryable, NO snapshot persisted, status NOT finalized). Extract the shared core so dashboard (tolerant) + settlement (strict) share it (DRY). `[RT-C1]` computes shares over `distributable = max(0n, poolBalance - GAS_BUFFER_BASE_UNITS)`. Return `{window, weights, poolBalance, distributable, members:[{memberId, username, wallet, commits:items, prs:items, points, pct, amountBaseUnits}], dust, noActivity}`. Snapshot is written ONCE (RT-C4); never mutated.
4. `lib/settlement/due-teams.ts`: `dueTeams(now)` -> `[RT-H1]` returns BOTH (a) teams where computed `cycle_end <= now` and NO settlement `[RT-H2]` whose `[cycle_start,cycle_end]` range CONTAINS this window (range containment, not `cycle_end` equality), AND (b) resumable teams with a settlement in a non-terminal state (`running` older than a staleness threshold, `partial`, or `insufficient_funds` where `balance - BUFFER >= remainingTotal` now). Both feed `runSettlement` via the stored-snapshot path.
5. `lib/settlement/pay-members.ts`: `payMembers(settlement, account, members)` -> load existing payouts; for each member sequential: skip if `paid`; `[RT-C2]` if `sending` WITH tx_hash -> `getUsdcReceipt` on-chain: confirmed -> mark `paid` skip; still not mined -> leave (do NOT re-send). For a clean member: `[RT-H4]` `dest = current members.wallet_address`, assert `isAddress(dest)` (bad -> mark `failed`, continue); `[RT-C2]` upsert `{status:'sending', dest_address:dest}` BEFORE broadcast -> `broadcastUsdcTransfer` (single send, no retry) -> write `tx_hash` immediately -> `awaitUsdcReceipt`: confirmed -> `paid`; revert/throw -> `failed`. Continue. Return counts. Records ACTUAL dest per payout (audit trail RT-H4).
6. `lib/settlement/finalize.ts`: `finalize(settlementId, payoutResults)` -> status `paid`|`partial`; update settlement (from `running`); next cycle opens implicitly since window derives from last settlement `cycle_end` — ensure `cycleWindow` reads latest settlement `cycle_end` `[RT-H2]` (which = the force time when forced).
7. `lib/settlement/run-settlement.ts`: orchestrate the data-flow. `[RT-C3]` create by `INSERT ... ON CONFLICT(team_id,cycle_end) DO NOTHING` + re-read, then compare-and-set claim to `running` (lose claim -> exit, no chain writes). `[RT-C4]` re-freeze ONLY if no stored snapshot; else load it and compute `remainingTotal`. `[RT-H5]` mnemonic assert before transfers. Handle noActivity + insufficient_funds (gated on `remainingTotal`) early returns. All money bigint.
8. `app/api/agent/run/route.ts`: POST, verify `CRON_SECRET` (Authorization bearer or `x-cron-secret`); `dueTeams(now)` `[RT-H1]` (newly-due + resumable) -> loop `runSettlement`; return `{settled:[...], resumed:[...], skipped:[...]}`. 401 if secret bad.
9. `app/api/teams/[id]/settle/route.ts`: POST, verify admin token header; parse `{force}`; `runSettlement(id, {force})`; return settlement summary. 401 bad token.
10. `vercel.json` already added in step 0 (daily `0 0 * * *` — Hobby allows max 1/day; Vercel cron sends its own auth; still verify CRON_SECRET; `[RT-H1]` `maxDuration` set explicitly in step 0). Here: re-verify cron still registered after the engine routes exist, and confirm `/api/agent/run` completes within the configured `maxDuration` on production (sequential transfers + retries are slow — validate with a real multi-member settle, not an estimate). Client-side disable is a UX nicety only; server-side claim (RT-C3) is the real double-run guard.
11. `components/dashboard/settle-now-button.tsx`: `[RT-H4]` obtain admin token from `sessionStorage` or a per-action input — NOT `localStorage`. POST settle with header + `force:true` for demo, show progress, refresh dashboard on done. Disable while running (UX only; not a safety mechanism — RT-C3 claim is).
12. History: `app/team/[id]/history/page.tsx` lists settlements (server fetch) newest first via `settlement-row.tsx`; clicking expands `snapshot-detail.tsx` showing per-member share, tx hash (link to Arc explorer tx), counted commits/PRs from frozen snapshot, dust line, status. `[RT-H4]` Show BOTH the snapshot-time wallet AND the actual `dest_address` the payout paid (flag when they differ).
13. Add history link + settle button to dashboard. `npm run build` clean. Add regression tests for engine edge cases (mock GitHub + a stubbed transfer, or a dedicated integration run on testnet). Commit explicit paths.

## Todo List
- [ ] STEP 0: production deploy live on Vercel — env vars set, daily cron registered (Hobby limit 1/day), `[RT-H1]` explicit `maxDuration`, smoke test passed
- [ ] `transfer-usdc.ts` `[RT-C2]` split: broadcast (single, no-retry) / awaitReceipt (retry) / getReceipt (resume)
- [ ] settlement constants (1 USDC buffer) — shared with phase-02 dashboard `[RT-C1]`
- [ ] `freeze-snapshot.ts` `[RT-C5]` strict mode (any fetch err aborts, no snapshot); `[RT-C1]` distributable basis; shared core (DRY)
- [ ] `due-teams.ts` `[RT-H1]` newly-due + resumable non-terminal; `[RT-H2]` range containment
- [ ] `pay-members.ts` `[RT-C2]` write-before-broadcast, sending-check-on-resume; `[RT-H4]` current wallet + dest_address recorded
- [ ] `finalize.ts` (paid|partial, next cycle opens from cycle_end)
- [ ] `run-settlement.ts` `[RT-C3]` create-on-conflict + claim-run; `[RT-C4]` load-snapshot-not-refreeze + remainingTotal; `[RT-H5]` mnemonic assert; noActivity + insufficient_funds handled
- [ ] `POST /api/agent/run` (CRON_SECRET) `[RT-H1]` iterates resumable too
- [ ] `POST /api/teams/[id]/settle` (admin token, `[RT-H2]` force -> cycle_end=now)
- [ ] `vercel.json` cron daily + `[RT-H1]` maxDuration
- [ ] settle-now button `[RT-H4]` sessionStorage/per-action token (NOT localStorage)
- [ ] history page + snapshot detail (tx links to Arc explorer; `[RT-H4]` show snapshot wallet vs actual dest)
- [ ] regression tests for engine edge cases (incl. RT evidence tests: kill-between-broadcast-and-upsert, concurrent-invocations, resume-after-partial)
- [ ] `npm run build` clean
- [ ] committed explicit paths

## Success Criteria
- Observable: triggering settle on a funded team with activity produces N real Arc USDC transfers (one per member), each recorded with a tx hash visible on the explorer, `[RT-C1]` amounts + dust == distributable (balance − 1 USDC buffer, buffer retained), settlement status `paid`, and the history snapshot links each payout back to the exact commits/PRs. Zero-activity team records `no_activity` with no transfers. Underfunded team records `insufficient_funds` and pays nothing. `[RT-C2][RT-C3][RT-C4]` A mid-run failure (or concurrent invocation, or process kill mid-broadcast) leaves `paid` members paid exactly once and re-running completes the rest from the stored snapshot without double-paying.

## Test Matrix
- Integration (testnet): 3-member funded team -> 3 transfers, statuses paid, `[RT-C1]` amounts + dust == distributable (= balance − buffer), buffer NOT paid out, tx hashes valid.
- `[RT-C1]` Edge: fully funded pool with buffer -> status `paid`, NOT `insufficient_funds` (regression for buffer double-count).
- Edge: zero total points -> `no_activity`, 0 payouts, pool intact.
- Edge: `balance - buffer < remainingTotal` -> `insufficient_funds`, 0 payouts.
- `[RT-H1]` Edge: fund pool AFTER `insufficient_funds` -> next cron/run pays from the STORED snapshot (no re-freeze), status -> `paid`.
- Edge: transfer fails on member 2 of 3 (bad address / forced revert) -> member1 paid, member2 failed, status `partial`; re-run -> `[RT-C4]` member2/3 paid the ORIGINAL stored-snapshot amounts, member1 NOT re-paid.
- `[RT-C3]` Edge: two TRULY concurrent invocations (cron + manual same window) -> compare-and-set claim lets EXACTLY ONE proceed; the other exits touching nothing; no duplicate settlement row, no double payout.
- `[RT-C2]` Edge: hard-kill the process BETWEEN broadcast and the paid-upsert; resume -> the `sending`+tx_hash row is verified on-chain and marked `paid`, NEVER re-broadcast (no double-pay).
- `[RT-C4]` Edge: resume does NOT re-freeze — stored snapshot amounts are identical across the crash; balance gate uses `remainingTotal`.
- `[RT-C5]` Edge: GitHub failure DURING freeze -> settlement ABORTS, stays retryable, NO snapshot written (never a snapshot with an errored/zeroed member), never a false `no_activity`.
- `[RT-H2]` Edge: force-settle records `cycle_end = now`; a commit pushed AFTER the force lands in the NEXT window, not the settled one.
- `[RT-H5]` Edge: `POOL_WALLET_MNEMONIC` differs from team's -> derived address != `pool_address` -> hard-fail `mnemonic mismatch`, zero transfers.
- `[RT-H4]` Edge: member wallet edited between freeze and pay -> transfer pays the CURRENT wallet; payout `dest_address` records it; history shows snapshot-vs-actual divergence.
- Edge: cron with wrong CRON_SECRET -> 401, nothing runs.
- Edge: manual settle wrong admin token -> 401.
- Unit: `finalize` status logic (all paid vs some failed); `[RT-C1]` distributable/buffer arithmetic.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Payout loop fails midway | Med | High | Per-payout status + resume-skip-paid; each tx independent |
| `[RT-C1]` Buffer double-count -> all settlements insufficient_funds | High | Critical | Subtract buffer to form distributable BEFORE shares; balance check is re-read sanity only |
| `[RT-C2]` Double-pay via write-after-broadcast + retry-on-send | Med | Critical | Write `sending`+tx_hash BEFORE/at broadcast; no retry on send; resume verifies receipt, never blind re-send |
| `[RT-C3]` Concurrent cron+manual both pay | Med | Critical | UNIQUE(team,cycle_end) + compare-and-set claim to `running`; loser exits; client disable NOT relied on |
| `[RT-C4]` Resume re-freezes, amounts drift | Med | High | Freeze once; resume loads stored snapshot; gate on remainingTotal |
| `[RT-C5]` GitHub error zeroes members in snapshot | Med | Critical | Strict freeze aborts on any fetch error; no snapshot, stays retryable |
| `[RT-H1]` Crashed/underfunded settlement = permanent dead-end | Med | High | due-teams selects resumable non-terminal states; maxDuration set explicitly |
| `[RT-H5]` Wrong mnemonic env signs different wallet | Low | Critical | Assert derived address == pool_address before any transfer |
| `[RT-H4]` XSS steals localStorage admin token -> pool drain | Low | High | Token in sessionStorage/per-action only; note v1 risk, v2 server sessions |
| Pool underfunded at settle | Med | Med | Pre-check `balance - buffer >= remainingTotal`; insufficient_funds, pay nothing |
| RPC rate limit during loop | High | Med | Sequential + withRetry (reads only); await each receipt |
| Snapshot mutated later | Low | High | Snapshot is write-once JSONB; never updated |
| Gas buffer wrong unit | Low | Med | Constant `1_000_000n`, covered by unit test |
| Env/timeout/cron issues found late | Med | High | DEPLOY-FIRST step 0: production live before engine work; continuous redeploys |
| Serverless timeout during payout loop | Med | High | Verify `/api/agent/run` duration on production early; maxDuration config if needed |

## Security Considerations
- `POST /api/agent/run` requires `CRON_SECRET`; `POST /api/teams/[id]/settle` requires admin token (constant-time verify). Both are irreversible-action endpoints — never authorize on a model/heuristic, only on the secret.
- Objective checks (`[RT-C1]` `balance - buffer >= remainingTotal`, points > 0, `[RT-H5]` derived address == pool_address) computed in code, independent of any external signal, before any transfer.
- Pool mnemonic server-only; wallet derived per-request, never exposed. Never log private material or full admin token.
- `[RT-H4]` Admin token lives in `sessionStorage`/per-action input, NEVER `localStorage` — limits an XSS-to-token-theft chain that could drain the pool. Documented v1 risk; v2 = server-side sessions.
- Untrusted input: member wallet addresses validated (`isAddress`) `[RT-H4]` at SEND time (current wallet) before use as transfer `to`; team/repo strings never interpolated into shell/SQL.
- `[RT-C3]` Idempotency guards (DB UNIQUE + compare-and-set claim) — not client button state — prevent replay/concurrent double-settle. `[RT-C2]` write-before-broadcast + on-resume receipt verification prevents double-pay across crashes.

## MANUAL TEST GUIDE
0. Open the Vercel dashboard → project → Cron. Expect: `/api/agent/run` listed with a DAILY schedule (Hobby allows only 1/day — this is intentional, not a bug). Open the production URL `/` and `/create`. Expect: pages load. Failure: build error or 500 → check Vercel build logs / env vars BEFORE continuing this phase.
1. Ensure a team from Phase 2 exists, pool funded with test USDC, members have real activity. Open `/team/[id]`.
2. Click "Settle now", paste the admin token when prompted. Expect: button shows progress, then success; dashboard refreshes; pool balance drops by the paid total. Failure: 401 (wrong token) or "insufficient funds" (fund more).
3. Go to `/team/[id]/history`. Expect: a new settlement row with today's date, pool amount, status "paid". Failure: no row -> check settle response / server logs.
4. Click the settlement row. Expect: per-member share in USDC, each with a tx hash link. Click a tx hash — opens Arc explorer showing a USDC transfer to that member's wallet. Failure: tx hash missing -> payout status failed/partial.
5. In the snapshot detail, verify each member's counted commits/PRs are listed and link to GitHub — the audit trail from money back to work. Failure: empty signals -> snapshot freeze bug.
6. Zero-activity check: create/settle a team with a repo window that has no member activity. Expect: history row status "no activity", no payouts, pool unchanged. Failure: a transfer happened -> division/guard bug.
7. Underfunded check: settle a team whose pool < required + 1 USDC. Expect: status "insufficient funds", no transfers, message to fund. Failure: partial transfers went out.
8. Resume check `[RT-C4]`: (simulate) set one member's wallet to a known-bad value (via the phase-02 wallet PATCH), settle, observe one `failed` payout + `partial` status; fix wallet, settle same cycle again — expect only the previously-failed member gets paid the SAME snapshot amount, already-paid members are not re-paid, and NO re-freeze (snapshot unchanged).
9. Cron check: `curl -X POST` `/api/agent/run` with the correct `CRON_SECRET` header for a due team -> settles; with a wrong secret -> 401.
10. Resume-after-underfunded `[RT-H1]`: settle a pool that is underfunded -> `insufficient_funds`, 0 transfers; then FUND the pool and re-run (`/api/agent/run` or Settle now) -> pays from the STORED snapshot, status -> `paid`. Failure: a re-freeze changes amounts, or it stays stuck.
11. Concurrent guard `[RT-C3]`: fire two settles for the same team/window at once (two `curl` in parallel + the button). Expect: exactly ONE settlement row, exactly one set of payouts, one loser returns "already running/settled". Failure: duplicate settlement or double payout.
12. Kill-and-resume `[RT-C2]`: start a settle, hard-kill the process right after a broadcast (observe a `sending` payout with a tx_hash). Re-run -> that member is confirmed on-chain and marked `paid`, NOT paid twice. Failure: a second transfer to the same member appears on the explorer.
13. Force-window `[RT-H2]`: force-settle now; then push a commit; run/refresh -> the new commit is in the NEXT cycle window, not the just-settled one. Mnemonic guard `[RT-H5]`: point `POOL_WALLET_MNEMONIC` at a different mnemonic and settle -> "mnemonic mismatch" error, zero transfers.

## AUDIT GATE
Before Phase 4 approval: run AUDIT GATE. Write `plans/PHASE3-AUDIT.md` with deviations, edge cases tested (zero activity, insufficient funds, mid-loop failure + resume, double-submit idempotency, wrong secret/token, plus the RT edge cases from the test matrix), bugs+fixes, regression tests, evidence = real settlement tx hashes on Arc explorer + history snapshot, `git log --oneline` + clean `git status`. **REQUIRED evidence tests (must be automated regression tests, not just manual):**
- `[RT-C2]` (a) hard-kill the process between broadcast and the paid-upsert, then resume -> no double-pay (resume verifies the `sending` tx on-chain).
- `[RT-C3]` (b) two truly concurrent invocations (cron + manual) -> exactly ONE pays; the other is a no-op.
- `[RT-C4]` (c) resume-after-partial pays the remaining members the ORIGINAL stored-snapshot amounts (no re-freeze, no drift).
STOP for approval.

## Next Steps
- Unblocks Phase 4 (public read-only page reuses dashboard/history views; deploy configures Vercel Cron + env; demo runs the full settle live).
