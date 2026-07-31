# Phase 2: Create-Team Flow + Team Dashboard (Live Signals)

## Context Links
- PRD: `MeritStream-PRD-EN.md` sections 4.1, 4.2, 5 (setup), 6 (mid-cycle join, attribution), 6b schema.
- Design: brainstorm report (auth model, dashboard polling, HD wallet per team).
- Depends on: Phase 1 (`lib/github/*`, `lib/points/compute-shares.ts`, `lib/wallet/derive-pool-account.ts`, `lib/supabase/*`, schema).

## Overview
- **Priority:** P1.
- **Status:** pending (blocked by Phase 1).
- **Description:** Build the Create-team form + `POST /api/teams` (allocates `wallet_index`, derives pool address, generates admin token shown once, validates repo/usernames). Build the team dashboard reading live signals via `GET /api/teams/[id]/signals`, polled every 60s with a manual refresh, plus a per-member signals drawer linking to GitHub. No settlement yet.

## Key Insights
- `wallet_index` must be UNIQUE and monotonic: allocate `max(wallet_index)+1` (start 0) inside team creation. `[RT-M2]` Race on concurrent creates -> **retry-LOOP** keyed on the UNIQUE(wallet_index) violation (re-read max, re-attempt), not a single retry; bounded attempts then 503.
- Admin token: generate 32-byte random, show ONCE in the create success screen, store only SHA-256 hash. It is the only credential for mutations (edit, settle). Losing it = no admin actions (acceptable v1).
- Dashboard signals are computed live (not persisted) each poll: fetch commits+PRs per member for the current open cycle window, run `computeShares` against current pool balance. This is the projection; settlement freezes it later (Phase 3).
- Cycle window: `cycle_start` = team `created_at` (or last settlement end); `cycle_end` = start + (weekly 7d | monthly 30d). Mid-cycle member join -> that member's `since` = their `created_at`, not cycle start (PRD 6).
- `[RT-H3]` This mid-cycle rule MUST be wired into fetching: each member's effective `since = max(member.created_at, window.start)` is passed into BOTH `fetchCommits` AND `fetchMergedPrs`; PR inclusion filter uses `merged_at in [memberSince, window.end]`. A member added mid-window must show ZERO pre-join signals.
- Signals endpoint hits GitHub N times (per member) + one balance RPC. Cache per request; 60s poll keeps volume sane. Use `GITHUB_TOKEN` to avoid 403.
- `[RT-C5]` The signals endpoint is PUBLIC (no auth). Add a per-team short server cache (30-60s TTL) on the computed signals so public polling / hostile traffic cannot drain the shared `GITHUB_TOKEN` rate quota (a real DoS/quota-exhaustion attack vector). Cache key = teamId; TTL ~< poll interval.
- `[RT-C1]` Dashboard projection uses the SAME distributable basis as settlement: `distributable = max(0n, poolBalance - GAS_BUFFER_BASE_UNITS)` is passed to `computeShares`, so the projected shares equal what settlement will actually pay (no drift from the buffer). `GAS_BUFFER_BASE_UNITS` (= `1_000_000n`) is a shared constant (`lib/settlement/constants.ts`, formally created in phase-03), because the dashboard consumes it here, DEFINE it in a shared module usable from phase-02 (do not duplicate the literal).

## Requirements
### Functional
- FR1: `/create` form, name, repo (`owner/name`), members (username + wallet, add/remove rows), commit_weight, pr_weight, cycle (weekly|monthly).
- FR2: Client validation, repo format, wallet checksum (viem `isAddress`), >=1 member, unique usernames. `[RT-M1]` `commit_weight` and `pr_weight` must be **positive integers** (reject fractional, zero-both, negative), enforced client AND server-side (server is authoritative).
- FR3: `POST /api/teams`, server validates repo EXISTS (GitHub `/repos/{repo}` 200) and each username exists; `[RT-M1]` re-validates weights are positive integers (422 if not); allocates `wallet_index`; derives pool address; generates admin token; stores team + members + `admin_token_hash`; returns `{teamId, poolAddress, adminToken}` (token once).
  - `[RT-M2]` **Atomic create:** wallet_index allocation is a retry-loop on UNIQUE violation. If the members insert fails AFTER the team row is inserted, DELETE the team row (compensating rollback) and return an error, never leave an orphan team. The admin token is returned to the client ONLY after ALL writes (team + members) commit successfully.
- FR4: Create success screen shows pool address + QR + admin token with copy + "save this now" warning + link to dashboard.
- FR5: `/team/[id]` dashboard, per-member points, projected pct + USDC share, pool balance, days-until-settlement; polls signals every 60s; manual Refresh button.
- FR6: `GET /api/teams/[id]/signals`, returns per-member `{username, wallet, commits, prs, points, pct, projectedAmount}`, `poolBalance`, `[RT-C1]` `distributable` (= balance − buffer, the basis for `projectedAmount`), cycle window, dust. `[RT-C5]` served from a per-team 30-60s cache.
- FR7: Per-member signals drawer, lists counted commits (sha + link) and merged PRs (number + link).
- FR8: Edit team (weights/members) via `PATCH /api/teams/[id]` guarded by admin token header. Supports editing `commit_weight`/`pr_weight` (`[RT-M1]` re-validated positive integers), adding members, and `[RT-H4]` **editing a member's `wallet_address`** (re-validated with viem `isAddress`; 422 on invalid). Wallet editing is REQUIRED, not optional, phase-03 MANUAL TEST 8 (bad-then-fixed wallet resume) depends on it. `[RT-H4]` A member's `wallet_address` PATCH is BLOCKED (409) while a settlement for the current window is status `running` (prevents changing the destination mid-payout).

### Non-functional
- Files <200 LOC, kebab-case. Components split (form, member-row, dashboard, member-card, signals-drawer).
- `[RT-C5]` `load-signals` takes a `strict` mode param. `strict=false` (TOLERANT, used by the public dashboard endpoint): GitHub error for a member -> mark `error:true`, count 0, warning; partial render, never 500. `strict=true` (used ONLY by settlement freeze in phase-03): ANY member fetch error THROWS so the caller aborts, a tolerant snapshot that silently zeroes a failed member would corrupt money. Dashboard is tolerant; freeze is strict.
- `[RT-C5]` Signals endpoint applies a per-team 30-60s server cache (quota-drain defense) around the tolerant computation.
- Admin token compared by hashing input and constant-time compare against stored hash.

## Architecture
### Data flow
```
/create form --POST /api/teams--> validate repo+users (GitHub)
  -> allocate wallet_index -> deriveTeamPoolAccount(index).address
  -> gen adminToken (crypto random), sha256 -> teams.admin_token_hash
  -> insert teams + members -> return {teamId, poolAddress, adminToken(once)}

/team/[id] (client) --poll 60s--> GET /api/teams/[id]/signals  [per-team 30-60s cache, RT-C5]
  -> load team+members -> window(cycle)
  -> per member: since=max(created_at, window.start) [RT-H3]
     fetchCommits(repo,user,since,end) + fetchMergedPrs(repo,user,since,end)   [tolerant, strict=false]
  -> balance=readUsdcBalance(poolAddress); distributable=max(0, balance-BUFFER) [RT-C1]
  -> computeShares(members, weights, distributable)
  -> {members[], poolBalance, distributable, window, dust}
```
### Components
- `app/create/page.tsx` + `components/create/team-form.tsx` + `member-row.tsx` + `create-success.tsx` (QR via a lightweight qrcode lib or `qrcode.react`).
- `app/team/[id]/page.tsx` (server shell) + `components/dashboard/dashboard-view.tsx` (client, polling) + `member-card.tsx` + `signals-drawer.tsx`.
- `app/api/teams/route.ts` (POST create), `app/api/teams/[id]/route.ts` (GET team, PATCH edit), `app/api/teams/[id]/signals/route.ts` (GET).
- `lib/auth/admin-token.ts`: `generateToken()`, `hashToken()`, `verifyToken(input, hash)` (constant-time).
- `lib/cycle/window.ts`: `cycleWindow(team, now)` -> `{start, end}`; per-member effective `since`.
- `lib/teams/create-team.ts`, `lib/teams/load-signals.ts` (server helpers, keep routes thin).

## Related Code Files
### Create
- `app/create/page.tsx`, `components/create/team-form.tsx`, `components/create/member-row.tsx`, `components/create/create-success.tsx`.
- `app/team/[id]/page.tsx`, `components/dashboard/dashboard-view.tsx`, `components/dashboard/member-card.tsx`, `components/dashboard/signals-drawer.tsx`.
- `app/api/teams/route.ts`, `app/api/teams/[id]/route.ts`, `app/api/teams/[id]/signals/route.ts`.
- `lib/auth/admin-token.ts`, `lib/cycle/window.ts`, `lib/teams/create-team.ts`, `lib/teams/load-signals.ts`.
- `lib/github/validate-repo.ts` (repo + user existence checks).
### Modify
- `app/page.tsx` (add link to `/create`).
- shadcn components added as needed (`button`, `input`, `card`, `drawer`/`sheet`, `badge`).
### Delete
- none.

## Implementation Steps
1. Add shadcn components: `npx shadcn@latest add button input card sheet badge label`.
2. `lib/auth/admin-token.ts`: `generateToken` = `crypto.randomBytes(32).toString('hex')`; `hashToken` = sha256 hex; `verifyToken` = `timingSafeEqual` on hashes.
3. `lib/cycle/window.ts`: `cycleWindow(team, now)` from `created_at`/last settlement; length by `cycle`. `[RT-H3]` `memberSince(member, windowStart)` = `max(member.created_at, windowStart)`, this value MUST flow into both fetchers in step 8, not just be computed and discarded.
4. `lib/github/validate-repo.ts`: `repoExists(repo)` (GET `/repos/{repo}` == 200), `userExists(login)` (GET `/users/{login}`).
5. `lib/teams/create-team.ts`: validate inputs (`[RT-M1]` weights positive integers -> else 422); check repo + each user; `[RT-M2]` allocation RETRY-LOOP: `SELECT max(wallet_index)` -> next index -> `deriveTeamPoolAccount(index).address` -> insert team (id = short slug/nanoid); on UNIQUE(wallet_index) violation re-read max and retry (bounded, then 503). gen token + hash. THEN insert members; `[RT-M2]` if members insert fails, DELETE the just-inserted team row (compensating rollback) and return an error, no orphan team. Return `{teamId, poolAddress, adminToken}` ONLY after team + members both committed (token surfaced last).
6. `app/api/teams/route.ts` POST -> `create-team.ts`. Validate body; 400 on bad input, 422 if repo/user missing. Never log token.
7. `components/create/team-form.tsx`: controlled form, member rows add/remove, client validation (isAddress, repo regex, unique usernames), submit -> POST -> render `create-success.tsx` with pool address, QR, adminToken (copy button + warning), link to `/team/[id]`.
8. `lib/teams/load-signals.ts`: `loadSignals(teamId, { strict })`. Load team+members; compute window; for each member compute `[RT-H3]` `since = memberSince(member, window.start)` and pass it into BOTH `fetchCommits(repo, username, since, window.end)` AND `fetchMergedPrs(repo, username, since, window.end)` (PR filter: `merged_at in [since, window.end]`). `[RT-C5]` error handling depends on mode: `strict=false` -> per-member try/catch (on error mark `error:true`, count 0, warning); `strict=true` -> re-throw (abort). `readUsdcBalance(poolAddress)` -> base units; `[RT-C1]` `distributable = max(0n, balance - GAS_BUFFER_BASE_UNITS)`; `computeShares(members, weights, distributable)`; return DTO (include both `poolBalance` and `distributable`) with items for drawer.
9. `app/api/teams/[id]/signals/route.ts` GET -> `loadSignals(id, { strict:false })`. `[RT-C5]` wrap in a per-team 30-60s server cache. 404 if team missing.
10. `app/api/teams/[id]/route.ts`: GET (team + members, no hash) and PATCH guarded by `x-admin-token` header via `verifyToken` (401 if bad). PATCH supports weights (`[RT-M1]` positive integers), add member, and `[RT-H4]` `wallet_address` edit (`isAddress` re-validate, 422 invalid; 409 if a `running` settlement covers the current window).
11. `components/dashboard/dashboard-view.tsx` (client): initial fetch + `setInterval(60_000)` poll + manual Refresh button + last-updated timestamp + loading state; render `member-card` list, pool balance, days-until-settlement. Cleanup interval on unmount.
12. `components/dashboard/signals-drawer.tsx`: sheet listing commits (sha short + GitHub link) and PRs (#number + link) for a member.
13. `app/team/[id]/page.tsx`: server shell fetches team meta (or passes id) -> renders `dashboard-view`.
14. `npm run build` clean. Manual test (guide below). Commit explicit paths.

## Todo List
- [ ] shadcn components added
- [ ] `admin-token.ts` (gen/hash/verify constant-time)
- [ ] `cycle/window.ts` (window + mid-cycle member since)
- [ ] `validate-repo.ts` (repo + user existence)
- [ ] `create-team.ts` (`[RT-M2]` wallet_index retry-loop, derive address, token hash, insert; members-fail -> delete team; token last)
- [ ] `POST /api/teams` route (`[RT-M1]` server-side positive-integer weight validation)
- [ ] create form + member rows + client validation (`[RT-M1]` positive-integer weights)
- [ ] create-success (pool address, QR, token-once warning)
- [ ] `load-signals.ts` (`[RT-C5]` strict param; `[RT-H3]` memberSince into both fetchers; `[RT-C1]` distributable basis)
- [ ] `GET /api/teams/[id]/signals` (`[RT-C5]` per-team 30-60s cache)
- [ ] `GET`/`PATCH /api/teams/[id]` (admin-guarded; `[RT-H4]` wallet_address edit + 409 while running)
- [ ] dashboard-view with 60s poll + manual refresh
- [ ] member-card + signals-drawer with GitHub links
- [ ] `npm run build` clean
- [ ] committed explicit paths

## Success Criteria
- Observable: creating a team returns a pool address + one-time admin token, and rows appear in `teams`/`members`. Dashboard shows real per-member commit/PR counts for the current window and projected USDC shares that sum (+dust) to the live pool balance. Poll refreshes counts within 60s; manual refresh works. Drawer links open the exact commits/PRs on GitHub. PATCH rejects a wrong admin token (401).

## Test Matrix
- Integration: create team with a real public repo + 2-3 real usernames -> DB rows correct, unique wallet_index, pool address matches `deriveTeamPoolAccount(index)`.
- Integration: signals endpoint returns counts matching GitHub for the window.
- Edge: repo does not exist -> 422, no rows written.
- Edge: unknown username -> 422 (or flagged) before insert.
- Edge: duplicate usernames in form -> client blocks submit.
- Edge: member with unlinked-email commits -> shows 0 commits, UI note.
- Edge: GitHub error for one member -> that card shows warning, others render (no full-page 500). `[RT-C5]` (tolerant mode; strict-mode abort is tested in phase-03).
- Edge: PATCH with wrong/missing admin token -> 401.
- `[RT-H3]` Integration: member added mid-window (created_at after window.start) shows ZERO commits/PRs before their join instant; signals counted only from `memberSince`.
- `[RT-M1]` Edge (API): fractional weight (1.5) -> 422; zero for BOTH weights -> 422; negative weight -> 422; no rows written.
- `[RT-M2]` Edge: simulate members insert failure after team insert -> team row is deleted (no orphan), error returned, no admin token surfaced.
- `[RT-H4]` Integration: PATCH member `wallet_address` with valid address -> updated; invalid -> 422; PATCH wallet while a `running` settlement covers the current window -> 409.
- `[RT-C5]` Integration: two signals requests within the cache TTL hit GitHub only once (cache serves the second).
- Unit (add): `cycleWindow` weekly/monthly boundaries; `memberSince` mid-cycle join.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| GitHub rate limit on N-member poll | Med | Med | `GITHUB_TOKEN`; 60s poll; per-member try/catch |
| `[RT-C5]` Public signals endpoint drains GITHUB_TOKEN quota (DoS) | Med | High | Per-team 30-60s server cache; token; tolerant per-member |
| `[RT-M2]` Orphan team row on partial create | Low | Med | Retry-loop alloc + compensating delete; token surfaced only after all writes |
| wallet_index race on concurrent create | Low | Med | UNIQUE constraint + retry-LOOP (not single retry) `[RT-M2]` |
| Admin token lost by user | Med | Low | Clear one-time warning; v1 accepts no recovery |
| Projection != settlement (balance moves) | Med | Low | Label as "projected"; freeze at settlement (Phase 3) |
| Wallet typo in member row | Med | Med | `isAddress` checksum validation client+server |

## Security Considerations
- Admin token: only SHA-256 hash stored; returned once; mutations require header + constant-time verify. Never log token or hash.
- Signals/GET endpoints are public read (matches PRD transparency), expose no secrets, no admin token, no service-role data beyond public signals.
- Server-only Supabase writes via service role in route handlers, never from client.
- Untrusted input: repo/username strings go only to GitHub URL paths (encodeURIComponent), no shell, no SQL string concat (use Supabase client params).

## MANUAL TEST GUIDE
1. Go to `http://localhost:3000/create`. Fill team name, a real public repo `owner/name`, 2-3 members with real GitHub usernames + valid wallet addresses, weights 1/3, cycle weekly. Click "Create team". Expect: success screen with pool address, QR code, and an admin token + "save now" warning. Failure: red validation on a field, or 422 (repo/user not found).
2. Copy the admin token and pool address. Click "Go to dashboard". Expect: `/team/[id]` shows each member with commit + PR counts and a projected USDC share; pool balance shows 0 USDC (unfunded). Failure: spinner never resolves (check `/api/teams/[id]/signals` in network tab).
3. On a member card, click "Signals". Expect: drawer lists that member's counted commits and merged PRs, each a clickable GitHub link that opens the right page. Failure: empty list for a member you know has activity -> check email linkage / window.
4. Wait 60s without touching the page (or click "Refresh"). Expect: "last updated" timestamp advances, counts re-fetch. Failure: timestamp frozen -> interval not running.
5. Fund the pool address with test USDC (faucet from Phase 1), click Refresh. Expect: pool balance shows the funded amount, projected USDC shares now non-zero and summing (+dust) to balance. Failure: balance still 0 -> wrong address / RPC error.
6. Attempt an edit with a wrong admin token via the edit control. Expect: 401 / "unauthorized". Failure: edit succeeds -> auth not enforced.
7. `[RT-H4]` With the correct admin token, edit a member's wallet address to another valid address -> saved (dashboard shows new address). Try an invalid string -> 422 / inline error. Failure: invalid address saved -> `isAddress` not enforced.
8. `[RT-M1]` In the create form, set a weight to `1.5`, `0`/`0`, or `-1` -> submit blocked client-side; if bypassed, API returns 422. Failure: team created with bad weights.

## AUDIT GATE
Before Phase 3 approval: run AUDIT GATE. Write `plans/PHASE2-AUDIT.md` with deviations, edge cases tested (missing repo, unknown user, duplicate usernames, GitHub per-member failure, wrong admin token, `[RT-H3]` mid-window join zero pre-join signals, `[RT-M1]` bad-weight 422, `[RT-M2]` create-atomicity rollback, `[RT-H4]` wallet edit + 409-while-running, `[RT-C5]` cache-hit skips GitHub), bugs+fixes, regression tests, evidence of a real created team + live dashboard screenshot/log, `git log --oneline` + clean `git status`. STOP for approval.

## Next Steps
- Unblocks Phase 3 (settlement freezes the same signals the dashboard projects; reuses `load-signals`/`computeShares`, pool address, admin-token verify for manual settle).
