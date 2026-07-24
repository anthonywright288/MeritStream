# MeritStream: Product Requirements Document

> GitHub signals in, weighted USDC splits out, one batch settlement
> Hackathon: Build on Arc. Track: Agentic Economy (primary), DeFi (secondary)
> Version: 0.1.0 Draft

---

## 1. What is MeritStream?

A payout agent that turns contribution into compensation. Connect a GitHub repository, register team members with their wallets, fund a payout pool in USDC. On each cycle the agent reads real work signals (commits and merged pull requests per member), computes weighted shares, and settles USDC to every member in one automated settlement run on Arc. Every payout links back to the exact commits that earned it.

### The problem

| Team pain | Current "solution" |
|---|---|
| "Who did how much" arguments at payout time | A spreadsheet someone updates from memory |
| Manual transfers to N members every cycle | N MetaMask sessions, N chances to typo |
| No audit trail from money back to work | Trust me bro |

MeritStream makes the split derivable and the settlement auditable: signals are public GitHub data, weights are declared upfront, payouts are onchain transactions anyone can verify.

### Example cycle

```
Repo: github.com/team/product   Pool: 1,000 USDC   Cycle: monthly
Weights: commit = 1 point, merged PR = 3 points

  Alice: 40 commits + 10 PRs = 70 pts  -> 50.0% -> 500 USDC
  Bob:   30 commits +  4 PRs = 42 pts  -> 30.0% -> 300 USDC
  Carol: 16 commits +  4 PRs = 28 pts  -> 20.0% -> 200 USDC

One settlement run. Each row links to the commit list behind it.
```

---

## 2. Scope decision: GitHub only in v1

The original idea ("commits, tasks, reviews") invites integration sprawl. v1 reads exactly two signals from one source:

| Signal | GitHub endpoint | Weight (default, configurable) |
|---|---|---|
| Commits authored in cycle | `GET /repos/{o}/{r}/commits?author=X&since=&until=` | 1 |
| PRs merged in cycle | `GET /repos/{o}/{r}/pulls?state=closed` filtered by merged_at + author | 3 |

Both are public REST, no OAuth needed for public repos (add a token for rate limits). Jira, Linear, and review counts are explicitly v2.

Fairness note shown in the UI: commit counts are gameable (100 tiny commits). Mitigations in v1: weights favor merged PRs (which need review), the full signal log is public to the team, and weights are agreed upfront. Deeper anti-gaming (lines changed, review approvals) is v2.

---

## 3. Architecture

A cron endpoint plus a backend signer plus Supabase. No escrow contract needed: the pool sits in a dedicated pool wallet controlled by the backend signer, and payouts are plain USDC transfers.

```
Cycle end (cron checks daily)
  |
  v
/api/agent/run
  +-- fetch commits per member (GitHub API)
  +-- fetch merged PRs per member (GitHub API)
  +-- compute points and shares (pure function, no LLM anywhere)
  +-- save snapshot: raw signals + computed shares
  |
  v
Payout: for each member, USDC transfer from pool wallet
  (loop of transfers in v1; Multicall3From batch as stretch goal,
   contract 0x522fAf9A91c41c443c66765030741e4AaCe147D0, verify ABI first)
  |
  v
Receipt: per-member tx hashes saved, dashboard updates
```

This agent has zero LLM calls. Its "clear decision logic tied to real signals" is a deterministic formula, which is a feature to state proudly in the pitch: same inputs, same split, every time, auditable by anyone.

| Item | Value |
|---|---|
| Network | Arc Testnet, chain ID `5042002` |
| USDC | `0x3600000000000000000000000000000000000000` (6 decimals) |
| Multicall3From (stretch) | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` |

---

## 4. Pages

### 4.1. Create team

Form: team name, GitHub repo (owner/name), members (GitHub username + wallet address each), weights (commit points, PR points), cycle length (weekly / monthly), pool wallet funding instructions. Validates that the repo exists and usernames have activity.

### 4.2. Team dashboard

Live view of the current cycle: per-member running point totals, projected shares, pool balance, days until settlement. A "signals" drawer per member lists the actual commits and PRs counted so far, each linking to GitHub.

### 4.3. Settlement history

Past cycles: date, pool amount, per-member share and tx hash. Click a cycle to see the frozen signal snapshot that produced it. This page is the audit trail.

### 4.4. Public team page

Read-only version of the dashboard at `/t/[teamId]`. Teams share it for transparency; contributors use it to verify they were counted.

---

## 5. Flows

### Setup

```
Lead creates team, adds repo + 3 members + weights
  -> funds pool wallet with 1,000 USDC (address shown with QR)
  -> dashboard starts tracking the current cycle immediately
```

### Cycle settlement

```
Cron detects cycle end
  -> fetches signals, computes shares, freezes snapshot
  -> pays each member from pool wallet (loop of transfers)
  -> saves tx hashes, opens the next cycle
  -> members get their share without anyone lifting a finger
```

### Dispute (transparency, not arbitration)

```
Bob thinks his share is low
  -> opens settlement snapshot
  -> sees exactly which commits and PRs were counted, with GitHub links
  -> if a PR was missed (e.g. merged 1 min after cutoff), the data shows it
  -> team adjusts weights or cutoffs for the next cycle
```

v1 does not modify past payouts. The snapshot is the record.

---

## 6. Edge rules (decided upfront so settlement never surprises anyone)

- **Rounding dust.** Shares are computed in USDC base units (6 decimals) and floored per member; leftover dust (at most a few millionths per member) stays in the pool and rolls into the next cycle. Stated on the settlement page.
- **Zero-activity cycle.** If total points are zero, no settlement occurs: the pool rolls over, the cycle closes with a "no activity" record, and no division by zero ever happens.
- **Mid-cycle joins.** A member added mid-cycle accrues points from the moment they are added, not retroactively. Simple, legible, printed on the member row.
- **Commit attribution caveat.** GitHub matches commits to users via commit email. Commits from unlinked emails will not count; the setup flow tells members to verify their email is linked to their GitHub account.
- **Squash merges.** A squash-merged PR produces one commit plus one merged PR by the same author, so it earns both weights. This is consistent across all members and therefore fair; noted in the weights help text.
- **Pool wallet gas.** Gas on Arc is USDC, the same asset as the pool. No separate gas token to manage; the payout engine reserves a small buffer (1 USDC) and never pays it out.

## 6b. Database (Supabase)

```sql
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  lead_address TEXT NOT NULL,
  name TEXT NOT NULL,
  repo TEXT NOT NULL,               -- "owner/name"
  commit_weight NUMERIC DEFAULT 1,
  pr_weight NUMERIC DEFAULT 3,
  cycle TEXT DEFAULT 'monthly',     -- weekly | monthly
  pool_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT REFERENCES teams(id),
  github_username TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  UNIQUE(team_id, github_username)
);

CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT REFERENCES teams(id),
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  pool_amount NUMERIC NOT NULL,
  snapshot JSONB NOT NULL,          -- frozen signals + points + shares per member
  status TEXT DEFAULT 'paid',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID REFERENCES settlements(id),
  member_id UUID REFERENCES members(id),
  amount NUMERIC NOT NULL,
  tx_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Tech stack

Next.js, viem (backend signer for pool wallet), Vercel Cron, Supabase, Tailwind + shadcn/ui. Notable piece: GitHub REST client (plain fetch, optional token). Explicitly absent: LLM (not needed), escrow contract (pool wallet + transfers suffice), OAuth (public repos in v1).

---

## 8. Roadmap (roughly 4 days)

Day 1: project skeleton (cron endpoint, backend signer), GitHub signal fetchers (commits + merged PRs per author), points formula with tests.
Day 2: Create team flow + team dashboard with live signals drawer.
Day 3: Settlement cron (snapshot + loop payouts + receipts), settlement history page.
Day 4: Public team page, polish, deploy, demo team with real repo activity.

Stretch (only if ahead of schedule): swap payout loop for one Multicall3From batch transaction.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| GitHub rate limits | Token raises limit to 5,000/h; signals cached per cron run |
| Commit gaming (many tiny commits) | PR weight 3x, public signal log, weights configurable; deeper checks in v2 |
| Member wallet typo | Checksum validation + test payout of 0.01 USDC on member add (optional toggle) |
| Pool underfunded at cycle end | Pre-settlement balance check; if short, settlement pauses and lead is notified |
| Payout loop fails midway | Per-payout status; resume from first unpaid member; each tx independent |
| Private repos | v1 states public repos only; token-based private support is v2 |
| Rounding leaves shares not summing to pool | Floor per member in base units; dust rolls over; totals shown on settlement page |
| Zero activity in a cycle | Settlement skips, pool rolls over, cycle recorded as no-activity |

---

## 10. Success criteria

Must have: create team with repo + members + weights, live signal tracking, cron settlement with frozen snapshot, per-member USDC payouts with tx hashes, audit trail from payout back to commits, deployed on Vercel.

Wow demo: open the dashboard mid-cycle, push a commit to the repo live, watch the member's points and projected share update, trigger settlement, show three wallets receiving USDC and each payout linking back to the commits that earned it.

---

## Appendix: environment variables

```env
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_MULTICALL3FROM=0x522fAf9A91c41c443c66765030741e4AaCe147D0
POOL_WALLET_PRIVATE_KEY=
GITHUB_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
