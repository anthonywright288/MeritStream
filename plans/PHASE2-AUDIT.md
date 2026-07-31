# PHASE 2 AUDIT: Create-Team Flow + Dashboard (Live Signals)

Date: 2026-07-25 | Phase file: `plans/260724-1157-meritstream-v1/phase-02-create-team-flow-and-dashboard.md`

## Step 1: Deviations from PRD / plan text (all deliberate)

1. **Sequence replaces max+1 allocation** (plan text said `SELECT max(wallet_index)+1` retry-loop). User-locked constraint: index NEVER reused even after deleting the top team, only a Postgres SEQUENCE guarantees that. `db/migrations/002`.
2. **True transaction replaces compensating-delete** (plan text: delete team row if members insert fails). `create_team_atomic` plpgsql fn = one atomic tx; failed create burns its index (by design, keeps no-reuse).
3. **`member_wallet_audit` table added** (not in PRD/plan), user constraint #3: every wallet change logged old->new.
4. Signals cache TTL 60s (plan allowed 30-60), user picked 60; response carries `syncedAt` + `fromCache` for the "last synced X ago" label.
5. Tolerant/strict decision confirmed by user: dashboard TOLERANT (per-member warning card "signals for X unavailable", never blank page), settlement STRICT (Phase 3 aborts on any member fetch error).

## Step 2: Real-run evidence

- `npm test` **32/32** (26 prior + 6 new: cycle window x4, memberSince x2, admin-token x3, wrong-app detector x4, counted per file: window 6, token 3, detector 7). `npm run build` clean, 7 routes.
- **Live integration run (dev server, real GitHub + real Supabase + real Arc RPC): 21/21 passed**, `scripts/phase2-integration-test.ts` output in session log. Highlights:
  - Constraint #1: teams got indexes 0,1,2; deleted the MIDDLE team; new team got index 3 (> all prior, deleted index 1 never reused); survivors' pool addresses byte-identical before/after.
  - Constraint #2: `create_team_atomic` with member missing wallet -> rejected; `teams` has NO row for the attempted id (full rollback); burned index stayed burned (next allocation strictly greater).
  - Constraint #3: wrong token 401; fractional weight 422; invalid wallet 422; valid edit 200 + `member_wallet_audit` row old->new recorded.
  - Constraint #4: 2nd signals request within TTL served `fromCache:true`, identical `syncedAt` (one GitHub batch for N requests).
  - [RT-H3]: member added mid-cycle -> `memberSince` == join instant (> window.start), zero pre-join signals.
  - [RT-M1]: create with weight 1.5 -> 422; unknown repo -> 422; unknown user -> 422 (no rows written).
- Live signals DTO for demo team `v17oSNF_` (index 0 = the faucet-funded address): poolBalance 19,988,151, distributable 18,988,151 (**[RT-C1] buffer subtracted before shares**), fresh window -> 0 points all members -> dust == distributable (no-activity path correct).

## Step 3: Edge cases tested (from test matrix)

| # | Edge | Result |
|---|------|--------|
| 1 | Unknown repo / unknown username on create | 422 + no rows |
| 2 | Fractional / invalid weights (create + PATCH) | 422 both paths |
| 3 | Wrong admin token on PATCH | 401 (constant-time verify) |
| 4 | Mid-cycle join | since = join instant, zero pre-join signals |
| 5 | Delete-middle-team then create | no index reuse, survivors unchanged |
| 6 | Broken member row in atomic create | full rollback, no orphan |
| 7 | Cache TTL | 2nd hit fromCache, one GitHub batch |
| 8 | Wrong app on port (TokenGate incident) | fail-fast with clear message (see Step 4) |

Not live-tested (documented): PATCH-wallet-409-while-`running` (needs a running settlement, Phase 3 test matrix owns it); unlinked-email 0-commit note (PRD caveat, surfaced in UI text).

## Step 4: Bugs found & fixed (rule 11 regression lock)

| Bug | Fix | Regression |
|-----|-----|-----------|
| shadcn Base-UI Button has no `asChild` (build break x2) | `buttonVariants` + Link; SheetTrigger `render` prop | build |
| **Integration test hardcoded port 3000; port was serving a DIFFERENT app (TokenGate) -> opaque `JSON.parse: Unexpected token '<'` crash** | `scripts/detect-meritstream-base.ts`: identity probe (MeritStream-only JSON shape), TEST_BASE_URL authoritative, candidate port scan, fail-fast `WrongAppError` ("Expected MeritStream at PORT but found a different app…") | 7 vitest cases in `scripts/detect-meritstream-base.test.ts` incl. the exact TokenGate scenario (foreign app on 3000, genuine on 3002) |

## Step 5: Post-fix re-run

`npm test` 32/32 AFTER fixes; integration 21/21 with the resolver verifying identity first ("MeritStream verified at http://localhost:3002").

## Step 6/7: Commits

Appended at commit time; explicit paths, secret scan re-checked (.env.local untracked; demo admin token appears only in session log, NOT in any tracked file, testnet demo team, regenerate for the real demo in Phase 4).

## Unresolved questions

- Demo team `v17oSNF_` admin token was printed to session output (testnet-only). Recreate the real demo team in Phase 4 with a fresh token.
- `GITHUB_TOKEN` still empty in `.env.local`, unauthenticated 60 req/h. Enough for dev; NEEDED before demo-day polling (5,000/h). Ask user for a token at Phase 3 deploy.
- Dev server left running at http://localhost:3002 for the user's manual test pass.
