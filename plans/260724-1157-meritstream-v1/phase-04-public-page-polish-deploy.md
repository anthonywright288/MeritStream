# Phase 4: Public Team Page, Polish, Deploy, Demo

## Context Links
- PRD: `MeritStream-PRD-EN.md` sections 4.4, 8 (Day 4), 10 (success + wow demo), stretch (Multicall3From).
- Design: brainstorm report (public read-only page, polling, stretch Multicall verify-ABI-first).
- Depends on: Phase 1-3 (full end-to-end path working).

## Overview
- **Priority:** P1 (deploy + demo) with P3 stretch (Multicall3From batch).
- **Status:** pending (blocked by Phase 1-3).
- **Description:** Ship the public read-only page `/t/[teamId]`, polish UI/empty/loading/error states, do the FINAL redeploy (production has been live since Phase 3 step 0, this phase only re-verifies env + cron, no first-time deploy), and prepare a demo team with real repo activity for the wow flow (live commit -> points jump -> settle -> 3 wallets paid, each linked to commits). Optional stretch: replace the payout loop with one Multicall3From batch transfer (verify ABI first).

## Key Insights
- Public page reuses the dashboard read path (signals) minus any admin controls (no Settle button, no admin token). Same polling. It is the shareable transparency URL.
- Production is LIVE since Phase 3 step 0 (env vars + daily cron already configured and verified there; Vercel Hobby cron = max 1/day, demo uses manual Settle-now). This phase: redeploy polish, re-verify env/cron unchanged.
- Demo reliability > feature count. The wow flow depends on: funded pool, a repo the presenter can push to live, `force` settle for on-stage timing, and fast-enough GitHub propagation (commit shows in API within seconds). Rehearse.
- Stretch Multicall3From: ABI is UNVERIFIED. Do NOT attempt unless ahead of schedule AND ABI verified against the deployed bytecode (`0x522fAf9A91c41c443c66765030741e4AaCe147D0`) with a real call first. If ABI cannot be confirmed, keep the sequential loop (it works). Batch would need pool-wallet approval to Multicall3From, extra tx, extra risk. Time-box hard.
- Do not regress Phase 1-3 working code (CLAUDE.md rule 8). Public page is additive.

## Requirements
### Functional
- FR1: `/t/[teamId]` public page, read-only dashboard (per-member points, projected shares, pool balance, days-to-settlement, signals drawer) with NO admin controls. Polls 60s + manual refresh.
- FR2: Empty/loading/error states across create, dashboard, history, public (no blank screens, no unhandled 500s).
- FR3: Deployed on Vercel, reachable production URL; cron job registered; env vars set.
- FR4: A prepared demo team with real repo + funded pool ready for the wow flow.
- FR5 (stretch, optional): `settleViaMulticall` batch path behind a flag, only if ABI verified.

### Non-functional
- Files <200 LOC, kebab-case. Reuse dashboard components; extract a shared read-only view to avoid duplication (DRY).
- No secrets in client bundle; `NEXT_PUBLIC_*` only for public config.
- Basic responsive layout (mobile-readable) via Tailwind v4.

## Architecture
### Data flow
```
/t/[teamId] (client) --poll 60s--> GET /api/teams/[id]/signals  (public, existing)
  -> render read-only view (no settle, no admin)
Deploy: Vercel project -> env vars -> vercel.json cron -> production URL
Stretch: runSettlement flag -> pay-members-batch (Multicall3From) [ABI verified] else loop
```
### Components
- `app/t/[teamId]/page.tsx` (public shell) reusing `components/dashboard/dashboard-view.tsx` in a `readOnly` mode (hide settle button + history-admin), or a thin `public-view.tsx` wrapper.
- Refactor: `dashboard-view.tsx` accepts `readOnly?: boolean` prop (DRY), hides admin controls when true.
- Shared loading/empty/error UI: `components/ui/state-message.tsx`.
- Stretch: `lib/settlement/pay-members-batch.ts` (Multicall3From), `lib/wallet/multicall3from-abi.ts` (only after verify).

## Related Code Files
### Create
- `app/t/[teamId]/page.tsx`, `components/dashboard/public-view.tsx` (or `readOnly` reuse), `components/ui/state-message.tsx`.
- `docs/deployment-guide.md` (Vercel env + cron steps), `README.md` update (setup + demo script).
- Stretch: `lib/settlement/pay-members-batch.ts`, `lib/wallet/multicall3from-abi.ts`.
### Modify
- `components/dashboard/dashboard-view.tsx` (add `readOnly` prop).
- `app/page.tsx` (landing polish, link to create + a public demo team).
- `app/team/[id]/page.tsx`, `history/page.tsx`, `create/page.tsx` (add empty/loading/error states via `state-message`).
- `lib/settlement/run-settlement.ts` (stretch: batch flag branch).
### Delete
- none.

## Implementation Steps
1. Refactor `dashboard-view.tsx` to accept `readOnly` prop; when true, hide Settle-now + admin edit; keep polling, cards, drawer, pool balance.
2. `app/t/[teamId]/page.tsx`: render dashboard-view with `readOnly` + a "public / shareable" banner. Verify no admin token or secret is referenced.
3. `components/ui/state-message.tsx`: reusable loading spinner / empty ("no activity yet") / error ("couldn't load, retry") component. Wire into create, dashboard, history, public.
4. Polish: consistent Tailwind v4 styling, responsive grid for member cards, format USDC (base units -> `x.xx USDC`), relative timestamps, external-link icons for GitHub/explorer links, favicon + title.
5. Pre-deploy secret scan: confirm no `.env*` (except `.env.example`) tracked; grep staged files for private keys/tokens; confirm `.gitignore` covers `.env*`, `node_modules`, `.next`. Report result.
6. Redeploy: push latest to GitHub (Vercel auto-deploys, project imported in Phase 3 step 0). Re-verify env vars unchanged and cron still registered (Vercel dashboard -> Cron, daily schedule). Fix any build-only errors.
7. Post-deploy smoke: create a team on production, fund pool, view dashboard + public page, run a manual settle, verify tx hashes on Arc explorer, view history.
8. Prepare demo team: real repo the presenter controls, 3 members (their real GitHub usernames + testnet wallets), pool funded via faucet, admin token saved. Write a demo runbook (README): open dashboard -> live commit -> refresh -> points jump -> Settle now (force) -> 3 wallets paid -> open history -> click tx -> explorer.
9. Update `README.md` (setup, env, run, demo script) and `docs/deployment-guide.md`. Delegate docs sync as needed.
10. STRETCH (only if ahead): verify Multicall3From ABI, read bytecode, attempt a known function via a real `eth_call`; if confirmed, build `pay-members-batch.ts` (approve pool USDC to Multicall3From once, then one batched transfer call), gate behind a flag, test on testnet, keep loop as fallback. If ABI not confirmed in a short time-box -> abandon, keep loop, note in audit.
11. Final `npm run build` clean, commit explicit paths.

## Todo List
- [ ] `dashboard-view` `readOnly` prop refactor
- [ ] `/t/[teamId]` public page (no admin controls)
- [ ] `state-message` loading/empty/error across pages
- [ ] UI polish (USDC formatting, responsive, links, favicon/title)
- [ ] pre-deploy secret scan clean
- [ ] final redeploy verified (production live since Phase 3 step 0; env + cron re-checked)
- [ ] production smoke test (create->fund->settle->history->explorer)
- [ ] demo team prepared + runbook in README
- [ ] README + deployment-guide updated
- [ ] (stretch) Multicall3From ABI verified + batch path OR documented abandon
- [ ] final build clean, committed

## Success Criteria
- Observable: production URL live; `/t/[teamId]` shows read-only live signals with no admin controls; full flow (create -> fund -> live signal -> settle -> per-member USDC tx hashes -> audit trail) works on production; Vercel Cron job registered; demo runbook rehearsed end-to-end. All PRD section 10 "must have" items demonstrable. No secret in the repo.

## Test Matrix
- Integration (production): create team -> fund -> dashboard live -> settle -> history -> explorer, all green on the deployed URL.
- Edge: `/t/[unknown-id]` -> clean 404/empty state, no crash.
- Edge: public page for a team with 0 pool / 0 activity -> friendly empty state.
- Edge: GitHub/RPC transient error on production -> error state + retry, no unhandled 500.
- Edge: cron fires on production for a due team -> settlement appears (or verify via manual `/api/agent/run` call with secret).
- Stretch: batch settle matches loop results (same amounts, same recipients) on testnet.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Env var missing on Vercel -> runtime 500 | Med | High | Checklist all vars; smoke test post-deploy |
| Cron not registered / wrong schedule | Med | Med | Verify in Vercel dashboard; manual `/api/agent/run` fallback for demo |
| Live commit not in GitHub API in time | Med | High | Rehearse; use `force` settle; small buffer wait; token to avoid 403 |
| Multicall3From ABI wrong -> failed batch | High | Med | Verify ABI first; keep loop fallback; time-box; abandon if unclear |
| Secret leaked to repo/client | Low | Critical | Pre-deploy scan; server-only env; `.gitignore` audit |
| Public page exposes admin control | Low | High | `readOnly` hides settle/edit; verify no token referenced |

## Security Considerations
- Public page must expose zero secrets and zero admin controls, verify the bundle has no service-role key, no mnemonic, no admin token path.
- Pre-push secret scan mandatory (CLAUDE.md Git rules): no private keys/API keys/tokens tracked; `.env*` (except example) gitignored.
- Production env vars set in Vercel project settings, never committed.
- Cron endpoint stays CRON_SECRET-guarded in production; settle stays admin-guarded.

## MANUAL TEST GUIDE
1. Open the production URL landing page. Expect: MeritStream landing with a "Create team" link and (optionally) a demo team link. Failure: 500 -> check Vercel build logs / env vars.
2. Open `/t/[teamId]` for the demo team. Expect: read-only live view, member points, projected shares, pool balance, signals drawer, and NO "Settle now" or edit controls. Failure: an admin control is visible -> `readOnly` not applied.
3. Open `/t/does-not-exist`. Expect: clean "team not found" state, no crash. Failure: unhandled error page.
4. Wow flow: open the admin dashboard `/team/[id]` for the demo team. Push a real commit to the connected repo. Click Refresh (or wait 60s). Expect: that member's commit count and projected share increase. Failure: no change -> check email linkage / window / token 403.
5. Click "Settle now" (admin token), with `force`. Expect: 3 members paid; dashboard pool balance drops; success. Failure: insufficient funds -> fund pool.
6. Open `/team/[id]/history`, click the new settlement, click each tx hash. Expect: Arc explorer shows a USDC transfer to each member's wallet; snapshot lists the commits/PRs behind each share. Failure: missing tx -> partial/failed payout.
7. Vercel dashboard -> Project -> Cron. Expect: `/api/agent/run` job listed with daily schedule. Failure: absent -> `vercel.json` not picked up, redeploy.
8. (Stretch) If batch enabled: run a settle with the batch flag on a test team. Expect: one Multicall3From tx paying all members; amounts match the loop. Failure: revert -> disable flag, use loop.

## AUDIT GATE
Final audit: run AUDIT GATE. Write `plans/PHASE4-AUDIT.md` with deviations, 5 edge cases tested (unknown team id, empty public team, transient error state, cron registration, secret scan), bugs+fixes, regression tests, evidence = production URL + a real production settlement tx set + cron screenshot, stretch outcome (done/abandoned + why), `git log --oneline` + clean `git status`. This closes v1, confirm all PRD section 10 must-haves demonstrable. STOP for final user sign-off.

## Next Steps
- v1 complete. v2 backlog (out of scope, note only): Jira/Linear signals, review-count weight, lines-changed anti-gaming, private repos via token, OAuth, escrow contract, SIWE auth, Multicall batch if not done as stretch.
