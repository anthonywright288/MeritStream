# PHASE 3 AUDIT — Deploy-First + Settlement Engine + Cron + History

Date: 2026-07-26 | Phase file: `plans/260724-1157-meritstream-v1/phase-03-settlement-engine-cron-and-history.md`
Production URL: **https://meritstream-six.vercel.app**

## Step 1 — Deviations

1. Claim mechanism upgraded beyond plan text: `claim_settlement` plpgsql fn (migration 003) = INSERT-on-conflict + FOR UPDATE lock + compare-and-set with `claimed_at` staleness — one atomic round-trip instead of app-side insert-then-claim (closes a claim race the two-step version still had).
2. `sending`-without-hash rows are LEFT for manual review, never auto-retried (crash inside the intent window may have broadcast with an unknown hash; conservative = never double-pay).
3. Force idempotency guard added mid-phase (user constraint #3, found by production test): re-force within 60s of the last settled cycle -> 409 `already_settled`, no row minted.
4. Deploy via Vercel CLI direct upload (not git-connected auto-deploy) — CLI was authenticated; redeploys = `vercel deploy --prod`.

## Step 2 — Real-run evidence (ALL on the production URL, not localhost)

- **Deploy-first (step 0):** production live BEFORE engine work; env issues surfaced and fixed early exactly as intended (see bugs). Cron `/api/agent/run` daily registered via `vercel.json` (Hobby max 1/day — known fact, demo uses Settle-now); `maxDuration=60` explicit on both settle routes.
- **Real settlement, production:** team `75pw8g1f` (repo anthonywright288/MeritStream, member anthonywright288, wallet = HD index-1 addr). Funded 3 USDC (tx `0xf3bc8c30...ae2b6690`). Two REAL commits pushed (`e70278e`, `88c1a44`) -> signals 2 pts -> settle -> **status `paid`**, payout tx **`0x353e254396b4881c2f76390c1f230f6b39476b4788940bf5d59e7ab42097b896`**, amount 2,000,000 base units = distributable (3 USDC − 1 buffer) [RT-C1], `dest_address` recorded [RT-H4].
- **Money invariant:** member balance 10,000 -> 2,010,000 base units — **exactly one payment** across two settle clicks.
- **Idempotency (user constraint #3):** immediate double-click -> click 1 closes cycle, click 2 -> **409 `already_settled`**, no new row, no transfer. Auth guards: wrong admin token -> 401; wrong CRON_SECRET -> 401.
- **Funds gate (constraint #4):** organic production case — pool below gas buffer -> `insufficient_funds`, `shortfallBaseUnits:"991"` reported, **zero transfers** ("nothing paid"). Gate maths unit-tested; by construction (shares over distributable) a first run can only be short if balance moved after freeze.
- **Strict freeze (constraint #2):** settlement path calls `loadSignals({strict:true})` — any member fetch error throws, un-frozen settlement row deleted, cycle stays retryable. Dashboard stays tolerant (badge per member). Unit + code path; GitHub-down not reproducible on demand in production.
- Resume-after-partial live evidence: see Step 4 addendum below.

## Step 3 — Edge cases tested

| # | Edge | Where | Result |
|---|------|-------|--------|
| 1 | Double-settle same window (idempotency) | production | 409 already_settled, paid once (balance proof) |
| 2 | Underfunded pool | production | insufficient_funds + shortfall 991, nothing paid |
| 3 | Zero-activity cycle | production | `no_activity`, pool intact, no payouts |
| 4 | Wrong admin token / wrong CRON_SECRET | production | 401 / 401 |
| 5 | Kill between broadcast & paid-upsert | vitest regression | resume verifies on-chain, 0 re-broadcasts |
| 6 | Resume-after-partial amounts | vitest regression | member 3 paid ORIGINAL snapshot amount; 1-2 untouched |
| 7 | Receipt timeout | vitest regression | stays `sending` (never fake-`failed`), hash persisted pre-receipt |
| 8 | `sending` without hash | vitest regression | left for manual review, no blind re-send |
| 9 | Confirmed revert -> retry | vitest regression | failed -> clean retry pays once |
| 10 | Invalid current wallet mid-loop | vitest regression | that member failed, loop continues; intent->hash->paid order asserted |

## Step 4 — Bugs found & fixed (rule 11)

| Bug | Found by | Fix | Regression lock |
|-----|----------|-----|-----------------|
| **BOM (U+FEFF) prefixed Vercel env values** -> Supabase header invalid -> every prod query failed | deploy-first smoke (the exact class deploy-first exists to catch) | ASCII-sanitized re-add of all 10 vars; BOM-free file + cmd stdin | deploy-first protocol; error surfacing below makes recurrence loud |
| **DB errors masqueraded as 404 "team not found"** (queries ignored `error`) | debugging the above | load-signals + routes throw on query error -> 502 with detail | error-detail path in signals route |
| **Paid commits would be re-counted next cycle** (loadSignals ignored last settlement end) | production settle #2 | window derives from last terminal settlement `cycle_end` | `cycleWindow` lastEnd unit test + production settle #3/#4 behavior |
| **Re-force minted junk settlement rows** instead of refusing | production settle #2 | 60s min-force-window guard -> 409 `already_settled` | production double-click test (click 2 = 409) |
| CRON_SECRET trailing newline (PS pipe) rejected by Vercel | first deploy attempt | value files written without newline | — (deploy validation catches) |
| PS mangled curl JSON body (`force` flag lost) | settle #1 attempt | body via `@file` | test scripts use files |

## Step 5 — Post-fix re-run

40/40 vitest green after all fixes; `npm run build` clean (9 routes); production redeployed and re-verified (settle flow, 409 idempotency, auth guards).

## Step 6 — Judge's-eye check

Unauthenticated production URL (no Vercel login): `/`, `/create`, `/team/75pw8g1f`, `/team/75pw8g1f/history` all HTTP 200 — **no Vercel SSO redirect** (protection disabled). Verified via curl without any cookies.

## Step 7 — Commits

`e70278e` engine + migration 003 + regression tests; `88c1a44` routes + history UI + vercel.json; audit + fixes committed after production verification (hashes in final `git log` below). Working tree clean at close.

## Step 4 addendum — resume-after-partial (constraint #5) LIVE, production

**A third real bug found & fixed by this test** (the exact class RT-H1/C4 predicted): resume recomputed `cycle_end`, so the claim NEVER matched the stored partial row — it minted a NEW settlement (money paid once only by luck of the drained balance) and stranded the partial forever. Fix `c6a49e6`: resume-first — an open settlement (stale running/partial/insufficient_funds) is re-attached by ITS OWN stored window before any new window is derived.

**Definitive regression, all on production, after the fix:**
1. Member wallet corrupted via DB (bypassing API validation) -> settle -> `partial`, settlement `0aa924c4`, frozen amount **1,998,995**, payout `failed`, ZERO broadcasts.
2. Wallet fixed via `PATCH /api/teams/[id]` (audit row logged old->new).
3. Settle again -> **SAME settlement id `0aa924c4`**, status `paid`, payout amount **1,998,995 == frozen snapshot exactly** (no re-freeze, no drift), dest = corrected wallet, one tx.
4. `member_wallet_audit`: 2 rows (both wallet fixes), timestamps ordered.
5. Cross-test money total: member balance 10,000 -> 2,010,000 -> 4,009,009 -> +1,998,995 — every increment equals exactly one snapshot amount; zero double-pays across ~10 settle invocations including double-clicks, partials, resumes.

## Step 6b — Judge's-eye final check (unauthenticated, no Vercel session)

`/`, `/create`, `/team/75pw8g1f`, `/team/75pw8g1f/history`, `/api/teams/75pw8g1f/signals` -> ALL HTTP 200, zero redirects to vercel.com login. Production URL: **https://meritstream-six.vercel.app**

## Unresolved questions

- 3 empty-cycle `no_activity` rows created during idempotency testing were deleted (test artifacts); the `paid` settlement + its snapshot remain as the audit showcase.
- Vercel project is CLI-linked, not git-connected: pushes to GitHub do NOT auto-deploy; redeploy = `npx vercel deploy --prod`. Consider git-connect in Phase 4 polish.
- Demo team `v17oSNF_` (Phase 2) unchanged: pool = faucet wallet index 0, ~14.98 USDC left after funding tests.
